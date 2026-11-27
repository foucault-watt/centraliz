const test = require("node:test");
const assert = require("node:assert");
const presence = require("./pokemonPresence");

const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0";
const alice = { userName: "alice", displayName: "Alice Durand" };
const bob = { userName: "bob", displayName: "Bob Martin" };

test("reconnaît téléphone et ordinateur", () => {
  assert.equal(presence.deviceType(PHONE), "mobile");
  assert.equal(presence.deviceType(PC), "desktop");
  assert.equal(presence.deviceType(undefined), "desktop");
});

test("regroupe les appareils d'une même personne et dit lequel a joué", () => {
  presence.resetForTests();
  const t = 1_000_000;
  presence.noteWatching({ user: alice, sessionId: "s1", userAgent: PC }, t);
  presence.notePlaying({ user: alice, sessionId: "s2", userAgent: PHONE }, "A", t + 1000);
  presence.noteWatching({ user: bob, sessionId: "s3", userAgent: PC }, t);
  presence.noteWatching({ user: null, sessionId: "s4" }, t); // sans session : ignoré

  const now = presence.getPresence(t + 3000);
  assert.deepEqual(now.playing, [{
    name: "Alice Durand",
    devices: [{ type: "mobile", playing: true }, { type: "desktop", playing: false }],
    lastButton: "A",
    lastDevice: "mobile",
    secondsAgo: 2,
  }]);
  assert.deepEqual(now.watching, [{ name: "Bob Martin", devices: [{ type: "desktop", playing: false }] }]);
});

test("deux ordinateurs d'une même personne comptent pour deux appareils", () => {
  presence.resetForTests();
  const t = 1_500_000;
  presence.noteWatching({ user: bob, sessionId: "a", userAgent: PC }, t);
  presence.noteWatching({ user: bob, sessionId: "b", userAgent: PC }, t);
  assert.equal(presence.getPresence(t).watching[0].devices.length, 2);
});

test("on disparaît après un moment sans activité", () => {
  presence.resetForTests();
  const t = 2_000_000;
  presence.noteWatching({ user: bob, sessionId: "s1" }, t);
  presence.notePlaying({ user: alice, sessionId: "s2" }, "UP", t);
  const later = presence.getPresence(t + presence.WATCHING_MS + 1000);
  assert.equal(later.watching.length, 0);
  assert.equal(later.playing.length, 1);
  const muchLater = presence.getPresence(t + presence.PLAYING_MS + 1000);
  assert.deepEqual([muchLater.playing.length, muchLater.watching.length], [0, 0]);
});
