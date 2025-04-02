const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require('fs');

// Remplacez par les noms de vos fichiers JSON
const allowedFiles = [
  "feedbacks.json",
  "logins.json",
  "users.json",
  "backend.log",
  "evaluations.json",
  "leaderboard.json",
  "coef.json",
<<<<<<< Updated upstream
<<<<<<< Updated upstream
=======
=======
>>>>>>> Stashed changes
  "jazz.json",
  "aprem.json",
  "cads-users.json",
>>>>>>> Stashed changes
];

router.get(`/public-data/${process.env.SECRET_API}/last`, (req, res) => {
  try {
    const loginsPath = path.join(__dirname, "../data/logins.json");
    const loginsData = JSON.parse(fs.readFileSync(loginsPath, 'utf8'));
    
    const allConnections = Object.entries(loginsData)
      .flatMap(([name, connections]) => 
        connections.map(connection => ({
          name,
          connection: new Date(connection)
        }))
      )
      .sort((a, b) => b.connection - a.connection)
      .map(({ name, connection }) => {
        const date = connection.toLocaleDateString('fr-FR');
        const time = connection.toLocaleTimeString('fr-FR');
        return `${date} ${time} - ${name}`;
      });

    res.json(allConnections);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la lecture des connexions" });
  }
});

router.get(`/public-data/${process.env.SECRET_API}/:filename`, (req, res) => {
  const filename = req.params.filename;

  if (!allowedFiles.includes(filename)) {
    return res.status(404).json({ error: "Fichier non trouvé" });
  }

  const filePath = path.join(__dirname, "../data", filename);
  res.sendFile(filePath);
});

module.exports = router;
