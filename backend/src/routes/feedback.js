const express = require('express');
const router = express.Router();
const feedbackService = require('../services/feedbackService');

router.post('/feedback', (req, res) => {
  try {
    const displayName = req.session.user.displayName;
    const { text } = req.body;
    
    if (!displayName || !text) {
      return res.status(400).json({ error: 'displayName et texte requis' });
    }

    const feedback = feedbackService.addFeedback(displayName, text);
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Erreur route POST /feedback:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'ajout du feedback' });
  }
});

module.exports = router;