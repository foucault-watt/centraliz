const express = require("express");
const router = express.Router();
const hpService = require("../services/hpService");

router.get("/hp-data", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'UserId requis' });
    }
    const hpData = await hpService.fetchHpData(userId);
    res.send(hpData);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des données hp" });
  }
});

router.get("/check-user/", async (req, res) => {
  try {
    const userId = req.session.user.userName;
    const result = hpService.checkUser(userId);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la vérification de l'utilisateur" });
  }
});

router.post("/validate-ical", async (req, res) => {
  try {
    const { icalLink } = req.body;
    if (!icalLink) {
      return res.status(400).json({ error: "icalLink requis" });
    }
    const result = await hpService.validateIcal(icalLink);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la validation du lien iCal" });
  }
});

router.post("/save-user", async (req, res) => {
  try {
    const { userId, icalLink } = req.body;
    if (!userId || !icalLink) {
      return res.status(400).json({ error: "UserId et icalLink requis" });
    }
    const result = await hpService.saveUser(userId, icalLink);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de l'enregistrement de l'utilisateur" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await hpService.getAllUsers();
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des utilisateurs" });
  }
});

module.exports = router;
