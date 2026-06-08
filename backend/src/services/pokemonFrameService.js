const fs = require("fs").promises;
const path = require("path");
const mgbaClient = require("./mgbaClient");

const DEFAULT_INTERVAL_MS = 250;
const DEFAULT_FRAME_FORMAT = "png";
const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 160;
const FILE_WAIT_TIMEOUT_MS = 1500;
const FILE_WAIT_INTERVAL_MS = 75;

const DEFAULT_OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "data",
  "pokemon-stream",
  `latest.${DEFAULT_FRAME_FORMAT}`
);

const configuredOutputPath =
  process.env.POKEMON_FRAME_OUTPUT_PATH || DEFAULT_OUTPUT_PATH;
const configuredFrameFormat =
  String(process.env.POKEMON_FRAME_FORMAT || DEFAULT_FRAME_FORMAT).toLowerCase() ||
  DEFAULT_FRAME_FORMAT;
const configuredIntervalMs = Math.max(
  parseInt(process.env.POKEMON_FRAME_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS,
  250
);

const state = {
  status: "starting",
  lastFrameAt: null,
  intervalMs: configuredIntervalMs,
  format: configuredFrameFormat,
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

function toWslPathFromWindowsPath(filePath) {
  const driveMatch = String(filePath).match(/^([A-Za-z]):\\(.*)$/);
  if (!driveMatch) {
    return String(filePath).replace(/\\/g, "/");
  }

  const [, driveLetter, rest] = driveMatch;
  return `/mnt/${driveLetter.toLowerCase()}/${rest.replace(/\\/g, "/")}`;
}

function resolveCapturePath() {
  if (process.env.POKEMON_FRAME_CAPTURE_PATH) {
    return process.env.POKEMON_FRAME_CAPTURE_PATH;
  }

  if (process.platform === "win32") {
    return toWslPathFromWindowsPath(configuredOutputPath);
  }

  return configuredOutputPath;
}

async function ensureOutputDirectory() {
  await fs.mkdir(path.dirname(configuredOutputPath), { recursive: true });
}

async function waitForFrameFile() {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= FILE_WAIT_TIMEOUT_MS) {
    try {
      const stats = await fs.stat(configuredOutputPath);
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

    await mgbaClient.requestScreenshot(resolveCapturePath());
    const stats = await waitForFrameFile();
    latestFrameBuffer = await fs.readFile(configuredOutputPath);

    state.status = "ok";
    state.hasFrame = true;
    state.lastFrameAt = new Date().toISOString();
    state.frameSizeBytes = stats.size;
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
