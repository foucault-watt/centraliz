const test = require("node:test");
const assert = require("node:assert");
const sharp = require("sharp");
const { changedRect, cropRaw, createDeltaEncoder, DELTA_CACHE_LIMIT } = require("./pokemonDelta");

test("rectangle minimal des pixels changés", () => {
  const a = Buffer.alloc(10 * 6 * 3);
  const b = Buffer.from(a);
  assert.equal(changedRect(a, b, 10, 6, 3), null);
  b[(2 * 10 + 7) * 3 + 2] = 1; // pixel (7, 2), canal bleu
  b[(4 * 10 + 3) * 3] = 1; // pixel (3, 4)
  assert.deepEqual(changedRect(a, b, 10, 6, 3), { x: 3, y: 2, w: 5, h: 3 });
});

test("découpe puis encode un rectangle webp lossless relisible", async () => {
  const width = 240;
  const height = 160;
  const channels = 3;
  const base = { id: "a", raw: Buffer.alloc(width * height * channels, 50), width, height, channels };
  const raw = Buffer.from(base.raw);
  for (let y = 40; y < 56; y += 1) {
    for (let x = 100; x < 120; x += 1) raw.fill(200 + (x % 3), (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  const target = { id: "b", raw, width, height, channels };
  const rect = await createDeltaEncoder().delta(base, target);
  assert.deepEqual([rect.x, rect.y, rect.w, rect.h], [100, 40, 20, 16]);
  const { data, info } = await sharp(Buffer.from(rect.base64, "base64")).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [20, 16]);
  assert.ok(data.equals(cropRaw(raw, width, channels, rect)), "lossless");
});

test("tailles différentes : pas de delta", async () => {
  const deltas = createDeltaEncoder({ encodeRect: async () => Buffer.alloc(1) });
  const a = { id: "a", raw: Buffer.alloc(12), width: 2, height: 2, channels: 3 };
  const b = { id: "b", raw: Buffer.alloc(16), width: 2, height: 2, channels: 4 };
  assert.equal(await deltas.delta(a, b), null);
});

test("cache borné", async () => {
  const deltas = createDeltaEncoder({ encodeRect: async () => Buffer.alloc(1) });
  const base = { id: "base", raw: Buffer.alloc(3), width: 1, height: 1, channels: 3 };
  for (let i = 0; i < DELTA_CACHE_LIMIT + 10; i += 1) {
    await deltas.delta(base, { id: `f${i}`, raw: Buffer.from([i + 1, 0, 0]), width: 1, height: 1, channels: 3 });
  }
  assert.equal(deltas.size(), DELTA_CACHE_LIMIT);
});
