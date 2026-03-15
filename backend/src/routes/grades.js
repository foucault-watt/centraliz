const express = require("express");
const authMiddleware = require("../middlewares/auth");
const gradesService = require("../services/gradesService");

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
    res.status(200).json({ rule });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
