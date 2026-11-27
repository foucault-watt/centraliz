const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require("events");
const { createSseSender, padBytesFromEnv, SEEN_LIMIT } = require("./pokemonSse");

// Faux res : enregistre les écritures ; `accept` simule un tampon plein.
function fakeRes() {
  const res = new EventEmitter();
  res.writes = [];
  res.accept = true;
  res.write = (chunk) => { res.writes.push(chunk); return res.accept; };
  return res;
}
const frame = (id) => ({ id, buffer: Buffer.from(`img-${id}`), capturedAt: 1000 });
const ids = (res) => res.writes.map((w) => /^id: (\S+)/.exec(w)[1]);

test("plafonne la cadence et n'envoie que la dernière image en attente", () => {
  let now = 1000;
  const timers = [];
  const res = fakeRes();
  const sender = createSseSender(res, { fps: 10, padBytes: 0, now: () => now, setTimer: (fn, ms) => { timers.push(fn); return 1; }, clearTimer: () => {} });

  sender.offer(frame("a")); // part tout de suite
  now += 20;
  sender.offer(frame("b")); // trop tôt : en attente
  sender.offer(frame("c")); // remplace b, jamais envoyée
  assert.deepEqual(ids(res), ["a"]);
  now += 100;
  timers.shift()();
  assert.deepEqual(ids(res), ["a", "c"]);
  assert.equal(sender.stats.skipped, 1);
  assert.match(res.writes[1], /event: frame\ndata: \{"id":"c","ageMs":\d+,"img":"aW1nLWM="\}\n\n$/);
});

test("client lent : attend drain, sans accumuler", () => {
  let now = 0;
  const res = fakeRes();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now });
  res.accept = false;
  sender.offer(frame("a"));
  now += 100;
  sender.offer(frame("b"));
  sender.offer(frame("c"));
  assert.deepEqual(ids(res), ["a"]); // bloqué tant que pas de drain
  res.accept = true;
  res.emit("drain");
  assert.deepEqual(ids(res), ["a", "c"]);
});

test("n'envoie pas deux fois la même image", () => {
  let now = 0;
  const res = fakeRes();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now });
  sender.offer(frame("a"));
  now += 100;
  sender.offer(frame("a"));
  assert.deepEqual(ids(res), ["a"]);
});

test("bourre après une image suivie d'un silence, pour la sortir des tampons des proxys", () => {
  let now = 0;
  const timers = [];
  const writes = [];
  const res = fakeRes();
  const sender = createSseSender(res, {
    fps: 30,
    onTraffic: (bytes, frames) => writes.push([bytes, frames]),
    padBytes: 64,
    now: () => now,
    setTimer: (fn) => { timers.push(fn); return timers.length; },
    clearTimer: (id) => { timers[id - 1] = null; },
  });
  sender.offer(frame("a")); // première image : bourrage prévu
  now += 40;
  sender.offer(frame("b")); // une autre suit vite : le bourrage de "a" est annulé
  timers.filter(Boolean).forEach((fn) => fn());
  const paddings = res.writes.filter((w) => w.startsWith(": "));
  assert.equal(paddings.length, 1, "un seul bourrage, après la dernière image");
  assert.equal(res.writes[res.writes.length - 1], paddings[0]);
  assert.ok(paddings[0].length >= 64 && paddings[0].endsWith("\n\n"));
  assert.equal(sender.stats.padded, 1);
  assert.deepEqual(writes, res.writes.map((chunk) => [Buffer.byteLength(chunk), chunk.startsWith(":") ? 0 : 1]));
});

test("pas de bourrage si désactivé", () => {
  const res = fakeRes();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, setTimer: () => { throw new Error("aucun minuteur attendu"); } });
  sender.offer(frame("a"));
  assert.equal(res.writes.filter((w) => w.startsWith(": ")).length, 0);
});

test("image déjà envoyée sur cette connexion : seulement son identifiant", () => {
  let now = 0;
  const res = fakeRes();
  const writes = [];
  const sender = createSseSender(res, {
    fps: 30,
    padBytes: 0,
    now: () => now,
    onTraffic: (bytes, frames) => writes.push([bytes, frames]),
  });
  for (const id of ["a", "b", "c", "a", "b"]) {
    now += 100;
    sender.offer(frame(id));
  }
  assert.deepEqual(ids(res), ["a", "b", "c", "a", "b"]);
  const events = res.writes.map((w) => /event: (\w+)/.exec(w)[1]);
  assert.deepEqual(events, ["frame", "frame", "frame", "ref", "ref"]);
  assert.doesNotMatch(res.writes[3], /img/);
  assert.equal(sender.stats.refs, 2);
  assert.deepEqual(writes, res.writes.map((chunk) => [Buffer.byteLength(chunk), 1]));
});

test("oublie les images trop anciennes et les renvoie entières", () => {
  let now = 0;
  const res = fakeRes();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now });
  for (let i = 0; i <= SEEN_LIMIT; i += 1) {
    now += 100;
    sender.offer(frame(`f${i}`));
  }
  now += 100;
  sender.offer(frame("f0")); // sortie du cache : renvoyée entière
  assert.match(res.writes.at(-1), /event: frame/);
  now += 100;
  sender.offer(frame(`f${SEEN_LIMIT}`)); // encore connue
  assert.match(res.writes.at(-1), /event: ref/);
});

