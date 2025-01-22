const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/', (req, res) => {
  try {
    // Charger les données utilisateur
    const usersPath = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const user = users[req.session.user.userName];

    if (!user || !user.group) {
      return res.status(404).json({ error: 'Utilisateur ou groupe non trouvé' });
    }

    // Charger les coefficients
    const coefsPath = path.join(__dirname, '../data/coef.json');
    const coefs = JSON.parse(fs.readFileSync(coefsPath, 'utf-8'));

    if (!coefs.groups[user.group]) {
      return res.status(404).json({ error: 'Coefficients non trouvés pour ce groupe' });
    }

    res.json(coefs);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
