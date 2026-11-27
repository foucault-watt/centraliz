// Statistiques de la console admin à partir des lignes « pokemon_session »
// (une par session de jeu et par appareil, voir pokemonSessions).

const { parisPeriodKey } = require("../utils/parisTime");
const { BUTTONS, LATENCY_BUCKETS, percentileFromHistogram } = require("./pokemonSessions");

const DAY_MS = 24 * 60 * 60 * 1000;

const num = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
};

const minutes = (seconds) => round(seconds / 60, 1);

const share = (part, total) => (total ? round((part / total) * 100, 0) : 0);

function emptyDays(days, now) {
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = parisPeriodKey(new Date(now - i * DAY_MS), "day");
    if (key && !keys.includes(key)) keys.push(key);
  }
  return new Map(keys.map((key) => [key, { day: key, watchedMinutes: 0, playedMinutes: 0, sessions: 0, players: new Set() }]));
}

// rows : [{ user_username, created_at, properties }]
function buildPokemonStats(rows = [], { days = 30, now = Date.now() } = {}) {
  const byDay = emptyDays(days, now);
  const players = new Map();
  const buttons = BUTTONS.map(() => 0);
  const rttHist = LATENCY_BUCKETS.map(() => 0);
  const totals = { sessions: 0, watchedS: 0, playedS: 0, inputs: 0, serverBytes: 0, clientBytes: 0, serverFrames: 0 };
  const devices = { mobile: 0, desktop: 0 };
  const deviceWatchedS = { mobile: 0, desktop: 0 };
  const modes = { sse: 0, polling: 0, mixed: 0 };
  let sseS = 0;
  let rttSum = 0;
  let rttCount = 0;
  let delaySum = 0;
  let delaySessions = 0;
  let fpsSum = 0;
  let fpsWeight = 0;

  for (const row of rows) {
    const p = row.properties || {};
    const watchedS = num(p.watched_s);
    const playedS = num(p.played_s);
    const inputs = num(p.inputs);
    const startedAt = p.started_at || row.created_at;
    const endedAt = p.ended_at || row.created_at;

    totals.sessions += 1;
    totals.watchedS += watchedS;
    totals.playedS += playedS;
    totals.inputs += inputs;
    totals.serverBytes += num(p.server_bytes);
    totals.clientBytes += num(p.client_bytes);
    totals.serverFrames += num(p.server_frames);

    const device = p.device === "mobile" ? "mobile" : "desktop";
    devices[device] += 1;
    deviceWatchedS[device] += watchedS;
    if (modes[p.mode] !== undefined) modes[p.mode] += 1;
    sseS += Math.min(num(p.sse_s), watchedS);

    if (Array.isArray(p.buttons)) BUTTONS.forEach((_, i) => { buttons[i] += num(p.buttons[i]); });
    if (Array.isArray(p.rtt_hist)) {
      let count = 0;
      LATENCY_BUCKETS.forEach((_, i) => {
        const value = num(p.rtt_hist[i]);
        rttHist[i] += value;
        count += value;
      });
      if (count && p.rtt_avg_ms != null) {
        rttSum += num(p.rtt_avg_ms) * count;
        rttCount += count;
      }
    }
    if (p.delay_avg_ms != null) {
      delaySum += num(p.delay_avg_ms);
      delaySessions += 1;
    }
    if (watchedS && p.fps != null) {
      fpsSum += num(p.fps) * watchedS;
      fpsWeight += watchedS;
    }

    const dayKey = parisPeriodKey(startedAt, "day");
    const day = byDay.get(dayKey);
    if (day) {
      day.watchedMinutes += watchedS / 60;
      day.playedMinutes += playedS / 60;
      day.sessions += 1;
      if (row.user_username) day.players.add(row.user_username);
    }

    if (row.user_username) {
      let player = players.get(row.user_username);
      if (!player) {
        player = { username: row.user_username, sessions: 0, watchedS: 0, playedS: 0, inputs: 0, lastSeenAt: null, devices: new Set() };
        players.set(row.user_username, player);
      }
      player.sessions += 1;
      player.watchedS += watchedS;
      player.playedS += playedS;
      player.inputs += inputs;
      player.devices.add(device);
      if (!player.lastSeenAt || String(endedAt) > player.lastSeenAt) player.lastSeenAt = String(endedAt);
    }
  }

  const playerList = [...players.values()]
    .map((player) => ({
      username: player.username,
      sessions: player.sessions,
      watchedMinutes: minutes(player.watchedS),
      playedMinutes: minutes(player.playedS),
      inputs: player.inputs,
      lastSeenAt: player.lastSeenAt,
      devices: [...player.devices].sort(),
    }))
    .sort((a, b) => b.watchedMinutes - a.watchedMinutes || b.inputs - a.inputs || a.username.localeCompare(b.username));

  return {
    days,
    totals: {
      players: players.size,
      activePlayers: playerList.filter((player) => player.inputs > 0).length,
      sessions: totals.sessions,
      watchedMinutes: minutes(totals.watchedS),
      playedMinutes: minutes(totals.playedS),
      inputs: totals.inputs,
      avgSessionMinutes: totals.sessions ? minutes(totals.watchedS / totals.sessions) : 0,
    },
    daily: [...byDay.values()].map((day) => ({
      day: day.day,
      watchedMinutes: round(day.watchedMinutes, 1),
      playedMinutes: round(day.playedMinutes, 1),
      sessions: day.sessions,
      players: day.players.size,
    })),
    players: playerList,
    technical: {
      serverBytes: totals.serverBytes,
      clientBytes: totals.clientBytes,
      serverFrames: totals.serverFrames,
      bytesPerSession: totals.sessions ? Math.round(totals.serverBytes / totals.sessions) : 0,
      bytesPerMinute: totals.watchedS ? Math.round(totals.serverBytes / (totals.watchedS / 60)) : 0,
      rttAvgMs: rttCount ? Math.round(rttSum / rttCount) : null,
      rttP95Ms: percentileFromHistogram(rttHist),
      rttSamples: rttHist.reduce((sum, count) => sum + count, 0),
      rttHistogram: LATENCY_BUCKETS.map((limit, i) => ({
        label: Number.isFinite(limit) ? `≤ ${limit} ms` : `> ${LATENCY_BUCKETS[i - 1]} ms`,
        count: rttHist[i],
      })),
      delayAvgMs: delaySessions ? Math.round(delaySum / delaySessions) : null,
      fpsAvg: fpsWeight ? round(fpsSum / fpsWeight, 1) : null,
      sseTimeShare: share(sseS, totals.watchedS),
      modes,
      devices,
      deviceWatchedMinutes: { mobile: minutes(deviceWatchedS.mobile), desktop: minutes(deviceWatchedS.desktop) },
      buttons: BUTTONS.map((button, i) => ({ button, count: buttons[i], share: share(buttons[i], totals.inputs) })),
    },
  };
}

module.exports = { buildPokemonStats };
