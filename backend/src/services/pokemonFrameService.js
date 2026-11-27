const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const mgbaClient = require("./mgbaClient");
const { createFrameBus } = require("./pokemonFrameBus");

// Capture de l'écran du jeu, partagée par tous les spectateurs.
//
// Cadence dynamique : chaque spectateur demande une cadence (?fps= sur
// /api/pokemon/frame). Le serveur capture au rythme du plus exigeant des
// 3 dernières secondes, entre 1 et POKEMON_MAX_FPS (30 par défaut). Sans
// demande explicite : POKEMON_FRAME_INTERVAL_MS (100 ms, soit 10 img/s).
// Sans aucun spectateur depuis IDLE_AFTER_MS, la capture s'arrête ; elle
// repart à la prochaine demande d'image.
//
// Images identiques : environ une capture sur deux est identique à la
// précédente (mesuré à 30 img/s en jeu). Une empreinte du PNG brut permet
// de ne pas la ré-encoder, et de garder le même identifiant (frameId) :
// la route répond alors 304 au navigateur qui l'a déjà.

const RAW_CAPTURE_FORMAT = "png";
const OUTPUT_FORMAT = "webp";
const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 160;
const FILE_WAIT_TIMEOUT_MS = 1500;
const FILE_WAIT_INTERVAL_MS = 10;
const VIEWER_WINDOW_MS = 3000;
const IDLE_AFTER_MS = 15000;
const STATS_WINDOW_MS = 3000;

const MAX_FPS = Math.min(Math.max(parseInt(process.env.POKEMON_MAX_FPS, 10) || 30, 1), 30);
const ADMIN_MAX_FPS = 60;
const DEFAULT_FPS = Math.min(
  1000 / Math.max(parseInt(process.env.POKEMON_FRAME_INTERVAL_MS, 10) || 100, 1000 / MAX_FPS),
  MAX_FPS
);

const DEFAULT_CAPTURE_PATH = path.join(
  __dirname,
  "..",
  "data",
  "pokemon-stream",
  `latest.${RAW_CAPTURE_FORMAT}`
);

// Chemin où Node lit l'image, et chemin où mGBA-http l'écrit (identiques en
// prod : même machine).
const nodeFramePath = process.env.POKEMON_NODE_FRAME_PATH || DEFAULT_CAPTURE_PATH;
const mgbaCapturePath = process.env.POKEMON_MGBA_CAPTURE_PATH || nodeFramePath;

const state = {
  status: "starting",
  lastFrameAt: null,
  format: OUTPUT_FORMAT,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  error: "",
  hasFrame: false,
  frameSizeBytes: 0,
};

let latestFrameBuffer = null;
let latestFrameId = null;
// Dernières images encodées, par empreinte : une animation en boucle repasse
// par les mêmes images, inutile de les réencoder (et de refaire leur base64).
const ENCODED_LIMIT = 32;
const encoded = new Map(); // frameId -> { buffer, base64? }

async function encodeFrame(frameId, rawBuffer) {
  let entry = encoded.get(frameId);
  if (entry) {
    encoded.delete(frameId); // remise en tête
  } else {
    entry = { buffer: await sharp(rawBuffer).webp({ lossless: true }).toBuffer() };
  }
  encoded.set(frameId, entry);
  if (encoded.size > ENCODED_LIMIT) encoded.delete(encoded.keys().next().value);
  return entry;
}
let lastCapturedAt = null; // dernière capture (même si l'image n'a pas changé)
let loopRunning = false;
let lastViewerAt = 0;
let viewerRequests = []; // { at, fps, viewer }
let captures = []; // { at, ms, bytes, unchanged }
// Spectateurs en flux continu (SSE) : ils reçoivent chaque image différente
// sans la demander, et comptent comme spectateurs tant qu'ils sont connectés.
const bus = createFrameBus();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clampFps(value, experimental = false) {
  const fps = Number(value);
  if (!Number.isFinite(fps) || fps <= 0) return null;
  return Math.min(Math.max(fps, 1), experimental ? ADMIN_MAX_FPS : MAX_FPS);
}

function targetFps(now = Date.now()) {
  viewerRequests = viewerRequests.filter((r) => now - r.at <= VIEWER_WINDOW_MS);
  const asked = [...viewerRequests.map((r) => r.fps).filter(Boolean), ...bus.fpsList()];
  return asked.length ? Math.max(...asked) : DEFAULT_FPS;
}

