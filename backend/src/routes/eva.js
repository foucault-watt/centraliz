const express = require("express");
const router = express.Router();
const evaService = require("../services/evaService");

router.get("/config", (req, res) => {
  try {
    const { userName } = req.query;
    if (!userName) {
      return res.status(400).json({ error: "userName est requis" });
    }

    // Vérifier que l'utilisateur existe et obtenir son groupe
    const userGroup = evaService.getUserGroup(userName);
    console.log("userGroup:", userGroup);
    if (!userGroup) {
      return res.status(404).json({ error: "Utilisateur non trouvé ou pas de groupe assigné" });
    }

    // Obtenir la configuration pour ce groupe
    const config = evaService.getEvaluationConfig(userGroup);
    console.log("config", config);
    if (!config) {
      return res.status(404).json({ error: "Pas de configuration pour ce groupe" });
    }

    // Log pour débug
    console.log(`Configuration trouvée pour ${userName} (Groupe: ${userGroup}):`, config);

    res.status(200).json(config);
  } catch (error) {
    console.error("Erreur dans /config:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la configuration", details: error.message });
  }
});

router.post("/", async (req, res) => {
  const { userName: displayName, eventTitle, answers } = req.body;
  try {
    // Trouver le userName correspondant au displayName
    const users = require('../data/users.json');
    const userName = Object.keys(users).find(key => users[key].displayName === displayName);
    
    if (!userName) {
      return res.status(400).json({ error: "Utilisateur non trouvé" });
    }

    // Récupérer la configuration pour le groupe de l'utilisateur
    const userGroup = evaService.getUserGroup(userName);
    if (!userGroup) {
      return res.status(400).json({ error: "Groupe non trouvé pour cet utilisateur" });
    }

    const config = evaService.getEvaluationConfig(userGroup);
    if (!config) {
      return res.status(400).json({ error: "Pas de configuration pour ce groupe" });
    }

    // Valider et sauvegarder l'évaluation
    await evaService.saveEvaluation({ 
      userName: displayName,
      eventTitle, 
      answers,
      userGroup, // Ajouter le groupe ici
      config // Passer la configuration ici
    });

    res.status(200).json({ message: "Évaluation enregistrée" });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement:", error);
    res.status(400).json({ error: error.message });
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

router.get("/export", async (req, res) => {
  try {
    const workbook = await evaService.generateExcelReport();
    
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    const filename = `centraliz_evaluations_${today}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    await workbook.xlsx.write(res);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la génération du rapport Excel" });
  }
});

module.exports = router;