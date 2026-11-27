const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const framePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pkmn-")), "latest.png");
process.env.POKEMON_NODE_FRAME_PATH = framePath;

// Faux mGBA-http : chaque capture écrit une nouvelle image (couleur qui change).
let shots = 0;
let frozen = false;
const mgbaClient = require("./mgbaClient");
mgbaClient.requestScreenshot = async (outputPath) => {
  shots += 1;
  const png = await sharp({ create: { width: 240, height: 160, channels: 3, background: { r: frozen ? 7 : shots % 255, g: 0, b: 0 } } }).png().toBuffer();
  fs.writeFileSync(outputPath, png);
  return { ok: true };
};

const frames = require("./pokemonFrameService");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("cadence bornée entre 1 et le maximum", () => {
  assert.equal(frames.clampFps("20"), 20);
  assert.equal(frames.clampFps(500), frames.MAX_FPS);
  assert.equal(frames.clampFps(0.2), 1);
  assert.equal(frames.clampFps("abc"), null);
  assert.equal(frames.MAX_FPS, 30);
  assert.equal(frames.DEFAULT_FPS, 10);
  assert.equal(frames.clampFps(500, true), 60);
});

test("capture au rythme du spectateur le plus exigeant, au-delà de 10 img/s", async () => {
  assert.throws(() => frames.getFrameBuffer(25, "alice"), /frame/i); // pas encore d'image
  for (let i = 0; i < 50; i += 1) {
    try { frames.getFrameBuffer(25, "alice"); break; } catch { await sleep(20); }
  }
  const started = shots;
  for (let i = 0; i < 10; i += 1) {
    frames.getFrameBuffer(5, "bob");
    frames.getFrameBuffer(25, "alice");
    await sleep(100);
  }
  const status = frames.getFrameStatus();
  assert.equal(status.targetFps, 25);
  assert.equal(status.viewers, 2);
  assert.ok(shots - started >= 15, `seulement ${shots - started} captures en 1 s`);
  const frame = frames.getFrameBuffer(25, "alice");
  assert.equal(frame.format, "webp");
  assert.ok(frame.ageMs >= 0 && frame.ageMs < 1000);
});

test("une image identique garde son identifiant et n'est pas ré-encodée", async () => {
  frozen = true;
  await sleep(300);
  const first = frames.getFrameBuffer(30, "alice");
  await sleep(300);
  const second = frames.getFrameBuffer(30, "alice");
  assert.equal(second.frameId, first.frameId);
  assert.equal(second.buffer, first.buffer); // même objet : pas de ré-encodage
  assert.ok(second.ageMs < 200, "l'âge suit la dernière capture, pas le dernier changement");
  assert.ok(frames.getFrameStatus().unchangedRatio > 0); // fenêtre de 3 s, mêlée au test précédent

  frozen = false;
  await sleep(200);
  assert.notEqual(frames.getFrameBuffer(30, "alice").frameId, first.frameId);
});

test("un abonné au flux reçoit chaque image différente, sans rien demander", async () => {
  frozen = false;
  const received = [];
  const unsubscribe = frames.subscribe({ fps: 30, viewer: "carol", onFrame: (f) => received.push(f.id) });
  await sleep(500);
  assert.ok(received.length >= 8, `seulement ${received.length} images reçues en 0,5 s`);
  assert.equal(new Set(received).size, received.length, "jamais deux fois la même");
  assert.equal(frames.getFrameStatus().streams, 1);

  frozen = true;
  await sleep(200);
  const countWhenFrozen = received.length;
  await sleep(300);
  assert.ok(received.length - countWhenFrozen <= 1, "rien n'est publié quand l'image ne change pas");

  unsubscribe();
  assert.equal(frames.getFrameStatus().streams, 0);
  frozen = false;
});

test("la capture partagée adopte la cible admin tant que le flux est ouvert", () => {
  const publicStream = frames.subscribe({ fps: 60, viewer: "joueur", onFrame() {} });
  const adminStream = frames.subscribe({ fps: 60, viewer: "admin", onFrame() {}, experimental: true });
  try {
    assert.equal(frames.targetFps(), 60);
  } finally {
    adminStream();
  }
  try {
    assert.equal(frames.targetFps(), 30);
  } finally {
    publicStream();
  }
});
