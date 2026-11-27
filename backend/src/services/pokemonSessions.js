// Sessions de jeu Pokémon, agrégées en mémoire, une ligne en base par
// session et par appareil (événement « pokemon_session » dans
// analytics_events). Jamais rien par image ni par bouton.
//
// Clé = session du navigateur (req.sessionID) : un appareil. Deux onglets du
// même navigateur partagent la même session.
//
// - Temps regardé : somme des écarts entre deux signes de vie (image
//   demandée, ou tic du flux SSE toutes les 3 s) quand l'écart est court.
//   Une coupure plus longue n'est pas comptée.
// - Temps joué : réunion des fenêtres de PLAY_WINDOW_MS ouvertes par chaque
//   bouton (dix boutons en dix secondes = 40 s jouées, pas 300).
// - Reconnexions proches regroupées : la session n'est enregistrée que si
//   aucun flux n'est ouvert et qu'il ne s'est rien passé depuis IDLE_MS.
// - Sessions trop courtes (moins de MIN_WATCHED_MS regardées et aucun bouton)
//   ignorées.
// - Mesures du navigateur (aller-retour, retard, images reçues) : résumés
//   envoyés par le front, additionnés ici. Aller-retour gardé en histogramme
//   à LATENCY_BUCKETS cases : fusionnable entre sessions pour un p95 global.

const { deviceType } = require("./pokemonPresence");
const { parisPeriodKey, parisDayStart, shiftDayKey } = require("../utils/parisTime");

const WATCH_GAP_MS = 6000;
const PLAY_WINDOW_MS = 30000;
const IDLE_MS = 2 * 60 * 1000;
const MIN_WATCHED_MS = 15000;
const MAX_SESSION_MS = 6 * 60 * 60 * 1000;
const SWEEP_MS = 30000;
const MAX_SESSIONS = 5000;

const BUTTONS = ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "START"];
// Bornes hautes (ms) des cases de l'histogramme ; la dernière : au-delà.
const LATENCY_BUCKETS = [50, 100, 150, 200, 300, 500, 750, 1000, 2000, Infinity];

const sessions = new Map();
const pendingWrites = new Set();
let recorder = null;
let sweepTimer = null;

const clampNumber = (value, max) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, max);
};

function bucketIndex(ms) {
  return LATENCY_BUCKETS.findIndex((limit) => ms <= limit);
}

// p95 approché depuis un histogramme : borne haute de la case qui contient
// le 95e centile (la dernière case, ouverte, vaut sa borne basse).
function percentileFromHistogram(histogram, ratio = 0.95) {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  const target = Math.ceil(total * ratio);
  let seen = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    seen += histogram[i] || 0;
    if (seen >= target) {
      return Number.isFinite(LATENCY_BUCKETS[i]) ? LATENCY_BUCKETS[i] : LATENCY_BUCKETS[i - 1];
    }
  }
  return null;
}

function keyFor({ user, sessionId, userAgent }) {
  const userKey = user && (user.userName || user.username);
  if (!userKey) return null;
  return { userKey, key: `${sessionId || `${userKey}:${deviceType(userAgent)}`}` };
}

function newSession(userKey, context, now) {
  const startDay = parisPeriodKey(now);
  const nextDay = shiftDayKey(startDay, 1);
  return {
    startDay,
    nextDay,
    midnight: parisDayStart(nextDay),
    daily: new Map(),
    continuation: false,
    userKey,
    device: deviceType(context.userAgent),
    startedAt: now,
    lastSeenAt: now,
    lastWatchAt: 0,
    watchedMs: 0,
    sseMs: 0,
    pollingMs: 0,
    playedMs: 0,
    playStart: null,
    playEnd: 0,
    inputs: 0,
    buttons: BUTTONS.map(() => 0),
    openStreams: new Set(),
    streams: 0,
    serverBytes: 0,
    serverFrames: 0,
    clientBytes: 0,
    clientFrames: 0,
    rttHist: LATENCY_BUCKETS.map(() => 0),
    rttSum: 0,
    rttCount: 0,
    delaySum: 0,
    delayCount: 0,
  };
}

