const express = require('express');
const router = express.Router();
const feedbackService = require('../services/feedbackService');
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const analyticsService = require("../services/analyticsService");

router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;
    const result = await feedbackService.addFeedback(userName, req.body);
    if (result.status < 400) {
      analyticsService.trackEvent({
        req,
        eventName: "feedback_submitted",
        module: "feedback",
        properties: {
          type: req.body?.type,
          area: req.body?.area,
          priority: req.body?.priority,
          wants_response: Boolean(req.body?.wants_response),
        },
      });
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur route POST /feedback:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de l\'ajout du retour' });
  }
});

router.get('/feedback/me', authMiddleware, async (req, res) => {
  try {
    const result = await feedbackService.listUserFeedbacks(
      req.session.user.userName,
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur route GET /feedback/me:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la récupération des retours' });
  }
});

router.get('/feedback/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await feedbackService.listAdminFeedbacks({
      status: req.query.status,
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur route GET /feedback/admin:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la récupération admin des retours' });
  }
});

router.put('/feedback/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await feedbackService.updateAdminFeedback(
      req.params.id,
      req.session.user.userName,
      req.body,
    );
    if (result.status < 400) {
      analyticsService.trackEvent({
        req,
        eventName: "feedback_admin_updated",
        module: "feedback",
        properties: {
          admin_status: req.body?.admin_status,
          has_response: Boolean(req.body?.admin_response),
        },
      });
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur route PUT /feedback/admin/:id:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la mise à jour du retour' });
  }
});

router.delete('/feedback/:id', authMiddleware, async (req, res) => {
  try {
    const result = await feedbackService.deleteUserFeedback(
      req.params.id,
      req.session.user.userName,
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur route DELETE /feedback/:id:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la suppression du retour' });
  }
});

router.delete('/feedback/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await feedbackService.deleteAdminFeedback(req.params.id);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur route DELETE /feedback/admin/:id:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la suppression admin du retour' });
  }
});

module.exports = router;
