import { fetchApi } from "./api";

const EVENTS = new Set(["musee_game_ready", "musee_level_started", "musee_level_checkpoint", "musee_level_completed", "musee_level_left"]);
let browserId;
function anonymousId() {
  if (browserId) return browserId;
  try {
    browserId = window.localStorage.getItem("centraliz.musee.anonymousId");
    if (!/^[a-f0-9-]{36}$/i.test(browserId || "")) {
      browserId = window.crypto.randomUUID();
      window.localStorage.setItem("centraliz.musee.anonymousId", browserId);
    }
  } catch { browserId = window.crypto.randomUUID(); }
  return browserId;
}

export function createMuseeTracker() {
  let sessionId, startedAt, latest;
  const seen = new Set();
  const send = (eventName, properties = {}) => {
    try {
      if (!sessionId) return;
      fetchApi("/api/analytics/musee", {
        method: "POST", keepalive: true,
        body: JSON.stringify({ eventName, anonymousId: anonymousId(), properties: {
          ...properties, session_id: sessionId, event_id: window.crypto.randomUUID(),
        } }),
      }).catch(() => {});
    } catch { /* Analytics must never affect gameplay. */ }
  };
  return {
    play() {
      try {
        sessionId = window.crypto.randomUUID();
        startedAt = performance.now();
        latest = null;
        seen.clear();
        send("musee_play_clicked");
      } catch { /* Game still starts if identifiers are unavailable. */ }
    },
    message(event, iframe) {
      if (!sessionId || !iframe || event.origin !== window.location.origin || event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || data.channel !== "le-musee" || data.version !== 1 || !EVENTS.has(data.eventName)) return;
      const p = data.properties;
      if (!p || typeof p !== "object" || Array.isArray(p)) return;
      const key = `${data.eventName}:${p.attempt_id || "ready"}`;
      if (data.eventName !== "musee_level_checkpoint" && seen.has(key)) return;
      seen.add(key);
      if (data.eventName.startsWith("musee_level_")) {
        latest = { ...p, left: data.eventName === "musee_level_left" };
      }
      send(data.eventName, data.eventName === "musee_game_ready"
        ? { ...p, load_seconds: Math.round((performance.now() - startedAt) / 1000) } : p);
    },
    close() {
      if (latest && !latest.left) {
        send("musee_level_left", latest);
        latest.left = true;
      }
    },
  };
}
