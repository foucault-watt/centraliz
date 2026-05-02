const express = require("express");
const authMiddleware = require("../middlewares/auth");
const gradesService = require("../services/gradesService");
const analyticsService = require("../services/analyticsService");

const router = express.Router();

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;
  const payload = {
    error: error.message || "Erreur serveur",
  };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(statusCode).json(payload);
};

router.get("/", authMiddleware, async (req, res) => {
  try {
    const response = await gradesService.getGrades(req.session.user.userName);
    analyticsService.trackEvent({
      req,
      eventName: "grades_viewed",
      module: "notes",
      properties: {
        has_snapshot: Boolean(response?.snapshot),
      },
    });
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/refresh", authMiddleware, async (req, res) => {
  try {
    const response = await gradesService.refreshGrades(
      req.session.user.userName,
      req.body || {},
    );
    analyticsService.trackEvent({
      req,
      eventName: "grades_refreshed",
      module: "notes",
      properties: {
        source: response?.snapshot?.source || "manual_refresh",
        status: response?.snapshot?.status || "success",
        new_entry_count: response?.refreshReport?.newEntryCount || 0,
      },
    });
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/credentials/status", authMiddleware, async (req, res) => {
  try {
    const response = await gradesService.getCredentialStatus(
      req.session.user.userName,
    );
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/hidden-rules", authMiddleware, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const rules = await gradesService.getHiddenRules(
      req.session.user.userName,
      { includeInactive },
    );
    res.status(200).json({ rules });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/hidden-rules", authMiddleware, async (req, res) => {
  try {
    const rule = await gradesService.createHiddenRule(
      req.session.user.userName,
      req.body || {},
    );
    analyticsService.trackEvent({
      req,
      eventName: "grade_rule_hidden",
      module: "notes",
      properties: {
        match_strategy: rule?.match_strategy || "entry_fingerprint",
      },
    });
    res.status(201).json({ rule });
  } catch (error) {
    handleError(res, error);
  }
});

router.delete("/hidden-rules/:id", authMiddleware, async (req, res) => {
  try {
    const rule = await gradesService.deactivateHiddenRule(
      req.session.user.userName,
      req.params.id,
    );
    res.status(200).json({ rule });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/hidden-rules/:id/restore", authMiddleware, async (req, res) => {
  try {
    const rule = await gradesService.restoreHiddenRule(
      req.session.user.userName,
      req.params.id,
    );
    analyticsService.trackEvent({
      req,
      eventName: "grade_rule_restored",
      module: "notes",
    });
    res.status(200).json({ rule });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