test("POKEMON_SSE_PAD_BYTES=0 coupe le bourrage", () => {
  assert.equal(padBytesFromEnv("0"), 0);
  assert.equal(padBytesFromEnv(undefined), 16384);
  assert.equal(padBytesFromEnv("8192"), 8192);
  assert.equal(padBytesFromEnv("999999"), 65536);
});

// --- Rectangle modifié (événement « delta ») ---

const { createDeltaEncoder } = require("./pokemonDelta");
const W = 8;
const H = 4;
// Image brute W×H en RGB, tous pixels à `fill`, sauf `dots` [[x, y, valeur]].
function rawFrame(id, fill = 0, dots = [], bytes = 400) {
  const raw = Buffer.alloc(W * H * 3, fill);
  for (const [x, y, v] of dots) raw.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3);
  return { id, buffer: Buffer.alloc(bytes, id.charCodeAt(0)), capturedAt: 1000, raw, width: W, height: H, channels: 3 };
}
// Encodeur factice : 1 octet par pixel, appels comptés, résolution manuelle possible.
// Sans plafond de surface par défaut : on teste ici la comparaison des tailles.
function fakeEncoder({ manual = false, maxAreaRatio = 1 } = {}) {
  const calls = [];
  const deltas = createDeltaEncoder({
    maxAreaRatio,
    encodeRect: (pixels, rect) => new Promise((resolve) => {
      const done = () => resolve(Buffer.alloc(rect.w * rect.h, 1));
      calls.push({ rect, done });
      if (!manual) done();
    }),
  });
  return { deltas, calls };
}
const tick = () => new Promise((r) => setImmediate(r));
const events = (res) => res.writes.filter((w) => !w.startsWith(":")).map((w) => /event: (\w+)/.exec(w)[1]);
const dataOf = (chunk) => JSON.parse(/data: (.*)\n\n$/.exec(chunk)[1]);

