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

const crypto = require("crypto");

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

function createSseSender(res, { fps = 10, padBytes = DEFAULT_PAD_BYTES, now = Date.now, onTraffic = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const minIntervalMs = 1000 / Math.max(fps, 1);
  let padTimer = null;
  let pending = null;
  let lastSentAt = -Infinity; // la première image part tout de suite
  let lastSentId = null;
  let congested = false;
  let timer = null;
  let closed = false;
  const seen = new Set(); // ordre d'insertion : du plus ancien au plus récent
  const stats = { sent: 0, skipped: 0, padded: 0, refs: 0 };

  // true si le navigateur a déjà cette image ; la marque comme la plus récente.
  const remember = (id) => {
    const known = seen.delete(id);
    seen.add(id);
    if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value);
    return known;
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

  const flush = () => {
    if (closed || !pending || congested || timer) return;
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
    stats.sent += 1;
    const known = remember(frame.id);
    if (known) stats.refs += 1;
    const event = known ? refEvent(frame, now()) : frameEvent(frame, now());
    const accepted = res.write(event);
    onTraffic(Buffer.byteLength(event), 1);
    schedulePadding();
    if (accepted === false) {
      congested = true;
      res.once("drain", () => {
        congested = false;
        flush();
      });
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
      if (timer) clearTimer(timer);
      if (padTimer) clearTimer(padTimer);
    },
    stats,
  };
}

module.exports = { createSseSender, frameEvent, refEvent, paddingComment, padBytesFromEnv, DEFAULT_PAD_BYTES, SEEN_LIMIT };
