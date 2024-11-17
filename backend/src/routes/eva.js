const express = require("express");
const router = express.Router();
const evaService = require("../services/evaService");

router.post("/", async (req, res) => {
  const { userName, eventTitle, rating, comment } = req.body;
  try {
    await evaService.saveEvaluation({ userName, eventTitle, rating, comment });
    res.status(200).json({ message: "Évaluation enregistrée" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'enregistrement" });
  }
});

router.get("/check", async (req, res) => {
  const { userName, eventTitle } = req.query;
  try {
    const hasEvaluated = await evaService.hasEvaluated(userName, eventTitle);
    res.status(200).json({ hasEvaluated });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la vérification" });
  }
});

router.get("/get", async (req, res) => {
  const { userName, eventTitle } = req.query;
  try {
    const evaluation = await evaService.getEvaluation(userName, eventTitle);
    if (evaluation) {
      res.status(200).json(evaluation);
    } else {
      res.status(404).json({ error: "Évaluation non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

module.exports = router;