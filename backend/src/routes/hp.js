const express = require("express");
const router = express.Router();
const hpService = require("../services/hpService");
const fs = require("fs");
const path = require("path");

router.get("/hp-data", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "UserId requis" });
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

router.get("/professors", async (req, res) => {
  try {
    const profData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../data/ical-prof.json"), "utf-8")
    );
    res.json(profData);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des professeurs" });
  }
});

router.get("/rooms", async (req, res) => {
  try {
    const roomData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../data/ical-salle.json"), "utf-8")
    );
    res.json(roomData);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des salles" });
  }
});

router.get("/external-calendar", async (req, res) => {
  try {
    const { icalLink } = req.query;
    const data = await hpService.fetchExternalCalendar(icalLink);
    res.send(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération du calendrier externe" });
  }
});

router.get("/calendar/:type/:name", async (req, res) => {
  try {
    const { type, name } = req.params;
    let data;
    const decodedName = decodeURIComponent(name);
    
    if (type === 'prof') {
      const profData = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../data/ical-prof.json"), "utf-8")
      );
      const prof = profData.find(p => p.prof === decodedName);
      if (!prof || !prof.ical_link) {
        return res.status(404).json({ error: "Calendrier du professeur non trouvé" });
      }
      data = await hpService.fetchExternalCalendar(prof.ical_link);
    } 
    else if (type === 'salle') {
      const roomData = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../data/ical-salle.json"), "utf-8")
      );
      
      // Normaliser le nom de la salle pour la recherche
      const normalizedSearchName = decodedName.toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

      const room = roomData.find(r => {
        if (!r.salle) return false;
        const normalizedRoomName = r.salle.toUpperCase()
          .replace(/\s+/g, ' ')
          .trim();
        return normalizedRoomName === normalizedSearchName;
      });

      if (!room || !room.ical_link) {
        return res.status(404).json({ 
          error: "Calendrier de la salle non trouvé",
          searchedName: normalizedSearchName,
          availableRooms: roomData
            .filter(r => r.salle)
            .map(r => r.salle)
        });
      }
      data = await hpService.fetchExternalCalendar(room.ical_link);
    }
    else {
      return res.status(400).json({ error: "Type de calendrier invalide" });
    }

    res.send(data);
  } catch (error) {
    console.error("Erreur lors de la récupération du calendrier:", error);
    res.status(500).json({ 
      error: "Erreur lors de la récupération du calendrier",
      details: error.message 
    });
  }
});

module.exports = router;
