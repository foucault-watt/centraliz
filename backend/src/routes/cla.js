const express = require("express");
const router = express.Router();
const icalService = require("../services/claService");

router.get("/cla-data", async (req, res) => {
  try {
    const icalData = await icalService.fetchIcalData();
    if (!icalData) {
      res.status(404).json({ error: "Données calendrier CLA non disponibles" });
      return;
    }
    res.send(icalData);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des données iCal" });
  }
});

// Route pour récupérer les deux calendriers
router.get("/calendars-data", async (req, res) => {
  try {
    // Définir un délai maximum pour la réponse (10 secondes)
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          cla: { success: false, error: "Délai d'attente dépassé" },
          fablab: { success: false, error: "Délai d'attente dépassé" },
        });
      }, 10000);
    });

    // Course entre la récupération des calendriers et le timeout
    const calendarsData = await Promise.race([
      icalService.fetchAllCalendarsData(),
      timeoutPromise,
    ]);

    res.json(calendarsData);
  } catch (error) {
    console.error("Erreur dans la route /calendars-data:", error.message);
    res.status(500).json({
      cla: { success: false, error: "Erreur serveur" },
      fablab: { success: false, error: "Erreur serveur" },
    });
  }
});

module.exports = router;
