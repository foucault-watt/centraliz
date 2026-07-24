const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const mgbaClient = require("./mgbaClient");

const RAW_CAPTURE_FORMAT = "png";
const OUTPUT_FORMAT = "webp";
const DEFAULT_INTERVAL_MS = 100; // 10 FPS
const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 160;
const FILE_WAIT_TIMEOUT_MS = 1500;
const FILE_WAIT_INTERVAL_MS = 75;

const DEFAULT_CAPTURE_PATH = path.join(
  __dirname,
  "..",
  "data",
  "pokemon-stream",
  `latest.${RAW_CAPTURE_FORMAT}`
);

// Chemin tel que Node lit le fichier de capture (toujours le disque local
// de Node). En production, Node et mGBA-http tournent sur le même hôte
// Linux, donc c'est aussi le chemin que voit mGBA-http. En dev (Node sous
// Windows natif, mGBA-http dans WSL), ce chemin doit rester quelque part
// sous le disque Windows monté (ex. dans le dépôt) : WSL y accède alors via
// /mnt/c/... (drvfs, passthrough direct, sans cache), jamais via
// \\wsl.localhost\... (chemin réseau mis en cache côté Windows, qui ne
// reflète pas les réécritures fréquentes du fichier — testé et confirmé).
const nodeFramePath =
  process.env.POKEMON_NODE_FRAME_PATH || DEFAULT_CAPTURE_PATH;

// Chemin tel que mGBA-http doit écrire ce même fichier, vu depuis là où il
// tourne. Par défaut identique à nodeFramePath (hôte unique, prod). En dev,
// pointer vers l'équivalent /mnt/c/... du chemin ci-dessus.
const mgbaCapturePath =
  process.env.POKEMON_MGBA_CAPTURE_PATH || nodeFramePath;

const configuredIntervalMs = Math.max(
  parseInt(process.env.POKEMON_FRAME_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS,
  100
);

const state = {
  status: "starting",
  lastFrameAt: null,
  intervalMs: configuredIntervalMs,
  format: OUTPUT_FORMAT,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  error: "",
  hasFrame: false,
  frameSizeBytes: 0,
};

let latestFrameBuffer = null;
let captureInFlight = false;
let captureLoopStarted = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureOutputDirectory() {
  await fs.mkdir(path.dirname(nodeFramePath), { recursive: true });
}

async function waitForFrameFile() {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= FILE_WAIT_TIMEOUT_MS) {
    try {
      const stats = await fs.stat(nodeFramePath);
      if (stats.size > 0) {
        return stats;
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    await sleep(FILE_WAIT_INTERVAL_MS);
  }

  const timeoutError = new Error(
    "Le fichier de frame Pokémon n'a pas été généré à temps."
  );
  timeoutError.status = 504;
  throw timeoutError;
}

async function refreshFrame() {
  if (captureInFlight) return;
  captureInFlight = true;

  try {
    await ensureOutputDirectory();

    state.status = state.hasFrame ? "capturing" : "starting";
    state.error = "";

    await mgbaClient.requestScreenshot(mgbaCapturePath);
    await waitForFrameFile();
    const rawBuffer = await fs.readFile(nodeFramePath);
    const webpBuffer = await sharp(rawBuffer)
      .webp({ lossless: true })
      .toBuffer();

    latestFrameBuffer = webpBuffer;
    state.status = "ok";
    state.hasFrame = true;
    state.lastFrameAt = new Date().toISOString();
    state.frameSizeBytes = webpBuffer.length;
    state.error = "";
  } catch (error) {
    state.status = "error";
    state.error =
      error.details ||
      error.message ||
      "La capture de la frame Pokémon a échoué.";
  } finally {
    captureInFlight = false;
  }
}

function ensureCaptureLoopStarted() {
  if (captureLoopStarted) return;
  captureLoopStarted = true;

  refreshFrame().catch(() => {
    // L'état d'erreur est déjà mis à jour par le service.
  });

  setInterval(() => {
    refreshFrame().catch(() => {
      // L'état d'erreur est déjà mis à jour par le service.
    });
  }, configuredIntervalMs);
}

function getFrameStatus() {
  ensureCaptureLoopStarted();

  return {
    success: true,
    status: state.status,
    hasFrame: state.hasFrame,
    lastFrameAt: state.lastFrameAt,
    intervalMs: state.intervalMs,
    format: state.format,
    width: state.width,
    height: state.height,
    error: state.error,
    frameSizeBytes: state.frameSizeBytes,
  };
}

function getFrameBuffer() {
  ensureCaptureLoopStarted();

  if (!latestFrameBuffer) {
    const error = new Error(
      state.error || "Aucune frame Pokémon n'est disponible pour le moment."
    );
    error.status = 503;
    throw error;
  }

  return {
    buffer: latestFrameBuffer,
    format: state.format,
    lastFrameAt: state.lastFrameAt,
  };
}

module.exports = {
  getFrameBuffer,
  getFrameStatus,
};
