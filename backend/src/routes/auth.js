const express = require("express");
const router = express.Router();
const casService = require("../services/casService");
const fs = require("fs");
const path = require("path");

const USER_DATA_FILE = path.join(__dirname, "../data/users.json");

router.get("/status", (req, res) => {
  res.json({
    authenticated: !!req.session.user,
    user: req.session.user || null,
  });
});

router.get("/check-onboarding", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const { userName } = req.session.user;
  const isIE1Member = req.session.user.isIE1Member || false;

  try {
    const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, "utf-8"));
    const user = users[userName];

    // Bypass onboarding pour les membres de IE1
    if (isIE1Member) {
      return res.json({ needsOnboarding: false });
    }

    // Vérification normale pour les autres utilisateurs
    // L'onboarding est terminé si l'utilisateur a un lien iCal OU a explicitement sauté cette étape
    const needsOnboarding = !user || (!user.icalLink && !user.skippedIcal);
    res.json({ needsOnboarding });
  } catch (error) {
    console.error("Erreur lors de la vérification onboarding:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/skip-ical-setup", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const { userName } = req.session.user;

  try {
    const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, "utf-8"));

    // Marquer que l'utilisateur a explicitement choisi de sauter cette étape
    if (users[userName]) {
      users[userName].skippedIcal = true;
      fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
      return res.json({ success: true });
    }

    // Si l'utilisateur n'existe pas encore dans le fichier
    users[userName] = {
      userName: userName,
      displayName: req.session.user.displayName || null,
      icalLink: null,
      skippedIcal: true,
      isIE1Member: req.session.user.isIE1Member || false,
    };

    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors du skip de l'étape iCal:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/login", casService.login);
router.get("/callback", casService.callback);

module.exports = router;
