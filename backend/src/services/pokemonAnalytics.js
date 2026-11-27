const analyticsService = require("./analyticsService");

const INACTIVITY_MS = 10 * 60 * 1000;
const lastActivity = new Map();
let nextCleanupAt = 0;

function trackActivity(req, eventName, eventType) {
  const user = req.session?.user;
  const username = user?.userName || user?.username;
  if (!username) return;

  const now = Date.now();
  if (now >= nextCleanupAt) {
    for (const [key, lastSeenAt] of lastActivity) {
      if (now - lastSeenAt >= INACTIVITY_MS) lastActivity.delete(key);
    }
    nextCleanupAt = now + INACTIVITY_MS;
  }

  const key = `${eventName}:${username}`;
  const lastSeenAt = lastActivity.get(key);
  lastActivity.set(key, now);
  if (lastSeenAt !== undefined && now - lastSeenAt < INACTIVITY_MS) return;

  void analyticsService.trackEvent({
    req,
    eventName,
    module: "pokemon",
    eventType,
    isAutomatic: eventType === "exposure",
  });
}

module.exports = { trackActivity };
