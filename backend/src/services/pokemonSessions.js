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
  return {
    userKey,
    device: deviceType(context.userAgent),
    startedAt: now,
    lastSeenAt: now,
    lastWatchAt: 0,
    lastWatchMode: null,
    watchedMs: 0,
    sseMs: 0,
    pollingMs: 0,
    playedMs: 0,
    playEnd: 0,
    inputs: 0,
    buttons: BUTTONS.map(() => 0),
    openStreams: 0,
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
  // Autre compte sur le même navigateur, ou session interminable : on clôt.
  if (session && (session.userKey !== ids.userKey || now - session.startedAt > MAX_SESSION_MS)) {
    finalize(ids.key, now);
    session = null;
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

// Signe de vie d'un spectateur : mode "sse" (tic du flux) ou "polling".
function noteWatch(context, mode, now = Date.now()) {
  const session = sessionFor(context, now);
  if (!session) return;
  if (session.lastWatchAt) {
    const gap = now - session.lastWatchAt;
    if (gap > 0 && gap <= WATCH_GAP_MS) {
      session.watchedMs += gap;
      if (mode === "sse") session.sseMs += gap;
      else session.pollingMs += gap;
    }
  }
  session.lastWatchAt = Math.max(session.lastWatchAt, now);
  session.lastWatchMode = mode;
}

function noteInput(context, button, now = Date.now()) {
  const session = sessionFor(context, now);
  if (!session) return;
  session.inputs += 1;
  const index = BUTTONS.indexOf(button);
  if (index >= 0) session.buttons[index] += 1;
  const end = now + PLAY_WINDOW_MS;
  session.playedMs += now >= session.playEnd ? PLAY_WINDOW_MS : end - session.playEnd;
  session.playEnd = end;
}

function noteServerTraffic(context, { bytes = 0, frames = 0 } = {}, now = Date.now()) {
  const session = sessionFor(context, now);
  if (!session) return;
  session.serverBytes += clampNumber(bytes, 1e12);
  session.serverFrames += clampNumber(frames, 1e9);
}

function streamOpened(context, now = Date.now()) {
  const session = sessionFor(context, now);
  if (!session) return;
  session.openStreams += 1;
  session.streams += 1;
}

function streamClosed(context, traffic, now = Date.now()) {
  const session = sessionFor(context, now);
  if (!session) return;
  noteWatch(context, "sse", now);
  session.openStreams = Math.max(0, session.openStreams - 1);
  if (traffic) noteServerTraffic(context, traffic, now);
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
  // La dernière fenêtre de jeu ne déborde pas après la fin de la session.
  const overshoot = Math.max(0, session.playEnd - endedAt);
  const playedS = Math.round(Math.max(0, session.playedMs - overshoot) / 1000);
  const mode = session.sseMs && session.pollingMs ? "mixed" : session.pollingMs ? "polling" : "sse";
  return {
    v: 1,
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
    rtt_p95_ms: percentileFromHistogram(session.rttHist),
    rtt_hist: session.rttHist,
    delay_avg_ms: session.delayCount ? Math.round(session.delaySum / session.delayCount) : null,
  };
}

function finalize(key, now = Date.now()) {
  const session = sessions.get(key);
  if (!session) return null;
  sessions.delete(key);
  if (session.watchedMs < MIN_WATCHED_MS && session.inputs === 0) return null;
  const endedAt = Math.max(session.lastSeenAt, session.lastWatchAt);
  const properties = toProperties(session, Math.min(endedAt, now));
  if (recorder) {
    try {
      recorder({ userUsername: session.userKey, properties });
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
    const tooLong = now - session.startedAt > MAX_SESSION_MS;
    if ((session.openStreams === 0 && idle >= IDLE_MS) || tooLong) {
      const properties = finalize(key, now);
      if (properties) closed.push(properties);
    }
  }
  if (!sessions.size && sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  return closed;
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
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}

module.exports = {
  noteWatch,
  noteInput,
  noteServerTraffic,
  streamOpened,
  streamClosed,
  noteClientSummary,
  sweep,
  finalize,
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
