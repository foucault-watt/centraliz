const test = require("node:test");
const assert = require("node:assert/strict");
require.cache[require.resolve("../utils/supabaseClient")] = { exports: {} };
const sessions = require("./pokemonSessions");
const analyticsService = require("./analyticsService");

const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0";
const alice = { userName: "alice" };
const bob = { userName: "bob" };
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);

function setup() {
  sessions.resetForTests();
  const rows = [];
  sessions.setRecorder((row) => rows.push(row));
  return rows;
}

// Un tic toutes les 3 s pendant `seconds` secondes, comme le flux SSE.
function watchFor(context, start, seconds, mode = "sse") {
  for (let t = 0; t <= seconds * 1000; t += 3000) sessions.noteWatch(context, mode, start + t);
  return start + seconds * 1000;
}

test("une session regardée puis jouée donne une seule ligne agrégée", () => {
  const rows = setup();
  const pc = { user: alice, sessionId: "s1", userAgent: PC };
  sessions.streamOpened(pc, T0);
  const end = watchFor(pc, T0, 120);
  // Dix boutons en dix secondes : une seule fenêtre de jeu de 40 s.
  for (let i = 0; i < 10; i += 1) sessions.noteInput(pc, i % 2 ? "A" : "UP", T0 + 30000 + i * 1000);
  sessions.noteStreamTraffic(pc, 500000, 400, end);
  sessions.streamClosed(pc, end);
  sessions.noteClientSummary(pc, {
    bytes: 480000,
    frames: 360,
    rttHist: [0, 8, 1, 1, 0, 0, 0, 0, 0, 0],
    rttSum: 1100,
    delayCount: 10,
    delaySum: 900,
  }, end);

  assert.deepEqual(sessions.sweep(end + sessions.IDLE_MS - 1000), [], "pas encore inactive");
  sessions.sweep(end + sessions.IDLE_MS);
  assert.equal(rows.length, 1);
  const { userUsername, properties: p } = rows[0];
  assert.equal(userUsername, "alice");
  assert.equal(p.watched_s, 120);
  assert.equal(p.played_s, 39); // 9 s entre le premier et le dernier bouton + 30 s
  assert.equal(p.inputs, 10);
  assert.deepEqual(p.buttons, [5, 0, 0, 0, 5, 0, 0]);
  assert.equal(p.device, "desktop");
  assert.equal(p.mode, "sse");
  assert.equal(p.server_bytes, 500000);
  assert.equal(p.server_frames, 400);
  assert.equal(p.client_frames, 360);
  assert.equal(p.fps, 3);
  assert.equal(p.rtt_avg_ms, 110);
  assert.equal(sessions.percentileFromHistogram(p.rtt_hist), 200);
  assert.equal(p.delay_avg_ms, 90);
  assert.equal(p.started_at, new Date(T0).toISOString());
  assert.equal(sessions.sessionCount(), 0);

  // La ligne passe telle quelle les limites de sanitizeProperties.
  assert.ok(Object.keys(p).length <= 20);
  assert.deepEqual(analyticsService.sanitizeProperties(p), Object.fromEntries(
    Object.entries(p).filter(([, value]) => value !== null),
  ));
  assert.ok(JSON.stringify(p).length < 600);
});

test("les reconnexions proches restent dans la même session, les longues coupures ne comptent pas", () => {
  const rows = setup();
  const phone = { user: bob, sessionId: "s2", userAgent: PHONE };
  sessions.streamOpened(phone, T0);
  let t = watchFor(phone, T0, 60);
  sessions.noteStreamTraffic(phone, 1000, 10, t);
  sessions.streamClosed(phone, t);
  // Flux coupé 40 s puis repris en secours (interrogation) : même session.
  sessions.sweep(t + 40000);
  t = watchFor(phone, t + 40000, 30, "polling");
  sessions.noteServerTraffic(phone, { bytes: 2000, frames: 5 }, t);
  sessions.sweep(t + sessions.IDLE_MS);

  assert.equal(rows.length, 1);
  const p = rows[0].properties;
  assert.equal(p.watched_s, 90);
  assert.equal(p.sse_s, 60);
  assert.equal(p.mode, "mixed");
  assert.equal(p.device, "mobile");
  assert.equal(p.streams, 1);
  assert.equal(p.server_bytes, 3000);
  assert.equal(p.server_frames, 15);
});

test("un flux ouvert garde la session, les sessions trop courtes sont ignorées", () => {
  const rows = setup();
  const pc = { user: alice, sessionId: "s3", userAgent: PC };
  sessions.streamOpened(pc, T0);
  sessions.noteWatch(pc, "sse", T0);
  assert.deepEqual(sessions.sweep(T0 + sessions.IDLE_MS * 3), []);
  assert.equal(sessions.sessionCount(), 1);
  sessions.streamClosed(pc, T0 + 3000);
  sessions.sweep(T0 + sessions.IDLE_MS * 5);
  assert.equal(rows.length, 0, "3 s regardées : rien n'est enregistré");
  assert.equal(sessions.sessionCount(), 0);
});

