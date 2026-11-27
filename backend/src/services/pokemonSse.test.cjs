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
  const res = fakeRes();
  const sender = createSseSender(res, {
    fps: 30,
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
  const sender = createSseSender(res, { fps: 30, padBytes: 0, now: () => now });
  for (const id of ["a", "b", "c", "a", "b"]) {
    now += 100;
    sender.offer(frame(id));
  }
  assert.deepEqual(ids(res), ["a", "b", "c", "a", "b"]);
  const events = res.writes.map((w) => /event: (\w+)/.exec(w)[1]);
  assert.deepEqual(events, ["frame", "frame", "frame", "ref", "ref"]);
  assert.doesNotMatch(res.writes[3], /img/);
  assert.equal(sender.stats.refs, 2);
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