test("delta : le rectangle modifié depuis l'image envoyée, si plus léger", async () => {
  let now = 0;
  const res = fakeRes();
  const { deltas } = fakeEncoder();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  sender.offer(rawFrame("a")); // première image : entière
  now += 100;
  sender.offer(rawFrame("b", 0, [[2, 1, 9], [4, 2, 9]]));
  await tick();
  assert.deepEqual(events(res), ["frame", "delta"]);
  const d = dataOf(res.writes[1]);
  assert.deepEqual({ id: d.id, baseId: d.baseId, x: d.x, y: d.y, w: d.w, h: d.h }, { id: "b", baseId: "a", x: 2, y: 1, w: 3, h: 2 });
  assert.equal(Buffer.from(d.img, "base64").length, 6);
  assert.match(res.writes[1], /^id: b\nevent: delta\ndata: \{"id":"b","baseId":"a","x":2,"y":1,"w":3,"h":2,"ageMs":\d+,"img":"[^"]+"\}\n\n$/);
  const full = Buffer.alloc(400).toString("base64").length;
  assert.equal(sender.stats.deltas, 1);
  assert.equal(sender.stats.bytesSaved, full - d.img.length);
  assert.equal(sender.stats.sent, 2);
});

test("delta : une image sautée n'est jamais la base, seulement la dernière vraiment envoyée", async () => {
  let now = 0;
  const timers = [];
  const res = fakeRes();
  const { deltas } = fakeEncoder();
  const sender = createSseSender(res, { fps: 10, padBytes: 0, now: () => now, deltas, setTimer: (fn) => { timers.push(fn); return 1; }, clearTimer: () => {} });
  sender.offer(rawFrame("a"));
  now += 20;
  sender.offer(rawFrame("b", 0, [[0, 0, 5]])); // sautée
  sender.offer(rawFrame("c", 0, [[0, 0, 5], [7, 3, 5]]));
  now += 100;
  timers.shift()();
  await tick();
  const d = dataOf(res.writes[1]);
  assert.equal(d.id, "c");
  assert.equal(d.baseId, "a");
  assert.deepEqual([d.x, d.y, d.w, d.h], [0, 0, 8, 4]); // couvre les deux points depuis "a"
});

test("delta : rectangle plus lourd que l'image entière -> image entière", async () => {
  let now = 0;
  const res = fakeRes();
  const { deltas } = fakeEncoder();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  sender.offer(rawFrame("a", 0, [], 10));
  now += 100;
  sender.offer(rawFrame("b", 7, [], 10)); // tout change : 32 octets de rect > 10 octets d'image
  await tick();
  assert.deepEqual(events(res), ["frame", "frame"]);
  assert.equal(sender.stats.deltas, 0);
  // La base est bien "b" : le delta suivant part de lui.
  now += 100;
  sender.offer(rawFrame("c", 7, [[1, 1, 0]], 400));
  await tick();
  assert.equal(dataOf(res.writes[2]).baseId, "b");
});

test("delta : rectangle couvrant presque tout l'écran (marche) -> image entière, sans encodage", async () => {
  let now = 0;
  const res = fakeRes();
  const { deltas, calls } = fakeEncoder({ maxAreaRatio: 0.9 });
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  sender.offer(rawFrame("a"));
  now += 100;
  sender.offer(rawFrame("b", 0, [[0, 0, 1], [7, 3, 1]]));
  await tick();
  assert.deepEqual(events(res), ["frame", "frame"]);
  assert.equal(calls.length, 0);
  assert.equal(deltas.stats().tooLarge, 1);
});

test("delta : pixels identiques malgré un id différent -> image entière", async () => {
  let now = 0;
  const res = fakeRes();
  const { deltas, calls } = fakeEncoder();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  sender.offer(rawFrame("a"));
  now += 100;
  sender.offer(rawFrame("b"));
  await tick();
  assert.deepEqual(events(res), ["frame", "frame"]);
  assert.equal(calls.length, 0, "rien à encoder");
});

test("delta : une ref remet la base sur l'image réaffichée", async () => {
  let now = 0;
  const res = fakeRes();
  const { deltas } = fakeEncoder();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  const send = async (f) => { now += 100; sender.offer(f); await tick(); };
  await send(rawFrame("a"));
  await send(rawFrame("b", 0, [[3, 3, 1]]));
  await send(rawFrame("a")); // ref
  await send(rawFrame("c", 0, [[6, 0, 2]]));
  assert.deepEqual(events(res), ["frame", "delta", "ref", "delta"]);
  const d = dataOf(res.writes[3]);
  assert.equal(d.baseId, "a");
  assert.deepEqual([d.x, d.y, d.w, d.h], [6, 0, 1, 1]); // depuis "a", pas depuis "b"
  // Image reconstituée par un delta : connue ensuite, envoyée en ref.
  await send(rawFrame("b", 0, [[3, 3, 1]]));
  assert.equal(events(res).at(-1), "ref");
});

test("delta : pas de file pendant l'encodage, seule la dernière image attend", async () => {
  let now = 0;
  const res = fakeRes();
  const { deltas, calls } = fakeEncoder({ manual: true });
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  sender.offer(rawFrame("a"));
  now += 100;
  sender.offer(rawFrame("b", 0, [[1, 1, 1]])); // en cours d'encodage
  now += 100;
  sender.offer(rawFrame("c", 0, [[2, 2, 2]])); // en attente
  sender.offer(rawFrame("d", 0, [[3, 3, 3]])); // remplace c
  await tick();
  assert.deepEqual(events(res), ["frame"]);
  assert.equal(calls.length, 1);
  calls[0].done();
  await tick();
  assert.deepEqual(ids(res), ["a", "b"]);
  assert.equal(calls.length, 2, "d est encodée depuis b, c sautée");
  calls[1].done();
  await tick();
  assert.deepEqual(ids(res), ["a", "b", "d"]);
  assert.equal(dataOf(res.writes[2]).baseId, "b");
  assert.equal(sender.stats.skipped, 1);
});

test("delta : connexion fermée pendant l'encodage -> rien n'est écrit", async () => {
  let now = 0;
  const res = fakeRes();
  const { deltas, calls } = fakeEncoder({ manual: true });
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  sender.offer(rawFrame("a"));
  now += 100;
  sender.offer(rawFrame("b", 0, [[1, 1, 1]]));
  await tick();
  sender.close();
  calls[0].done();
  await tick();
  assert.equal(res.writes.length, 1);
});

test("delta : encodage en échec -> image entière", async () => {
  let now = 0;
  const res = fakeRes();
  const deltas = createDeltaEncoder({ encodeRect: async () => { throw new Error("boom"); } });
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  sender.offer(rawFrame("a"));
  now += 100;
  sender.offer(rawFrame("b", 0, [[1, 1, 1]]));
  await tick();
  assert.deepEqual(events(res), ["frame", "frame"]);
});

test("delta : calcul partagé entre connexions de même base", async () => {
  let now = 0;
  const { deltas, calls } = fakeEncoder();
  const conns = [fakeRes(), fakeRes(), fakeRes()].map((res) => ({ res, sender: createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas }) }));
  const a = rawFrame("a");
  const b = rawFrame("b", 0, [[1, 1, 1]]);
  conns.forEach(({ sender }) => sender.offer(a));
  now += 100;
  conns.forEach(({ sender }) => sender.offer(b));
  await tick();
  assert.equal(calls.length, 1, "un seul encodage pour trois spectateurs");
  conns.forEach(({ res }) => assert.deepEqual(events(res), ["frame", "delta"]));
  assert.equal(deltas.stats().computed, 1);
  assert.equal(deltas.stats().shared, 2);
});

test("delta : images sans pixels bruts (démo) -> image entière", async () => {
  let now = 0;
  const res = fakeRes();
  const { deltas, calls } = fakeEncoder();
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now, deltas });
  sender.offer(frame("a"));
  now += 100;
  sender.offer(frame("b"));
  await tick();
  assert.deepEqual(events(res), ["frame", "frame"]);
  assert.equal(calls.length, 0);
});
