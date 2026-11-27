const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require("events");
const { createSseSender } = require("./pokemonSse");

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
  const sender = createSseSender(res, { fps: 10, now: () => now, setTimer: (fn, ms) => { timers.push(fn); return 1; }, clearTimer: () => {} });

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
  const sender = createSseSender(res, { fps: 30, now: () => now });
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
  const sender = createSseSender(res, { fps: 30, now: () => now });
  sender.offer(frame("a"));
  now += 100;
  sender.offer(frame("a"));
  assert.deepEqual(ids(res), ["a"]);
});