function sessionFor(context, now) {
  const ids = keyFor(context || {});
  if (!ids) return null;
  let session = sessions.get(ids.key);
  if (session && session.userKey !== ids.userKey) {
    finalize(ids.key, now);
    session = null;
  }
  if (session && now - session.startedAt >= MAX_SESSION_MS) {
    const previous = session;
    const boundary = previous.startedAt + MAX_SESSION_MS;
    finalize(ids.key, boundary);
    const startedAt = now - boundary < IDLE_MS ? boundary : now;
    session = newSession(ids.userKey, context, startedAt);
    session.openStreams = previous.openStreams;
    session.continuation = session.openStreams.size > 0;
    if (previous.playEnd > startedAt) {
      session.playStart = startedAt;
      session.playEnd = previous.playEnd;
    }
    sessions.set(ids.key, session);
  }
  if (!session) {
    if (sessions.size >= MAX_SESSIONS) return null;
    session = newSession(ids.userKey, context, now);
    sessions.set(ids.key, session);
    ensureSweep();
  }
  session.lastSeenAt = Math.max(session.lastSeenAt, now);
  return session;
}

function addDailyTime(session, kind, start, end) {
  if (end <= start) return;
  // Une session est plafonnée à six heures. Elle traverse au plus un minuit.
  const firstEnd = Math.min(end, session.midnight);
  if (firstEnd > start) {
    const daily = session.daily.get(session.startDay) || [0, 0];
    daily[kind] += firstEnd - start;
    session.daily.set(session.startDay, daily);
  }
  if (end > session.midnight) {
    const day = session.nextDay;
    const daily = session.daily.get(day) || [0, 0];
    daily[kind] += end - Math.max(start, session.midnight);
    session.daily.set(day, daily);
  }
}

function addPlayTime(session, end) {
  if (session.playStart === null) return;
  const playedUntil = Math.min(session.playEnd, end);
  session.playedMs += Math.max(0, playedUntil - session.playStart);
  addDailyTime(session, 1, session.playStart, playedUntil);
}

// Signe de vie d'un spectateur : image récente en mode SSE ou polling.
function addWatchTime(session, mode, now) {
  if (session.lastWatchAt) {
    const gap = now - session.lastWatchAt;
    if (gap > 0 && gap <= WATCH_GAP_MS) {
      session.watchedMs += gap;
      addDailyTime(session, 0, session.lastWatchAt, now);
      if (mode === "sse") session.sseMs += gap;
      else session.pollingMs += gap;
    }
  }
  session.lastWatchAt = Math.max(session.lastWatchAt, now);
}

function noteWatch(context, mode, now = Date.now()) {
  const session = sessionFor(context, now);
  if (session) addWatchTime(session, mode, now);
}

function noteInput(context, button, now = Date.now()) {
  const session = sessionFor(context, now);
  if (!session) return;
  session.inputs += 1;
  const index = BUTTONS.indexOf(button);
  if (index >= 0) session.buttons[index] += 1;
  if (now >= session.playEnd) {
    addPlayTime(session, now);
    session.playStart = now;
  }
  session.playEnd = now + PLAY_WINDOW_MS;
}

function noteServerTraffic(context, { bytes = 0, frames = 0 } = {}, now = Date.now()) {
  const session = sessionFor(context, now);
  if (!session) return;
  addTraffic(session, bytes, frames);
}

function addTraffic(session, bytes, frames) {
  session.serverBytes += clampNumber(bytes, 1e12);
  session.serverFrames += clampNumber(frames, 1e9);
}

function streamOpened(context, now = Date.now()) {
  const session = sessionFor(context, now);
  if (!session) return;
  session.openStreams.add(context);
  session.streams += 1;
}

function sessionForStream(context, now) {
  const ids = keyFor(context);
  const session = ids && sessions.get(ids.key);
  if (!session?.openStreams.has(context)) return null;
  return sessionFor(context, now);
}

function noteStreamWatch(context, hasRecentFrame, now = Date.now()) {
  const session = sessionForStream(context, now);
  if (session && hasRecentFrame) addWatchTime(session, "sse", now);
}

function noteStreamTraffic(context, bytes, frames, now = Date.now()) {
  const session = sessionForStream(context, now);
  if (session) addTraffic(session, bytes, frames);
}

function streamClosed(context, now = Date.now()) {
  const ids = keyFor(context);
  const session = ids && sessions.get(ids.key);
  if (session?.openStreams.delete(context)) {
    session.lastSeenAt = Math.max(session.lastSeenAt, now);
  }
}

// Résumé envoyé par le navigateur depuis le précédent (valeurs bornées : le
// corps vient du client).
function noteClientSummary(context, summary = {}, now = Date.now()) {
  if (!summary || typeof summary !== "object") return false;
  const session = sessionFor(context, now);
  if (!session) return false;
  session.clientBytes += clampNumber(summary.bytes, 1e10);
  session.clientFrames += clampNumber(summary.frames, 1e7);
  if (Array.isArray(summary.rttHist)) {
    let count = 0;
    LATENCY_BUCKETS.forEach((_, i) => {
      const value = Math.round(clampNumber(summary.rttHist[i], 1e6));
      session.rttHist[i] += value;
      count += value;
    });
    // Somme cohérente avec le nombre : moyenne bornée à 60 s par mesure.
    session.rttCount += count;
    session.rttSum += Math.min(clampNumber(summary.rttSum, 1e10), count * 60000);
  }
  const delayCount = Math.round(clampNumber(summary.delayCount, 1e7));
  if (delayCount) {
    session.delayCount += delayCount;
    session.delaySum += Math.min(clampNumber(summary.delaySum, 1e12), delayCount * 60000);
  }
  return true;
}

