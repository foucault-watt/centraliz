const express = require("express");
const router = express.Router();
const apremService = require("../services/apremService");
const adminCheck = require("../middleware/adminCheck");
const path = require("path");
const admin = require("../data/admin");

router.get("/", (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  res.sendFile(path.join(__dirname, "../../public/aprem.html"));
});

// Récupérer les données du joueur
router.get("/player", async (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    const playerData = await apremService.getPlayerData(
      req.session.user.userName
    );
    res.json(playerData);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Valider un stand
router.post("/validate-stand", async (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const { stand } = req.body;

  if (!stand) {
    return res.status(400).json({ error: "Stand non spécifié" });
  }

  try {
    const success = await apremService.validateStand(
      req.session.user.userName,
      stand
    );
    if (success) {
      res.json({ message: "Stand validé avec succès" });
    } else {
      res.status(400).json({ error: "Stand invalide" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Créer une demande d'essai
router.post("/create-trial", async (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    // Nettoyer les essais expirés
    await apremService.cleanExpiredTrials();

    // Vérifier si le joueur peut demander un essai
    const checkResult = await apremService.canPlayerRequestTrial(
      req.session.user.userName
    );

    if (!checkResult.allowed) {
      return res.status(400).json({ error: checkResult.reason });
    }

    const timestamp = Date.now();
    const trialId = await apremService.createTrial(
      req.session.user.userName,
      timestamp
    );
    res.json({ trialId, expiresAt: timestamp + 120000 });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer les demandes d'essai pour admin
router.get("/trials", adminCheck, async (req, res) => {
  try {
    // Nettoyer les essais expirés
    await apremService.cleanExpiredTrials();

    // Obtenir toutes les demandes
    const allTrials = await apremService.getAllTrials();
    res.json(allTrials);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer les demandes d'essai pour un joueur
router.get("/player-trials", async (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    // Nettoyer les essais expirés
    await apremService.cleanExpiredTrials();

    // Obtenir les demandes du joueur
    const playerTrials = await apremService.getPlayerTrials(
      req.session.user.userName
    );
    res.json(playerTrials);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Valider un essai (admin seulement)
router.post("/validate-trial", adminCheck, async (req, res) => {
  const { trialId } = req.body;

  if (!trialId) {
    return res.status(400).json({ error: "ID de l'essai manquant" });
  }

  try {
    // Vérifier que l'essai existe et est en attente
    const allTrials = await apremService.getAllTrials();
    const trial = allTrials[trialId];

    if (!trial) {
      return res.status(404).json({ error: "Essai introuvable" });
    }

    if (trial.status !== "pending") {
      return res.status(400).json({ error: "Cet essai n'est plus en attente" });
    }

    // Vérifier si le joueur peut encore recevoir une validation
    const playerData = await apremService.getPlayerData(trial.userName);
    const validatedStamps = Object.values(playerData.stands).filter(
      (v) => v
    ).length;

    // Déterminer le nombre maximum d'essais en fonction des tampons
    let maxTrials = 0;
    if (validatedStamps >= 5) {
      maxTrials = 3;
    } else if (validatedStamps >= 3) {
      maxTrials = 2;
    } else if (validatedStamps >= 1) {
      maxTrials = 1;
    }

    if (playerData.trialCount >= maxTrials) {
      return res.status(400).json({
        error: `Le joueur a déjà atteint le maximum d'essais (${playerData.trialCount}/${maxTrials}) pour son niveau de tampons actuel`,
      });
    }

    // Toujours ajouter un seul canard
    const success = await apremService.validateTrial(trialId, 1);
    if (success) {
      res.json({ message: "Essai validé avec succès" });
    } else {
      res
        .status(400)
        .json({ error: "Erreur lors de la validation de l'essai" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Rejeter un essai
router.post("/reject-trial", adminCheck, async (req, res) => {
  const { trialId } = req.body;

  if (!trialId) {
    return res.status(400).json({ error: "Paramètres manquants" });
  }

  try {
    const success = await apremService.rejectTrial(trialId);
    if (success) {
      res.json({ message: "Essai rejeté avec succès" });
    } else {
      res.status(400).json({ error: "Essai introuvable" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Créer une demande de validation de stand
router.post("/request-stand", async (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const { stand } = req.body;

  if (!stand) {
    return res.status(400).json({ error: "Stand non spécifié" });
  }

  try {
    // Nettoyer les demandes expirées
    await apremService.cleanExpiredStandRequests();

    // Vérifier si le joueur peut demander la validation de ce stand
    const checkResult = await apremService.canPlayerRequestStandValidation(
      req.session.user.userName,
      stand
    );

    if (!checkResult.allowed) {
      return res.status(400).json({ error: checkResult.reason });
    }

    const timestamp = Date.now();
    const requestId = await apremService.createStandRequest(
      req.session.user.userName,
      stand,
      timestamp
    );
    res.json({ requestId, expiresAt: timestamp + 120000 });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer toutes les demandes de validation de stand (pour admin)
router.get("/stand-requests", adminCheck, async (req, res) => {
  try {
    // Nettoyer les demandes expirées
    await apremService.cleanExpiredStandRequests();

    // Obtenir toutes les demandes
    const allRequests = await apremService.getAllStandRequests();
    res.json(allRequests);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer les demandes de validation de stand pour un joueur
router.get("/player-stand-requests", async (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    // Nettoyer les demandes expirées
    await apremService.cleanExpiredStandRequests();

    // Obtenir les demandes du joueur
    const playerRequests = await apremService.getPlayerStandRequests(
      req.session.user.userName
    );
    res.json(playerRequests);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Valider une demande de stand
router.post("/validate-stand-request", adminCheck, async (req, res) => {
  const { requestId } = req.body;

  if (!requestId) {
    return res.status(400).json({ error: "ID de demande non spécifié" });
  }

  try {
    // Vérifier que la demande existe et est en attente
    const allRequests = await apremService.getAllStandRequests();
    const request = allRequests[requestId];

    if (!request) {
      return res.status(404).json({ error: "Demande introuvable" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ error: "Cette demande n'est plus en attente" });
    }

    // Vérifier si le stand est déjà validé
    const playerData = await apremService.getPlayerData(request.userName);
    if (playerData.stands[request.stand]) {
      return res
        .status(400)
        .json({ error: "Ce stand est déjà validé pour ce joueur" });
    }

    const success = await apremService.validateStandRequest(requestId);
    if (success) {
      res.json({ message: "Demande de stand validée avec succès" });
    } else {
      res
        .status(400)
        .json({ error: "Erreur lors de la validation de la demande" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Rejeter une demande de stand
router.post("/reject-stand-request", adminCheck, async (req, res) => {
  const { requestId } = req.body;

  if (!requestId) {
    return res.status(400).json({ error: "ID de demande non spécifié" });
  }

  try {
    const success = await apremService.rejectStandRequest(requestId);
    if (success) {
      res.json({ message: "Demande de stand rejetée avec succès" });
    } else {
      res.status(400).json({ error: "Demande introuvable" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
