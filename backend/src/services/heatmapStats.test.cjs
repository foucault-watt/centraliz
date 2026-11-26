const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildHeatmap } = require("./heatmapStats");

// Période : lundi 23 → dimanche 29 novembre 2026 (5 jours de semaine, 2 de week-end).
const rangeStart = new Date("2026-11-23T06:00:00Z");
const now = new Date("2026-11-29T20:00:00Z");
const ev = (user, at, module = "calendars") => ({ user_username: user, created_at: at, module });

const stats = buildHeatmap(
  [
    // Lundi 12h (Paris) : alice deux fois, bob une fois.
    ev("alice", "2026-11-23T11:05:00Z"),
    ev("alice", "2026-11-23T11:40:00Z", "communication"),
    ev("bob", "2026-11-23T11:10:00Z"),
    // Mardi 12h : alice.
    ev("alice", "2026-11-24T11:00:00Z"),
    // Samedi 22h : carol.
    ev("carol", "2026-11-28T21:00:00Z", "communication"),
  ],
  { rangeStart, now },
);

test("compte événements et personnes distinctes par créneau, à l'heure de Paris", () => {
  const monday = stats.cells.find((cell) => cell.weekday === "lundi" && cell.hour === 12);
  assert.equal(monday.count, 3);
  assert.equal(monday.users, 2);
});

test("journée type : moyenne de personnes par jour de semaine et de week-end", () => {
  const noon = stats.typicalDay.find((point) => point.hour === 12);
  assert.equal(noon.weekday, 0.6); // (2 + 1) / 5 jours de semaine
  assert.equal(noon.weekend, 0);
  assert.equal(stats.typicalDay.find((point) => point.hour === 22).weekend, 0.5); // 1 / 2
});

test("modules les plus utilisés, heure par heure", () => {
  assert.deepEqual(stats.modules, ["calendars", "communication"]);
  const noon = stats.modulesByHour.find((point) => point.hour === 12);
  assert.equal(noon.calendars, 3);
  assert.equal(noon.communication, 1);
});
