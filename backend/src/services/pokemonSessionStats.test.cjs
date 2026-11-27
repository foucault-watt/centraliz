const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPokemonStats, periodStart } = require("./pokemonSessionStats");

const NOW = Date.parse("2026-11-27T15:00:00Z");

const row = (username, startedAt, properties) => ({
  user_username: username,
  created_at: startedAt,
  properties: { started_at: startedAt, ended_at: startedAt, ...properties },
});

test("agrège joueurs, jours et mesures techniques", () => {
  const stats = buildPokemonStats([
    row("alice", "2026-11-27T10:00:00Z", {
      watched_s: 600, played_s: 300, inputs: 40, buttons: [10, 10, 0, 0, 20, 0, 0],
      device: "desktop", mode: "sse", sse_s: 600, server_bytes: 3_000_000, client_bytes: 2_900_000,
      server_frames: 4000, fps: 6, rtt_avg_ms: 80, rtt_hist: [5, 4, 1, 0, 0, 0, 0, 0, 0, 0], delay_avg_ms: 120,
    }),
    row("alice", "2026-11-26T22:30:00Z", { watched_s: 120, played_s: 0, inputs: 0, device: "mobile", mode: "polling", server_bytes: 1_000_000 }),
    row("bob", "2026-11-25T09:00:00Z", {
      watched_s: 300, played_s: 60, inputs: 10, buttons: [0, 0, 0, 0, 10, 0, 0],
      device: "mobile", mode: "mixed", sse_s: 100, fps: 12, rtt_avg_ms: 400, rtt_hist: [0, 0, 0, 0, 0, 10, 0, 0, 0, 0], delay_avg_ms: 300,
    }),
    row("carol", "2026-10-01T09:00:00Z", { watched_s: 60 }), // ignoré car hors de la période
  ], { days: 7, now: NOW });

  assert.deepEqual(stats.totals, {
    players: 2,
    activePlayers: 2,
    sessions: 3,
    watchedMinutes: 17,
    playedMinutes: 6,
    inputs: 50,
    avgSessionMinutes: 5.7,
  });
  assert.equal(stats.daily.length, 7);
  assert.equal(stats.daily.at(-1).day, "2026-11-27");
  assert.equal(stats.daily.at(-1).watchedMinutes, 10);
  // 22h30 UTC le 26 = 23h30 à Paris : compté le 26.
  assert.equal(stats.daily.at(-2).watchedMinutes, 2);
  assert.equal(stats.daily.at(-3).playedMinutes, 1);

  assert.deepEqual(stats.players[0], {
    username: "alice", sessions: 2, watchedMinutes: 12, playedMinutes: 5, inputs: 40,
    lastSeenAt: "2026-11-27T10:00:00Z", devices: ["desktop", "mobile"],
  });

  const tech = stats.technical;
  assert.equal(tech.serverBytes, 4_000_000);
  assert.equal(tech.bytesPerSession, 1_333_333);
  assert.equal(tech.rttAvgMs, 240); // (80×10 + 400×10) / 20
  assert.equal(tech.rttP95Ms, 500);
  assert.equal(tech.rttSamples, 20);
  assert.equal(tech.delayAvgMs, 210);
  assert.equal(tech.fpsAvg, 8); // pondéré par le temps regardé
  assert.deepEqual(tech.modes, { sse: 1, polling: 1, mixed: 1 });
  assert.deepEqual(tech.devices, { mobile: 2, desktop: 1 });
  assert.equal(tech.sseTimeShare, 69); // 700 s sur 1020
  assert.deepEqual(tech.buttons.find((b) => b.button === "A"), { button: "A", count: 30, share: 60 });
});

test("sans session : des zéros, pas d'erreur", () => {
  const stats = buildPokemonStats([], { days: 30, now: NOW });
  assert.equal(stats.totals.sessions, 0);
  assert.equal(stats.totals.avgSessionMinutes, 0);
  assert.equal(stats.daily.length, 30);
  assert.equal(stats.technical.rttAvgMs, null);
  assert.equal(stats.technical.rttP95Ms, null);
  assert.deepEqual(stats.players, []);
});

test("les jours civils restent consécutifs lors du passage à l’heure d’hiver", () => {
  const now = Date.parse("2026-10-26T22:30:00Z");
  const stats = buildPokemonStats([], { days: 7, now });
  assert.deepEqual(stats.daily.map(({ day }) => day), [
    "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26",
  ]);
  assert.equal(periodStart(7, now).toISOString(), "2026-10-19T22:00:00.000Z");
});

test("une session commencée avant la période contribue pour les minutes dans la période", () => {
  const stats = buildPokemonStats([
    row("alice", "2026-11-26T22:45:00Z", {
      v: 2,
      watched_s: 1800,
      played_s: 600,
      daily: [["2026-11-26", 900000, 300000], ["2026-11-27", 900000, 300000]],
    }),
  ], { days: 1, now: NOW });
  assert.deepEqual(stats.daily, [{ day: "2026-11-27", watchedMinutes: 15, playedMinutes: 5, sessions: 1, players: 1 }]);
  assert.equal(stats.totals.watchedMinutes, 15);
  assert.equal(stats.totals.playedMinutes, 5);
});
