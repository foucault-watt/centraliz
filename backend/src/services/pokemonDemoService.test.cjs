const test = require("node:test");
const assert = require("node:assert");
const demo = require("./pokemonDemoService");

test("mode démo uniquement quand le frontend est en local", () => {
  assert.equal(demo.isDemoMode({ URL_FRONT: "http://localhost:3000" }), true);
  assert.equal(demo.isDemoMode({ URL_FRONT: "http://127.0.0.1:3000/" }), true);
  assert.equal(demo.isDemoMode({ URL_FRONT: "https://centraliz.it" }), false);
  assert.equal(demo.isDemoMode({ URL_FRONT: "https://localhost.evil.com" }), false);
  assert.equal(demo.isDemoMode({}), false);
  assert.equal(demo.isDemoMode({ URL_FRONT: "http://localhost:3000", POKEMON_DEMO: "false" }), false);
  assert.equal(demo.isDemoMode({ URL_FRONT: "https://centraliz.it", POKEMON_DEMO: "true" }), true);
});

test("la croix déplace le personnage sans sortir de l'écran", () => {
  demo.resetForTests();
  assert.deepEqual([demo.applyButton("RIGHT").x, demo.applyButton("UP").y], [8, 2]);
  for (let i = 0; i < 30; i += 1) demo.applyButton("LEFT");
  const s = demo.applyButton("A");
  assert.equal(s.x, 0);
  assert.equal(s.lastButton, "A");
});

test("l'écran affiche le dernier bouton et produit une image", async () => {
  demo.resetForTests();
  await demo.sendInput("START");
  assert.match(demo.buildSvg(), /Bouton START \(1\)/);
  const frame = demo.getFrameBuffer();
  assert.equal(frame.format, "webp");
  assert.ok(frame.buffer.length > 100);
  require("fs").writeFileSync(process.env.DEMO_PREVIEW || require("os").tmpdir() + "/pokemon-demo.webp", frame.buffer);
});
