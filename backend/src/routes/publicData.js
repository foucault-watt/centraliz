const express = require("express");
const router = express.Router();
const path = require("path");

// Remplacez par les noms de vos fichiers JSON
const allowedFiles = [
  "feedbacks.json",
  "logins.json",
  "users.json",
  "backend.log",
  "evaluations.json",
];

router.get(`/public-data/${process.env.SECRET_API}/:filename`, (req, res) => {
  const filename = req.params.filename;

  if (!allowedFiles.includes(filename)) {
    return res.status(404).json({ error: "Fichier non trouvé" });
  }

  const filePath = path.join(__dirname, "../data", filename);
  res.sendFile(filePath);
});

module.exports = router;
