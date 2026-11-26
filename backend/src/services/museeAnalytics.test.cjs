const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateEvent, buildMuseeStats } = require("./museeAnalytics.cjs");
const id = "00000000-0000-4000-8000-000000000001";

test("public payload accepts only bounded game fields and cannot supply account identity", () => {
  const body = { eventName: "musee_level_started", anonymousId: id, properties: {
    session_id: id, event_id: id, attempt_id: "1-2", level_id: "ch1_1", active_seconds: 0, user_username: "spoof", email: "private",
  } };
  const result = validateEvent(body);
  assert(result);
  assert.equal(result.properties.user_username, undefined);
  assert.equal(result.properties.email, undefined);
  assert.equal(validateEvent({ ...body, eventName: "admin_delete" }), null);
  assert.equal(validateEvent({ ...body, properties: { ...body.properties, active_seconds: -1 } }), null);
});

test("counts anonymous players and deduplicates completions and cumulative snapshots", () => {
  const event = (name, props, eventId) => ({ event_name: name, anonymous_id: id, properties: {
    session_id: id, event_id: eventId, attempt_id: "a", level_id: "ch1_1", level_index: 1, ...props,
  } });
  const events = [event("musee_level_started", {}, "start"),
    event("musee_level_checkpoint", { active_seconds: 30, move_count: 4 }, "check"),
    event("musee_level_completed", { active_seconds: 45, move_count: 6, completed: true }, "done")];
  const stats = buildMuseeStats([...events, events[2]]);
  assert.equal(stats.anonymousBrowsers, 1);
  assert.equal(stats.levels[0].starts, 1);
  assert.equal(stats.levels[0].completions, 1);
  assert.equal(stats.levels[0].activeSeconds, 45);
  assert.equal(stats.levels[0].moves, 6);
  assert.equal(stats.levels[0].medianCompletionSeconds, 45);
});

test("does not count completions from a previous start cohort or debug runs", () => {
  const result = buildMuseeStats([
    { event_name: "musee_level_completed", user_username: "alice", properties: { session_id: "s", attempt_id: "old", level_id: "ch1_1" } },
    { event_name: "musee_level_started", user_username: "alice", properties: { debug: true, session_id: "s", attempt_id: "debug", level_id: "ch1_2" } },
  ]);
  assert.equal(result.accounts, 1);
  assert.equal(result.levels.length, 0);
  assert.equal(result.debugEvents, 1);
});

test("liste les sessions, la plus récente d'abord, et qui y a joué", () => {
  const ev = (name, user, session, at, props = {}) => ({
    event_name: name, user_username: user, created_at: at,
    properties: { session_id: session, event_id: `${session}-${name}-${at}`, ...props },
  });
  const stats = buildMuseeStats([
    ev("musee_play_clicked", "alice", "s1", "2026-11-20T10:00:00Z"),
    ev("musee_game_ready", "alice", "s1", "2026-11-20T10:00:05Z"),
    ev("musee_level_started", "alice", "s1", "2026-11-20T10:01:00Z", { attempt_id: "a1", level_id: "ch1_1" }),
    ev("musee_level_completed", "alice", "s1", "2026-11-20T10:05:00Z", { attempt_id: "a1", level_id: "ch1_1", active_seconds: 200 }),
    // Bob a lancé le jeu sans commencer de niveau : il doit quand même apparaître.
    ev("musee_play_clicked", "bob", "s2", "2026-11-25T18:00:00Z"),
  ]);
  assert.deepEqual(stats.sessionList.map(s => s.label), ["bob", "alice"]);
  const alice = stats.sessionList[1];
  assert.equal(alice.ready, true);
  assert.deepEqual(alice.levelsCompleted, ["ch1_1"]);
  assert.equal(alice.activeSeconds, 200);
  assert.equal(alice.startedAt, "2026-11-20T10:00:00.000Z");
  assert.deepEqual(stats.participants.map(p => [p.label, p.sessions]), [["bob", 1], ["alice", 1]]);
  assert.equal(stats.participants[1].lastPlayedAt, "2026-11-20T10:05:00.000Z");
});
