const sharp = require("sharp");
const { createFrameBus } = require("./pokemonFrameBus");

// Écran de démo pour le développement local : il n'y a pas d'émulateur sur
// le poste de dev. Un petit personnage se déplace avec la croix et le
// dernier bouton s'affiche, pour voir que la manette fonctionne.
//
// Actif seulement quand URL_FRONT pointe sur localhost (jamais en prod).
// POKEMON_DEMO=false force le vrai mGBA-http, POKEMON_DEMO=true force la démo.

const WIDTH = 240;
const HEIGHT = 160;
const TILE = 16;
const COLS = WIDTH / TILE; // 15
const ROWS = 7; // le bas de l'écran est réservé à la boîte de texte

const MOVES = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };

function isDemoMode(env = process.env) {
  if (env.POKEMON_DEMO === "true") return true;
  if (env.POKEMON_DEMO === "false") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(env.URL_FRONT || "");
}

const state = { x: 7, y: 3, facing: "DOWN", lastButton: "", presses: 0 };
let frame = null;
const bus = createFrameBus();
let rendering = null;

function applyButton(button) {
  const move = MOVES[button];
  if (move) {
    state.facing = button;
    state.x = Math.min(COLS - 1, Math.max(0, state.x + move[0]));
    state.y = Math.min(ROWS - 1, Math.max(0, state.y + move[1]));
  }
  state.lastButton = button;
  state.presses += 1;
  return { ...state };
}

const escapeXml = (text) =>
  String(text).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

function buildSvg(s = state) {
  const px = s.x * TILE;
  const py = s.y * TILE;
  const eye = { UP: null, DOWN: [5, 11], LEFT: [4, 4], RIGHT: [12, 12] }[s.facing];
  const message = s.lastButton
    ? `Bouton ${s.lastButton} (${s.presses})`
    : "Appuyer sur un bouton";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" shape-rendering="crispEdges">
  <defs>
    <pattern id="grass" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#78c850"/>
      <rect x="3" y="4" width="2" height="2" fill="#5fa83e"/>
      <rect x="11" y="10" width="2" height="2" fill="#5fa83e"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grass)"/>
  <rect x="0" y="${3 * TILE}" width="${WIDTH}" height="${TILE}" fill="#e8d8a0"/>
  <rect x="${px + 3}" y="${py + 2}" width="10" height="12" rx="2" fill="#e04040"/>
  <rect x="${px + 4}" y="${py + 1}" width="8" height="5" fill="#f8d0a0"/>
  ${eye ? `<rect x="${px + eye[0]}" y="${py + 3}" width="2" height="2" fill="#202020"/><rect x="${px + eye[1] - 1}" y="${py + 3}" width="2" height="2" fill="#202020"/>` : ""}
  <rect x="4" y="${ROWS * TILE + 4}" width="${WIDTH - 8}" height="${HEIGHT - ROWS * TILE - 8}" rx="4" fill="#ffffff" stroke="#384878" stroke-width="3"/>
  <text x="14" y="${ROWS * TILE + 22}" font-family="Verdana, sans-serif" font-size="11" font-weight="bold" fill="#384878">MODE DÉMO (local)</text>
  <text x="14" y="${ROWS * TILE + 40}" font-family="Verdana, sans-serif" font-size="11" fill="#303030">${escapeXml(message)}</text>
</svg>`;
}

async function render() {
  const svg = buildSvg();
  const buffer = await sharp(Buffer.from(svg)).webp({ lossless: true }).toBuffer();
  frame = { buffer, format: "webp", lastFrameAt: new Date().toISOString() };
  bus.publish({ id: `demo-${state.presses}`, buffer, capturedAt: Date.now() });
  return frame;
}

function ensureRendered() {
  if (!rendering) rendering = render().finally(() => { rendering = null; });
  return rendering;
}

async function sendInput(button) {
  applyButton(button);
  await render();
}

function getFrameBuffer() {
  if (!frame) {
    ensureRendered();
    const error = new Error("L'écran de démo se prépare.");
    error.status = 503;
    throw error;
  }
  return { ...frame, frameId: `demo-${state.presses}`, ageMs: Date.now() - Date.parse(frame.lastFrameAt) };
}

function getFrameStatus() {
  if (!frame) ensureRendered();
  return {
    success: true,
    status: frame ? "ok" : "starting",
    hasFrame: Boolean(frame),
    lastFrameAt: frame ? frame.lastFrameAt : null,
    intervalMs: 100,
    format: "webp",
    width: WIDTH,
    height: HEIGHT,
    error: "",
    frameSizeBytes: frame ? frame.buffer.length : 0,
    demo: true,
  };
}

function subscribe({ fps, viewer, onFrame }) {
  const unsubscribe = bus.subscribe({ fps, viewer, onFrame });
  if (!frame) ensureRendered();
  return unsubscribe;
}

function resetForTests() {
  Object.assign(state, { x: 7, y: 3, facing: "DOWN", lastButton: "", presses: 0 });
  frame = null;
}

module.exports = {
  subscribe,
  isDemoMode,
  applyButton,
  buildSvg,
  ensureRendered,
  sendInput,
  getFrameBuffer,
  getFrameStatus,
  resetForTests,
};
