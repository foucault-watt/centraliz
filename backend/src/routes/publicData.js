const express = require("express");
const router = express.Router();
const supabase = require('../utils/supabaseClient'); // Importez le client Supabase

router.get(`/public-data/${process.env.SECRET_API}/last`, async (req, res) => {
  try {
    const { data: logins, error } = await supabase
      .from('user_logins')
      .select('username, login_time')
      .order('login_time', { ascending: false })
      .limit(10); // Récupérer les 10 dernières connexions, ou ajuster selon le besoin

    if (error) {
      console.error("Erreur lors de la récupération des connexions depuis Supabase:", error);
      return res.status(500).json({ error: "Erreur lors de la récupération des connexions" });
    }

    const allConnections = logins.map(login => {
      const date = new Date(login.login_time).toLocaleDateString('fr-FR');
      const time = new Date(login.login_time).toLocaleTimeString('fr-FR');
      return `${date} ${time} - ${login.username}`;
    });

    res.json(allConnections);
  } catch (error) {
    console.error("Erreur inattendue lors de la récupération des connexions:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des connexions" });
  }
});

// La route pour les fichiers statiques n'est plus nécessaire si les fichiers JSON sont supprimés.
// Si d'autres fichiers statiques sont toujours servis, cette route devra être adaptée.
// Pour l'instant, je la supprime car le feedback indique que les JSON n'existent plus.
// Si des fichiers comme 'backend.log' doivent être servis, une nouvelle approche sera nécessaire.

module.exports = router;
