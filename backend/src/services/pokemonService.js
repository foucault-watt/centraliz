const mgbaClient = require("./mgbaClient");
const pokemonFrameService = require("./pokemonFrameService");

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

  await mgbaClient.sendButton(luaButtonName);

  return {
    success: true,
    button: normalizedButton,
    mappedButton: luaButtonName,
    message: `Bouton ${normalizedButton} envoyé à l'émulateur.`,
  };
}

module.exports = {
  ALLOWED_BUTTONS,
  getFrameBuffer: pokemonFrameService.getFrameBuffer,
  getFrameStatus: pokemonFrameService.getFrameStatus,
  getHealth,
  sendInput,
};
