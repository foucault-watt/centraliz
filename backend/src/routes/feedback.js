const express = require('express');
const router = express.Router();
const feedbackService = require('../services/feedbackService');

router.post('/feedback', (req, res) => {
  try {
    const { username, text } = req.body;
    
    if (!username || !text) {
      return res.status(400).json({ error: 'Username et texte requis' });
    }

    const feedback = feedbackService.addFeedback(username, text);
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Erreur route POST /feedback:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'ajout du feedback' });
  }
});

router.get('/feedback', (req, res) => {
  try {
    const feedbacks = feedbackService.getFeedbacks();
    res.json(feedbacks);
  } catch (error) {
    console.error('Erreur route GET /feedback:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des feedbacks' });
  }
});

module.exports = router;