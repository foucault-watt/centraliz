const express = require("express");
const { validateEvent } = require("../services/museeAnalytics.cjs");

module.exports = function createMuseeRoutes({ analyticsService, authMiddleware, adminMiddleware }) {
  const router = express.Router();
  const buckets = new Map();
  let windowStart = Date.now();
  router.post("/", (req, res) => {
    const event = validateEvent(req.body);
    if (!event) return res.status(400).json({ success: false });
    const now = Date.now();
    if (now - windowStart >= 60000) { buckets.clear(); windowStart = now; }
    const ipKey = `ip:${req.ip}`;
    const browserKey = `browser:${event.anonymousId}`;
    if ((buckets.get(ipKey) || 0) >= 600 || (buckets.get(browserKey) || 0) >= 120 || buckets.size >= 10000) {
      return res.status(429).json({ success: false });
    }
    buckets.set(ipKey, (buckets.get(ipKey) || 0) + 1);
    buckets.set(browserKey, (buckets.get(browserKey) || 0) + 1);
    analyticsService.trackEvent({
      req, ...event, module: "musee", source: "frontend",
      eventType: event.eventName === "musee_level_completed" ? "conversion" :
        event.eventName === "musee_level_checkpoint" ? "system" : "interaction",
      isAutomatic: ["musee_game_ready", "musee_level_checkpoint", "musee_level_left"].includes(event.eventName),
    });
    return res.status(202).json({ success: true });
  });
  router.get("/summary", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const summary = await analyticsService.getMuseeStats({ range: req.query.range, hideExcluded: req.query.hideExcluded !== "false" });
      res.json({ success: true, summary });
    } catch (error) {
      console.error("[Musee analytics]", error.message);
      res.status(500).json({ success: false, error: "Statistiques du Musée indisponibles." });
    }
  });
  return router;
};
