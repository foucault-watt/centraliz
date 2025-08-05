const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const supabase = require('../utils/supabaseClient');

router.get('/', async (req, res) => {
  try {
    // Charger les données utilisateur depuis Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('group')
      .eq('username', req.session.user.userName)
      .single();

    if (error || !user || !user.group) {
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
