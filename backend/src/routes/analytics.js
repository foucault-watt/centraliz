const express = require("express");
const analyticsService = require("../services/analyticsService");
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");

const router = express.Router();

router.post("/track", authMiddleware, async (req, res) => {
  analyticsService.trackEvent({
    req,
    eventName: req.body?.eventName,
    module: req.body?.module,
    eventType: req.body?.eventType,
    isAutomatic: req.body?.isAutomatic,
    source: "frontend",
    properties: req.body?.properties || {},
  });

  res.status(202).json({ success: true });
});

router.get("/admin/summary", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const summary = await analyticsService.getSummary({
      range: req.query.range,
      eventTypes: req.query.eventTypes,
      hideExcluded: req.query.hideExcluded,
    });
    res.json({ success: true, summary });
  } catch (error) {
    console.error("[Analytics] Erreur summary:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des statistiques analytics.",
    });
  }
});

router.get("/admin/timeseries", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const timeseries = await analyticsService.getTimeseries({
      range: req.query.range,
      groupBy: req.query.groupBy,
      eventTypes: req.query.eventTypes,
      hideExcluded: req.query.hideExcluded,
    });
    res.json({ success: true, timeseries });
  } catch (error) {
    console.error("[Analytics] Erreur timeseries:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la série analytics.",
    });
  }
});

router.get("/admin/events", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const events = await analyticsService.getEvents(req.query);
    res.json({ success: true, ...events });
  } catch (error) {
    console.error("[Analytics] Erreur events:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des événements analytics.",
    });
  }
});

router.get("/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await analyticsService.getUsers(req.query);
    res.json({ success: true, ...users });
  } catch (error) {
    console.error("[Analytics] Erreur users:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des utilisateurs analytics.",
    });
  }
});

router.get("/admin/users/:username/events", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const events = await analyticsService.getUserEvents(req.params.username, req.query);
    res.json({ success: true, ...events });
  } catch (error) {
    console.error("[Analytics] Erreur user events:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la timeline utilisateur.",
    });
  }
});

router.get("/admin/users/:username/summary", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await analyticsService.getUserSummary(req.params.username, req.query);
    if (!user) {
      return res.status(404).json({ success: false, error: "Utilisateur introuvable." });
    }
    return res.json({ success: true, user });
  } catch (error) {
    console.error("[Analytics] Erreur user summary:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération du résumé utilisateur.",
    });
  }
});

router.get("/admin/users/:username/timeseries", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const timeseries = await analyticsService.getUserTimeseries(req.params.username, req.query);
    return res.json({ success: true, timeseries });
  } catch (error) {
    console.error("[Analytics] Erreur user timeseries:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la série utilisateur.",
    });
  }
});

router.get("/admin/users/:username/sessions", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const sessions = await analyticsService.getUserSessions(req.params.username, req.query);
    return res.json({ success: true, ...sessions });
  } catch (error) {
    console.error("[Analytics] Erreur user sessions:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des sessions utilisateur.",
    });
  }
});

router.get("/admin/users/:username", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await analyticsService.getUserDetail(req.params.username, req.query);
    if (!user) {
      return res.status(404).json({ success: false, error: "Utilisateur introuvable." });
    }
    return res.json({ success: true, user });
  } catch (error) {
    console.error("[Analytics] Erreur user detail:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la fiche utilisateur.",
    });
  }
});

router.get("/admin/modules", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const modules = await analyticsService.getModules(req.query);
    res.json({ success: true, ...modules });
  } catch (error) {
    console.error("[Analytics] Erreur modules:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des modules analytics.",
    });
  }
});

router.get("/admin/modules/:module/summary", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const moduleSummary = await analyticsService.getModuleSummary(req.params.module, req.query);
    if (!moduleSummary) {
      return res.status(404).json({ success: false, error: "Module introuvable." });
    }
    return res.json({ success: true, module: moduleSummary });
  } catch (error) {
    console.error("[Analytics] Erreur module summary:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération du résumé module.",
    });
  }
});

router.get("/admin/modules/:module/timeseries", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const timeseries = await analyticsService.getModuleTimeseries(req.params.module, req.query);
    return res.json({ success: true, timeseries });
  } catch (error) {
    console.error("[Analytics] Erreur module timeseries:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la série module.",
    });
  }
});

router.get("/admin/modules/:module/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await analyticsService.getModuleUsers(req.params.module, req.query);
    return res.json({ success: true, ...users });
  } catch (error) {
    console.error("[Analytics] Erreur module users:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des utilisateurs du module.",
    });
  }
});

router.get("/admin/retention", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const retention = await analyticsService.getRetention(req.query);
    res.json({ success: true, retention });
  } catch (error) {
    console.error("[Analytics] Erreur retention:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la rétention analytics.",
    });
  }
});

router.get("/admin/sessions", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const sessions = await analyticsService.getSessions(req.query);
    res.json({ success: true, ...sessions });
  } catch (error) {
    console.error("[Analytics] Erreur sessions:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des sessions analytics.",
    });
  }
});

router.get("/admin/heatmap", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const heatmap = await analyticsService.getHeatmap(req.query);
    res.json({ success: true, heatmap });
  } catch (error) {
    console.error("[Analytics] Erreur heatmap:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la heatmap analytics.",
    });
  }
});

router.get("/admin/excluded-users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const excludedUsers = await analyticsService.getExcludedUsers();
    res.json({ success: true, ...excludedUsers });
  } catch (error) {
    console.error("[Analytics] Erreur excluded users:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des utilisateurs exclus.",
    });
  }
});

router.post("/admin/excluded-users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const excludedUsers = await analyticsService.addExcludedUser({
      username: req.body?.username,
      reason: req.body?.reason,
      createdBy: req.session?.user?.userName || req.session?.user?.username,
    });
    res.status(201).json({ success: true, ...excludedUsers });
  } catch (error) {
    console.error("[Analytics] Erreur add excluded user:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.status === 400
        ? error.message
        : "Erreur lors de l'ajout de l'utilisateur exclu.",
    });
  }
});

router.delete("/admin/excluded-users/:username", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const excludedUsers = await analyticsService.removeExcludedUser(req.params.username);
    res.json({ success: true, ...excludedUsers });
  } catch (error) {
    console.error("[Analytics] Erreur remove excluded user:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.status === 400
        ? error.message
        : "Erreur lors de la suppression de l'utilisateur exclu.",
    });
  }
});

module.exports = router;
