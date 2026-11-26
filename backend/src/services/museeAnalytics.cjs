const EVENT_NAMES = new Set([
  "musee_play_clicked", "musee_game_ready", "musee_level_started",
  "musee_level_checkpoint", "musee_level_completed", "musee_level_left",
]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function validateEvent(body) {
  if (!body || !EVENT_NAMES.has(body.eventName) || !UUID.test(body.anonymousId || "")) return null;
  const source = body.properties;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  if (!UUID.test(source.event_id || "") || !UUID.test(source.session_id || "")) return null;
  const properties = { event_id: source.event_id, session_id: source.session_id };
  if (body.eventName.startsWith("musee_level_")) {
    if (!/^[a-z0-9_-]{1,40}$/.test(source.level_id || "") ||
        !/^[a-z0-9_-]{1,80}$/i.test(source.attempt_id || "")) return null;
    properties.level_id = source.level_id;
    properties.attempt_id = source.attempt_id;
  }
  for (const key of ["level_index", "level_count", "load_seconds", "active_seconds", "move_count", "detail_views", "answer_reveals"]) {
    if (source[key] === undefined) continue;
    if (!Number.isInteger(source[key]) || source[key] < 0 || source[key] > 100000) return null;
    properties[key] = source[key];
  }
  for (const key of ["resumed", "debug", "completed"]) {
    if (source[key] === undefined) continue;
    if (typeof source[key] !== "boolean") return null;
    properties[key] = source[key];
  }
  if (typeof source.game_version === "string") properties.game_version = source.game_version.slice(0, 40);
  return { eventName: body.eventName, anonymousId: body.anonymousId, properties };
}

function buildMuseeStats(events) {
  const seen = new Set(), players = new Set(), accounts = new Set(), browsers = new Set(), sessions = new Set();
  const attempts = new Map(), ready = new Set(), sessionMap = new Map();
  const labelFor = identity => identity.startsWith("user:") ? identity.slice(5) : `Visiteur ${identity.slice(5, 13)}`;
  let clicks = 0, debugEvents = 0;
  for (const event of events) {
    if (!EVENT_NAMES.has(event.event_name)) continue;
    const p = event.properties || {};
    if (p.debug) { debugEvents++; continue; }
    if (p.event_id && seen.has(p.event_id)) continue;
    if (p.event_id) seen.add(p.event_id);
    const identity = event.user_username ? `user:${event.user_username}` : `anon:${event.anonymous_id || ""}`;
    if (identity === "anon:") continue;
    players.add(identity);
    if (event.user_username) accounts.add(event.user_username);
    else browsers.add(event.anonymous_id);
    if (p.session_id) {
      sessions.add(p.session_id);
      // Une session = une partie lancée depuis un navigateur.
      const session = sessionMap.get(p.session_id) || {
        sessionId: p.session_id, player: identity, startedAt: null, endedAt: null, ready: false,
        levelsStarted: new Set(), levelsCompleted: new Set(), activeSeconds: 0,
      };
      const at = event.created_at ? new Date(event.created_at) : null;
      if (at && !Number.isNaN(at.getTime())) {
        const iso = at.toISOString();
        if (!session.startedAt || iso < session.startedAt) session.startedAt = iso;
        if (!session.endedAt || iso > session.endedAt) session.endedAt = iso;
      }
      if (event.event_name === "musee_game_ready") session.ready = true;
      sessionMap.set(p.session_id, session);
    }
    if (event.event_name === "musee_play_clicked") clicks++;
    if (event.event_name === "musee_game_ready") ready.add(p.session_id);
    if (!p.attempt_id || !p.level_id) continue;
    const key = `${p.session_id}:${p.attempt_id}`;
    const attempt = attempts.get(key) || {
      level: p.level_id, index: p.level_index || 0, player: identity, session: p.session_id,
      started: false, completed: false, resumed: false,
      active_seconds: 0, move_count: 0, detail_views: 0, answer_reveals: 0,
    };
    if (event.event_name === "musee_level_started") attempt.started = true;
    if (event.event_name === "musee_level_completed" || p.completed === true) attempt.completed = true;
    attempt.resumed ||= p.resumed === true;
    for (const metric of ["active_seconds", "move_count", "detail_views", "answer_reveals"]) {
      attempt[metric] = Math.max(attempt[metric], Number(p[metric]) || 0);
    }
    attempts.set(key, attempt);
  }
  const levels = new Map(), participants = new Map();
  const participantFor = identity => {
    if (!participants.has(identity)) {
      participants.set(identity, {
        account: identity.startsWith("user:") ? identity.slice(5) : null,
        label: labelFor(identity),
        levelsStarted: new Set(), levelsCompleted: new Set(), activeSeconds: 0,
        sessions: 0, firstPlayedAt: null, lastPlayedAt: null,
      });
    }
    return participants.get(identity);
  };
  // Tout joueur qui a lancé une partie apparaît, même sans niveau commencé.
  for (const session of sessionMap.values()) {
    const participant = participantFor(session.player);
    participant.sessions++;
    if (session.startedAt && (!participant.firstPlayedAt || session.startedAt < participant.firstPlayedAt)) {
      participant.firstPlayedAt = session.startedAt;
    }
    if (session.endedAt && (!participant.lastPlayedAt || session.endedAt > participant.lastPlayedAt)) {
      participant.lastPlayedAt = session.endedAt;
    }
  }
  for (const attempt of attempts.values()) {
    const level = levels.get(attempt.level) || {
      levelId: attempt.level, index: attempt.index, players: new Set(), starts: 0,
      completions: 0, unfinished: 0, resumed: 0, activeSeconds: 0,
      moves: 0, detailViews: 0, answerReveals: 0, completedSeconds: [],
    };
    // Start/completion cohorts use the same period; don't count earlier starts as new.
    if (!attempt.started) continue;
    const participant = participantFor(attempt.player);
    participant.levelsStarted.add(attempt.level);
    if (attempt.completed) participant.levelsCompleted.add(attempt.level);
    participant.activeSeconds += attempt.active_seconds;
    const session = sessionMap.get(attempt.session);
    if (session) {
      session.levelsStarted.add(attempt.level);
      if (attempt.completed) session.levelsCompleted.add(attempt.level);
      session.activeSeconds += attempt.active_seconds;
    }
    level.players.add(attempt.player);
    level.starts++;
    level.completions += Number(attempt.completed);
    level.unfinished += Number(!attempt.completed);
    level.resumed += Number(attempt.resumed);
    level.activeSeconds += attempt.active_seconds;
    level.moves += attempt.move_count;
    level.detailViews += attempt.detail_views;
    level.answerReveals += attempt.answer_reveals;
    if (attempt.completed) level.completedSeconds.push(attempt.active_seconds);
    levels.set(attempt.level, level);
  }
  const median = values => {
    if (!values.length) return null;
    values.sort((a, b) => a - b);
    const i = Math.floor(values.length / 2);
    return values.length % 2 ? values[i] : (values[i - 1] + values[i]) / 2;
  };
  return {
    players: players.size, accounts: accounts.size, anonymousBrowsers: browsers.size,
    sessions: sessions.size, playClicks: clicks, readySessions: ready.size, debugEvents,
    // Les plus récents d'abord.
    participants: [...participants.values()].map(p => ({
      ...p, levelsStarted: [...p.levelsStarted], levelsCompleted: [...p.levelsCompleted],
    })).sort((a, b) => String(b.lastPlayedAt || "").localeCompare(String(a.lastPlayedAt || ""))),
    sessionList: [...sessionMap.values()].map(session => ({
      sessionId: session.sessionId,
      account: session.player.startsWith("user:") ? session.player.slice(5) : null,
      label: labelFor(session.player),
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      ready: session.ready,
      levelsStarted: [...session.levelsStarted],
      levelsCompleted: [...session.levelsCompleted],
      activeSeconds: session.activeSeconds,
    })).sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || ""))).slice(0, 300),
    levels: [...levels.values()].sort((a, b) => a.index - b.index || a.levelId.localeCompare(b.levelId)).map(level => ({
      ...level, players: level.players.size,
      completionRate: Math.round(level.completions / level.starts * 100),
      medianCompletionSeconds: median(level.completedSeconds),
      completedSeconds: undefined,
    })),
  };
}

module.exports = { validateEvent, buildMuseeStats };
