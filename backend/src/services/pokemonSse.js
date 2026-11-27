// Envoi des images à un client SSE.
//
// - Jamais de file d'attente : on garde seulement la dernière image en
//   attente. Un client lent (mauvais réseau) saute des images au lieu
//   d'accumuler du retard et de faire gonfler la mémoire du serveur.
// - Cadence plafonnée à ce que le client a demandé (fps).
// - Si l'écriture est refusée (tampon plein), on attend l'événement
//   « drain » avant d'envoyer la suivante.
// - Bourrage : les proxys devant le serveur gardent les petites réponses
//   en tampon tant qu'il n'est pas plein. Une image suivie d'un silence (la
//   première, ou la dernière d'un mouvement) resterait coincée : on envoie
//   alors un commentaire SSE, ignoré par le navigateur, assez gros pour
//   pousser l'image jusqu'au navigateur. Rien n'est ajouté tant que les
//   images s'enchaînent.
// - Images déjà vues : les animations en boucle (fleurs, eau, curseur)
//   repassent par les mêmes images. Chaque connexion retient les
//   SEEN_LIMIT dernières images envoyées ; pour l'une d'elles, on n'envoie
//   que son identifiant (événement « ref ») et le navigateur la réaffiche
//   depuis son cache, qui en garde au moins autant.
// - Rectangle modifié (événement « delta ») : chaque connexion garde les
//   pixels de la dernière image qu'elle a vraiment envoyée. Pour une
//   nouvelle image, on calcule le plus petit rectangle qui contient les
//   pixels changés et on l'encode en webp lossless ; s'il pèse moins que
//   l'image entière (en base64), on n'envoie que lui, avec sa position.
//   Le calcul part toujours de ce que le navigateur affiche, jamais d'une
//   image sautée. Pendant la marche (tout l'écran défile), le rectangle
//   couvre tout et pèse autant : l'image entière part alors comme avant.

const crypto = require("crypto");
const { createDeltaEncoder } = require("./pokemonDelta");

// 0 coupe le bourrage (proxys réglés avec proxy_buffering off).
function padBytesFromEnv(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 16384 : Math.min(Math.max(parsed, 0), 65536);
}

const DEFAULT_PAD_BYTES = padBytesFromEnv(process.env.POKEMON_SSE_PAD_BYTES);
const PAD_AFTER_MS = 80;
const SEEN_LIMIT = 32;

// Commentaire SSE (ligne commençant par « : ») de `bytes` octets environ,
// en caractères aléatoires pour qu'une compression ne le réduise pas à rien.
const paddings = new Map();
function paddingComment(bytes) {
  if (!bytes) return "";
  if (!paddings.has(bytes)) {
    const filler = crypto.randomBytes(Math.ceil((bytes * 3) / 4)).toString("base64").slice(0, bytes);
    paddings.set(bytes, `: ${filler}\n\n`);
  }
  return paddings.get(bytes);
}

function frameEvent(frame, now = Date.now()) {
  if (!frame.base64) frame.base64 = frame.buffer.toString("base64");
  const data = JSON.stringify({ id: frame.id, ageMs: Math.max(0, now - frame.capturedAt), img: frame.base64 });
  return `id: ${frame.id}\nevent: frame\ndata: ${data}\n\n`;
}

// Image que le navigateur a déjà : seulement son identifiant.
function refEvent(frame, now = Date.now()) {
  const data = JSON.stringify({ id: frame.id, ageMs: Math.max(0, now - frame.capturedAt) });
  return `id: ${frame.id}\nevent: ref\ndata: ${data}\n\n`;
}

// Rectangle à poser sur l'image `baseId` que le navigateur affiche.
function deltaEvent(frame, baseId, rect, now = Date.now()) {
  const data = JSON.stringify({
    id: frame.id,
    baseId,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    ageMs: Math.max(0, now - frame.capturedAt),
    img: rect.base64,
  });
  return `id: ${frame.id}
event: delta
data: ${data}

`;
}

// Totaux de toutes les connexions depuis le démarrage (exposés par
// /api/pokemon/frame-status, champ `sse`).
const totals = { frames: 0, refs: 0, deltas: 0, bytesSent: 0, bytesSaved: 0 };
const sharedDeltas = createDeltaEncoder();

function getSseStats() {
  return { ...totals, deltaEncoder: sharedDeltas.stats() };
}

// Pixels bruts d'une image, si le service de capture les a publiés.
const pixelsOf = (frame) =>
  frame && frame.raw ? { id: frame.id, raw: frame.raw, width: frame.width, height: frame.height, channels: frame.channels } : null;