// Propriétés de la ligne enregistrée (20 clés au plus : limite de
// sanitizeProperties ; tableaux de 10 valeurs au plus).
function toProperties(session, endedAt) {
  const watchedS = Math.round(session.watchedMs / 1000);
  const playedS = Math.round(session.playedMs / 1000);
  const mode = session.sseMs && session.pollingMs ? "mixed" : session.pollingMs ? "polling" : "sse";
  return {
    v: 2,
    daily: [...session.daily].map(([day, [watchedMs, playedMs]]) => [day, watchedMs, playedMs]),
    started_at: new Date(session.startedAt).toISOString(),
    ended_at: new Date(endedAt).toISOString(),
    watched_s: watchedS,
    played_s: playedS,
    inputs: session.inputs,
    buttons: session.buttons,
    device: session.device,
    mode,
    sse_s: Math.round(session.sseMs / 1000),
    streams: session.streams,
    server_bytes: Math.round(session.serverBytes),
    server_frames: session.serverFrames,
    client_bytes: Math.round(session.clientBytes),
    client_frames: session.clientFrames,
    fps: watchedS ? Math.round((session.clientFrames / watchedS) * 10) / 10 : 0,
    rtt_avg_ms: session.rttCount ? Math.round(session.rttSum / session.rttCount) : null,
    rtt_hist: session.rttHist,
    delay_avg_ms: session.delayCount ? Math.round(session.delaySum / session.delayCount) : null,
  };
}

function finalize(key, now = Date.now()) {
  const session = sessions.get(key);
  if (!session) return null;
  sessions.delete(key);
  const endedAt = Math.min(now, Math.max(session.lastSeenAt, session.playEnd));
  addPlayTime(session, endedAt);
  const hasContinuation = session.continuation && (session.serverBytes || session.watchedMs);
  if (session.watchedMs < MIN_WATCHED_MS && !session.playedMs && !session.inputs && !hasContinuation) return null;
  const properties = toProperties(session, endedAt);
  if (recorder) {
    try {
      const write = Promise.resolve(recorder({ userUsername: session.userKey, properties }))
        .catch((error) => console.error("[Pokémon sessions] Enregistrement impossible:", error))
        .finally(() => pendingWrites.delete(write));
      pendingWrites.add(write);
    } catch (error) {
      console.error("[Pokémon sessions] Enregistrement impossible:", error);
    }
  }
  return properties;
}

// Clôt les sessions sans flux ouvert et silencieuses depuis IDLE_MS.
function sweep(now = Date.now()) {
  const closed = [];
  for (const [key, session] of sessions) {
    const idle = now - Math.max(session.lastSeenAt, session.lastWatchAt);
    if (!session.openStreams.size && idle >= IDLE_MS) {
      const properties = finalize(key, now);
      if (properties) closed.push(properties);
    }
  }
  if (!sessions.size) stopSweep();
  return closed;
}

function stopSweep() {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}

async function flush(now = Date.now()) {
  stopSweep();
  for (const key of sessions.keys()) finalize(key, now);
  await Promise.all(pendingWrites);
}

function ensureSweep() {
  if (sweepTimer || !recorder) return;
  sweepTimer = setInterval(() => sweep(), SWEEP_MS);
  if (sweepTimer.unref) sweepTimer.unref();
}

// recorder({ userUsername, properties }) : appelé à chaque session close.
function setRecorder(fn) {
  recorder = fn;
}

function resetForTests() {
  sessions.clear();
  stopSweep();
}

module.exports = {
  noteWatch,
  noteInput,
  noteServerTraffic,
  streamOpened,
  streamClosed,
  noteStreamWatch,
  noteStreamTraffic,
  noteClientSummary,
  sweep,
  finalize,
  flush,
  setRecorder,
  resetForTests,
  percentileFromHistogram,
  bucketIndex,
  sessionCount: () => sessions.size,
  BUTTONS,
  LATENCY_BUCKETS,
  WATCH_GAP_MS,
  PLAY_WINDOW_MS,
  IDLE_MS,
  MIN_WATCHED_MS,
};