test("un autre compte sur le même navigateur ouvre une nouvelle session", () => {
  const rows = setup();
  const end = watchFor({ user: alice, sessionId: "s4", userAgent: PC }, T0, 30);
  sessions.noteWatch({ user: bob, sessionId: "s4", userAgent: PC }, "sse", end + 1000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userUsername, "alice");
  assert.equal(sessions.sessionCount(), 1);
});

test("les résumés du navigateur sont bornés", () => {
  setup();
  const pc = { user: alice, sessionId: "s5", userAgent: PC };
  const end = watchFor(pc, T0, 30);
  assert.equal(sessions.noteClientSummary(pc, null, end), false);
  sessions.noteClientSummary(pc, { bytes: -5, frames: "x", rttHist: [1e9, -1, "2"], rttSum: 1e15 }, end);
  const p = sessions.finalize("s5", end);
  assert.equal(p.client_bytes, 0);
  assert.equal(p.client_frames, 0);
  assert.equal(p.rtt_hist[0], 1e6);
  assert.equal(p.rtt_hist[2], 2);
  assert.ok(p.rtt_avg_ms <= 60000);
  assert.equal(sessions.noteClientSummary({ user: null }, { bytes: 1 }, end), false);
});

test("p95 lu sur l'histogramme", () => {
  assert.equal(sessions.percentileFromHistogram([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), null);
  assert.equal(sessions.percentileFromHistogram([95, 5, 0, 0, 0, 0, 0, 0, 0, 0]), 50);
  assert.equal(sessions.percentileFromHistogram([90, 10, 0, 0, 0, 0, 0, 0, 0, 0]), 100);
  assert.equal(sessions.percentileFromHistogram([0, 0, 0, 0, 0, 0, 0, 0, 0, 3]), 2000);
  assert.equal(sessions.bucketIndex(49), 0);
  assert.equal(sessions.bucketIndex(5000), 9);
});

test("un flux ouvert conserve ses compteurs après six heures, même s’il ferme aussitôt", () => {
  const rows = setup();
  const pc = { user: alice, sessionId: "long", userAgent: PC };
  const rollover = T0 + 6 * 60 * 60 * 1000;
  sessions.streamOpened(pc, T0);
  watchFor(pc, T0, 30);
  sessions.noteStreamTraffic(pc, 60000, 100, rollover - 1000);
  sessions.noteStreamWatch(pc, true, rollover);
  sessions.noteStreamTraffic(pc, 120, 2, rollover + 1000);
  assert.deepEqual(sessions.sweep(rollover + sessions.IDLE_MS + 1000), []);
  sessions.streamClosed(pc, rollover + sessions.IDLE_MS + 1000);
  sessions.sweep(rollover + 2 * sessions.IDLE_MS + 1000);

  assert.deepEqual(rows.map(({ properties: p }) => [p.streams, p.server_bytes, p.server_frames]), [
    [1, 60000, 100],
    [0, 120, 2],
  ]);
});

test("un flux sans image récente ne génère pas de temps regardé", () => {
  const rows = setup();
  const pc = { user: alice, sessionId: "offline", userAgent: PC };
  sessions.streamOpened(pc, T0);
  for (let offset = 0; offset <= 30000; offset += 3000) {
    sessions.noteStreamWatch(pc, false, T0 + offset);
  }
  sessions.streamClosed(pc, T0 + 31000);
  sessions.sweep(T0 + 31000 + sessions.IDLE_MS);
  assert.deepEqual(rows, []);
});

test("le temps joué et regardé est ventilé de part et d’autre de minuit à Paris", () => {
  const rows = setup();
  const pc = { user: alice, sessionId: "midnight", userAgent: PC };
  const midnight = Date.parse("2026-11-27T23:00:00Z");
  sessions.noteInput(pc, "A", midnight - 10000);
  watchFor(pc, midnight - 15000, 30, "polling");
  sessions.sweep(midnight + 15000 + sessions.IDLE_MS);
  assert.equal(rows[0].properties.played_s, 30);
  assert.deepEqual(rows[0].properties.daily, [
    ["2026-11-27", 15000, 10000],
    ["2026-11-28", 15000, 20000],
  ]);
});

test("la fermeture enregistre une session active et attend les écritures déjà engagées", async () => {
  setup();
  const pc = { user: alice, sessionId: "pending", userAgent: PC };
  const phone = { user: bob, sessionId: "active", userAgent: PHONE };
  const writes = [];
  sessions.setRecorder((row) => new Promise((resolve) => writes.push({ row, resolve })));
  sessions.noteInput(pc, "A", T0);
  sessions.sweep(T0 + sessions.IDLE_MS);
  sessions.noteInput(phone, "B", T0 + sessions.IDLE_MS);
  const finished = sessions.flush(T0 + sessions.IDLE_MS + 5000);
  assert.deepEqual(writes.map(({ row }) => [row.userUsername, row.properties.played_s]), [
    ["alice", 30],
    ["bob", 5],
  ]);
  let done = false;
  finished.then(() => { done = true; });
  writes[1].resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(done, false);
  writes[0].resolve();
  await finished;
  assert.equal(sessions.sessionCount(), 0);
});
