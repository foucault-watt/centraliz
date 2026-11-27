const mgbaClient = require("./mgbaClient");
const pokemonFrameService = require("./pokemonFrameService");
const pokemonDemoService = require("./pokemonDemoService");

// En local (URL_FRONT sur localhost), pas d'émulateur : écran de démo.
const demo = pokemonDemoService.isDemoMode();
if (demo) {
  console.log("[Pokémon] Mode démo local : écran simulé, pas de mGBA-http.");
  pokemonDemoService.ensureRendered().catch(() => {});
}

const ALLOWED_BUTTONS = [
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "A",
  "B",
  "START",
];

const allowedButtonsSet = new Set(ALLOWED_BUTTONS);
const BUTTON_TO_LUA_NAME = {
  UP: "Up",
  DOWN: "Down",
  LEFT: "Left",
  RIGHT: "Right",
  A: "A",
  B: "B",
  START: "Start",
};

function normalizeButton(button) {
  return String(button || "")
    .trim()
    .toUpperCase();
}

async function getHealth() {
  if (demo) {
    return { success: true, status: "ok", demo: true, acceptedButtons: ALLOWED_BUTTONS };
  }
  const health = await mgbaClient.getHealth();

  return {
    success: true,
    status: "ok",
    baseUrl: health.baseUrl,
    acceptedButtons: ALLOWED_BUTTONS,
  };
}

async function sendInput(button) {
  const normalizedButton = normalizeButton(button);

  if (!allowedButtonsSet.has(normalizedButton)) {
    const error = new Error("Bouton invalide.");
    error.status = 400;
    error.acceptedButtons = ALLOWED_BUTTONS;
    throw error;
  }

  const luaButtonName = BUTTON_TO_LUA_NAME[normalizedButton];

  if (demo) {
    await pokemonDemoService.sendInput(normalizedButton);
  } else {
    await mgbaClient.sendButton(luaButtonName);
  }

  return {
    success: true,
    button: normalizedButton,
    mappedButton: luaButtonName,
    message: `Bouton ${normalizedButton} envoyé à l'émulateur.`,
  };
}

module.exports = {
  ALLOWED_BUTTONS,
  isDemo: demo,
  subscribe: demo ? pokemonDemoService.subscribe : pokemonFrameService.subscribe,
  clampFps: pokemonFrameService.clampFps,
  getFrameBuffer: demo ? pokemonDemoService.getFrameBuffer : pokemonFrameService.getFrameBuffer,
  getFrameStatus: demo ? pokemonDemoService.getFrameStatus : pokemonFrameService.getFrameStatus,
  getHealth,
  hasRecentCapture: pokemonFrameService.hasRecentCapture,
  sendInput,
};
