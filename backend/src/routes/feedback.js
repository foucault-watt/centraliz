const express = require('express');
const router = express.Router();
const feedbackService = require('../services/feedbackService');
const authMiddleware = require("../middlewares/auth");

router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;
    const { text } = req.body;

    if (!userName || !text) {
      return res.status(400).json({ error: 'username et texte requis' });
    }

    const feedback = await feedbackService.addFeedback(userName, text);
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Erreur route POST /feedback:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'ajout du feedback' });
  }
});

module.exports = router;