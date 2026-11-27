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
  sessions.streamClosed(pc, { bytes: 500000, frames: 400 }, end);
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
  assert.equal(p.rtt_p95_ms, 200);
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
  sessions.streamClosed(phone, { bytes: 1000, frames: 10 }, t);
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
  sessions.streamClosed(pc, null, T0 + 3000);
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