function createSseSender(
  res,
  { fps = 10, padBytes = DEFAULT_PAD_BYTES, now = Date.now, onTraffic = () => {}, setTimer = setTimeout, clearTimer = clearTimeout, deltas = sharedDeltas } = {}
) {
  const minIntervalMs = 1000 / Math.max(fps, 1);
  let padTimer = null;
  let pending = null;
  let lastSentAt = -Infinity; // la première image part tout de suite
  let lastSentId = null;
  let congested = false;
  let encoding = false; // rectangle en cours d'encodage : compte comme un envoi en cours
  let timer = null;
  let closed = false;
  // Pixels de la dernière image réellement envoyée (base du prochain delta).
  let base = null;
  // Images déjà envoyées -> leurs pixels (ou null). Ordre d'insertion : du
  // plus ancien au plus récent. Les Buffers sont ceux du service de capture,
  // partagés entre connexions : pas de copie.
  const seen = new Map();
  const stats = { sent: 0, skipped: 0, padded: 0, refs: 0, deltas: 0, bytesSaved: 0 };

  // Marque l'image comme la plus récente du cache.
  const remember = (id, pixels) => {
    seen.delete(id);
    seen.set(id, pixels);
    if (seen.size > SEEN_LIMIT) seen.delete(seen.keys().next().value);
  };

  const schedulePadding = () => {
    if (!padBytes) return;
    if (padTimer) clearTimer(padTimer);
    padTimer = setTimer(() => {
      padTimer = null;
      if (closed || congested) return;
      stats.padded += 1;
      const padding = paddingComment(padBytes);
      res.write(padding);
      onTraffic(padding.length, 0);
    }, PAD_AFTER_MS);
  };

  // Écrit un événement déjà décidé, puis met à jour la base du delta.
  const write = (chunk, kind, pixels, id) => {
    stats.sent += 1;
    totals.bytesSent += chunk.length;
    if (kind === "ref") {
      stats.refs += 1;
      totals.refs += 1;
    } else if (kind === "delta") {
      totals.deltas += 1;
    } else {
      totals.frames += 1;
    }
    remember(id, pixels);
    base = pixels;
    const accepted = res.write(chunk);
    onTraffic(Buffer.byteLength(chunk), 1);
    schedulePadding();
    if (accepted === false) {
      congested = true;
      res.once("drain", () => {
        congested = false;
        flush();
      });
    }
  };

  // Image entière ou rectangle, selon ce qui pèse le moins.
  const sendNew = (frame) => {
    const pixels = pixelsOf(frame);
    const from = base;
    if (!pixels || !from || !deltas) {
      write(frameEvent(frame, now()), "frame", pixels, frame.id);
      return;
    }
    encoding = true;
    Promise.resolve()
      .then(() => deltas.delta(from, pixels))
      .catch(() => null) // encodage en échec : image entière
      .then((rect) => {
        encoding = false;
        if (closed) return; // connexion fermée pendant l'encodage : rien à écrire
        if (!frame.base64) frame.base64 = frame.buffer.toString("base64");
        if (rect && rect.base64.length < frame.base64.length) {
          stats.deltas += 1;
          const saved = frame.base64.length - rect.base64.length;
          stats.bytesSaved += saved;
          totals.bytesSaved += saved;
          write(deltaEvent(frame, from.id, rect, now()), "delta", pixels, frame.id);
        } else {
          write(frameEvent(frame, now()), "frame", pixels, frame.id);
        }
        flush(); // une image a pu arriver pendant l'encodage
      });
  };

  const flush = () => {
    if (closed || !pending || congested || encoding || timer) return;
    const wait = minIntervalMs - (now() - lastSentAt);
    if (wait > 0) {
      timer = setTimer(() => {
        timer = null;
        flush();
      }, wait);
      return;
    }
    const frame = pending;
    pending = null;
    if (frame.id === lastSentId) return;
    lastSentAt = now();
    lastSentId = frame.id;
    if (seen.has(frame.id)) {
      // Pixels gardés dans le cache, sinon ceux du frame offert.
      write(refEvent(frame, now()), "ref", seen.get(frame.id) || pixelsOf(frame), frame.id);
    } else {
      sendNew(frame);
    }
  };

  return {
    offer(frame) {
      if (closed) return;
      if (pending) stats.skipped += 1; // remplacée avant d'avoir pu partir
      pending = frame;
      flush();
    },
    close() {
      closed = true;
      pending = null;
      if (timer) clearTimer(timer);
      if (padTimer) clearTimer(padTimer);
    },
    stats,
  };
}

module.exports = { createSseSender, frameEvent, refEvent, deltaEvent, getSseStats, paddingComment, padBytesFromEnv, DEFAULT_PAD_BYTES, SEEN_LIMIT };
