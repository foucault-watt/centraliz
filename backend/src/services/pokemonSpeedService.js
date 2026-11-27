const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { setTimeout: delay } = require("node:timers/promises");

const run = promisify(execFile);
const SPEEDS = new Map([[1, "ctrl+alt+1"], [1.5, "ctrl+alt+2"], [2, "ctrl+alt+3"]]);
const display = process.env.POKEMON_SPEED_DISPLAY;
let changing = false;

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

async function xdotool(...args) {
  try {
    const { stdout } = await run("xdotool", args, {
      env: { ...process.env, DISPLAY: display },
      timeout: 1000,
    });
    return stdout.trim();
  } catch {
    throw fail(503, "La commande de vitesse du jeu ne répond pas.");
  }
}

async function gameWindow() {
  const id = await xdotool("search", "--onlyvisible", "--name", "^mGBA - ");
  if (!/^\d+$/.test(id)) throw fail(503, "La fenêtre du jeu est introuvable.");
  return id;
}

async function readSpeed(id) {
  const title = await xdotool("getwindowname", id);
  const fps = Number(title.match(/\(([\d.]+) fps\) - /)?.[1]);
  return [...SPEEDS.keys()].find((speed) => Math.abs(speed * 60 - fps) <= 8) ?? null;
}

async function getSpeed() {
  if (!display) return { available: false };
  return { available: true, speed: changing ? null : await readSpeed(await gameWindow()) };
}

async function setSpeed(speed) {
  if (!SPEEDS.has(speed)) throw fail(400, "Vitesse invalide.");
  if (!display) throw fail(503, "Le réglage de vitesse est indisponible.");
  if (changing) throw fail(409, "La vitesse est déjà en cours de changement.");
  changing = true;
  try {
    const id = await gameWindow();
    if (await readSpeed(id) === speed) return { available: true, speed };
    // Ne pas déplacer le focus d'un menu ou d'une boîte de dialogue ouverte.
    if (await xdotool("getactivewindow") !== id) {
      throw fail(503, "La fenêtre du jeu est occupée.");
    }
    await xdotool("key", SPEEDS.get(speed));
    // Le titre affiche une moyenne et met quelques secondes à se stabiliser.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await delay(500);
      if (await readSpeed(id) === speed) return { available: true, speed };
    }
    throw fail(503, "Impossible de confirmer la nouvelle vitesse du jeu.");
  } finally {
    changing = false;
  }
}

module.exports = { getSpeed, setSpeed };