async function statOrNull() {
  try {
    return await fs.stat(nodeFramePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// Attend une image plus récente que celle d'avant la demande : sinon on
// relirait l'ancienne, ou une image en cours d'écriture.
async function waitForFreshFrame(previousMtimeMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= FILE_WAIT_TIMEOUT_MS) {
    const stats = await statOrNull();
    if (stats && stats.size > 0 && stats.mtimeMs > previousMtimeMs) return stats;
    await sleep(FILE_WAIT_INTERVAL_MS);
  }
  const timeoutError = new Error("Le fichier de frame Pokémon n'a pas été généré à temps.");
  timeoutError.status = 504;
  throw timeoutError;
}

async function refreshFrame() {
  const startedAt = Date.now();
  try {
    await fs.mkdir(path.dirname(nodeFramePath), { recursive: true });
    state.status = state.hasFrame ? "capturing" : "starting";

    const before = await statOrNull();
    await mgbaClient.requestScreenshot(mgbaCapturePath);
    await waitForFreshFrame(before ? before.mtimeMs : 0);
    const rawBuffer = await fs.readFile(nodeFramePath);
    const frameId = crypto.createHash("sha1").update(rawBuffer).digest("base64url").slice(0, 16);
    const unchanged = frameId === latestFrameId && latestFrameBuffer;

    if (!unchanged) {
      const entry = await encodeFrame(frameId, rawBuffer);
      if (!entry.base64) entry.base64 = entry.buffer.toString("base64");
      latestFrameBuffer = entry.buffer;
      latestFrameId = frameId;
      state.lastFrameAt = new Date().toISOString();
      state.frameSizeBytes = latestFrameBuffer.length;
      bus.publish({ id: frameId, buffer: entry.buffer, base64: entry.base64, capturedAt: Date.now() });
    }
    lastCapturedAt = Date.now();
    state.status = "ok";
    state.hasFrame = true;
    state.error = "";
    captures.push({ at: Date.now(), ms: Date.now() - startedAt, bytes: state.frameSizeBytes, unchanged: Boolean(unchanged) });
  } catch (error) {
    state.status = "error";
    state.error = error.details || error.message || "La capture de la frame Pokémon a échoué.";
  }
}

async function captureLoop() {
  loopRunning = true;
  try {
    while (bus.size() > 0 || Date.now() - lastViewerAt <= IDLE_AFTER_MS) {
      const startedAt = Date.now();
      await refreshFrame();
      const periodMs = 1000 / targetFps();
      const wait = state.status === "error" ? Math.max(periodMs, 500) : periodMs - (Date.now() - startedAt);
      await sleep(Math.max(0, wait));
    }
  } finally {
    loopRunning = false;
  }
}

function noteViewer(fps, viewer) {
  const now = Date.now();
  lastViewerAt = now;
  viewerRequests.push({ at: now, fps: clampFps(fps), viewer: viewer || "anonyme" });
  if (!loopRunning) captureLoop();
}

function getFrameStatus() {
  const now = Date.now();
  captures = captures.filter((c) => now - c.at <= STATS_WINDOW_MS);
  const avgMs = captures.length ? captures.reduce((sum, c) => sum + c.ms, 0) / captures.length : 0;

  return {
    success: true,
    status: loopRunning ? state.status : "idle",
    hasFrame: state.hasFrame,
    lastFrameAt: state.lastFrameAt,
    intervalMs: Math.round(1000 / targetFps(now)),
    targetFps: targetFps(now),
    maxFps: MAX_FPS,
    captureFps: captures.length / (STATS_WINDOW_MS / 1000),
    captureMs: Math.round(avgMs),
    unchangedRatio: captures.length ? captures.filter((c) => c.unchanged).length / captures.length : 0,
    viewers: new Set([...viewerRequests.map((r) => r.viewer), ...bus.viewers()]).size,
    streams: bus.size(),
    format: state.format,
    width: state.width,
    height: state.height,
    error: state.error,
    frameSizeBytes: state.frameSizeBytes,
  };
}

function getFrameBuffer(fps, viewer) {
  noteViewer(fps, viewer);

  if (!latestFrameBuffer) {
    const error = new Error(state.error || "Aucune frame Pokémon n'est disponible pour le moment.");
    error.status = 503;
    throw error;
  }

  return {
    buffer: latestFrameBuffer,
    format: state.format,
    lastFrameAt: state.lastFrameAt,
    frameId: latestFrameId,
    // Âge de la dernière capture : l'image est confirmée à jour à cet instant,
    // même si elle n'a pas changé depuis plus longtemps.
    ageMs: lastCapturedAt ? Date.now() - lastCapturedAt : null,
  };
}

// Flux continu : onFrame reçoit { id, buffer, capturedAt } à chaque image
// différente (et tout de suite la dernière connue). Renvoie la désinscription.
function subscribe({ fps, viewer, onFrame, experimental = false }) {
  const unsubscribe = bus.subscribe({ fps: clampFps(fps, experimental) || DEFAULT_FPS, viewer: viewer || "anonyme", onFrame });
  lastViewerAt = Date.now();
  if (!loopRunning) captureLoop();
  return () => {
    unsubscribe();
    lastViewerAt = Date.now(); // la capture s'arrête IDLE_AFTER_MS plus tard
  };
}

module.exports = {
  subscribe,
  getFrameBuffer,
  getFrameStatus,
  clampFps,
  targetFps,
  MAX_FPS,
  DEFAULT_FPS,
};
