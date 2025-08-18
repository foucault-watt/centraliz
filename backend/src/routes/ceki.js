const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const cekiService = require("../services/cekiService");
const authMiddleware = require("../middlewares/auth");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_SIZE = 500; // 500x500px
const PHOTO_QUALITY = 90; // 90% qualité JPEG

console.log("Ceki routes loaded");

// Configuration de multer pour l'upload de fichiers
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Type de fichier non autorisé. Seuls JPG, PNG et WEBP sont acceptés."
        ),
        false
      );
    }
  },
});

/**
 * GET /api/ceki/photo-status
 * Vérifie si l'utilisateur a une photo de profil
 */
router.get("/photo-status", authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;
    const photoStatus = await cekiService.checkUserPhoto(userName);

    res.json({
      success: true,
      hasPhoto: photoStatus.hasPhoto,
      photoName: photoStatus.photoName,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la vérification du statut de la photo:",
      error
    );
    res.status(500).json({
      success: false,
      error: "Erreur lors de la vérification du statut de la photo",
    });
  }
});

/**
 * POST /api/ceki/upload-photo
 * Upload et traitement d'une photo de profil
 */
router.post(
  "/upload-photo",
  authMiddleware,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Aucun fichier fourni",
        });
      }

      const userName = req.session.user.userName;

      // Vérifier si l'utilisateur a déjà une photo et la supprimer
      const currentPhotoStatus = await cekiService.checkUserPhoto(userName);
      if (currentPhotoStatus.hasPhoto && currentPhotoStatus.photoName) {
        await cekiService.deletePhotoFile(currentPhotoStatus.photoName);
      }

      // Générer un nom de fichier unique
      const fileExtension = req.file.mimetype === "image/png" ? "png" : "jpg";
      const fileName = cekiService.generateRandomFileName(fileExtension);
      const filePath = path.join(__dirname, "../data/profile-photos", fileName);

      // Traitement et compression de l'image avec Sharp
      await sharp(req.file.buffer)
        .resize(PHOTO_SIZE, PHOTO_SIZE, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: PHOTO_QUALITY })
        .toFile(filePath);

      // Mettre à jour la base de données
      const updateSuccess = await cekiService.updateUserPhoto(
        userName,
        fileName
      );

      if (!updateSuccess) {
        // Si la mise à jour de la BDD échoue, supprimer le fichier
        await cekiService.deletePhotoFile(fileName);
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la mise à jour de la base de données",
        });
      }

      res.json({
        success: true,
        message: "Photo uploadée avec succès",
        photoName: fileName,
      });
    } catch (error) {
      console.error("Erreur lors de l'upload de la photo:", error);

      // Gestion des erreurs spécifiques de multer
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "Le fichier est trop volumineux (maximum 10MB)",
        });
      }

      if (error.message.includes("Type de fichier non autorisé")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: "Erreur lors de l'upload de la photo",
      });
    }
  }
);

/**
 * DELETE /api/ceki/delete-photo
 * Supprime la photo de profil de l'utilisateur
 */
router.delete("/delete-photo", authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;

    // Vérifier si l'utilisateur a une photo
    const currentPhotoStatus = await cekiService.checkUserPhoto(userName);
    if (!currentPhotoStatus.hasPhoto) {
      return res.status(404).json({
        success: false,
        error: "Aucune photo à supprimer",
      });
    }

    // Supprimer le fichier
    if (currentPhotoStatus.photoName) {
      await cekiService.deletePhotoFile(currentPhotoStatus.photoName);
    }

    // Mettre à jour la base de données
    const removeSuccess = await cekiService.removeUserPhoto(userName);

    if (!removeSuccess) {
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la suppression de la photo",
      });
    }

    res.json({
      success: true,
      message: "Photo supprimée avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de la photo:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression de la photo",
    });
  }
});

/**
 * GET /api/ceki/promos-stats
 * Récupère les statistiques des promos (nombre de personnes avec photos par promo)
 */
router.get("/promos-stats", authMiddleware, async (req, res) => {
  try {
    const promosStats = await cekiService.getPromosStats();

    res.json({
      success: true,
      promos: promosStats,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des stats promos:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des statistiques des promos",
    });
  }
});

/**
 * POST /api/ceki/game/start-competitive
 * Démarre une nouvelle session de jeu compétitif.
 */
router.post("/game/start-competitive", authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;
    const { selectedGroups } = req.body;

    if (!selectedGroups || selectedGroups.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Aucun groupe sélectionné pour le mode compétitif.",
      });
    }

    // Vérifier que l'utilisateur a une photo pour pouvoir jouer
    const userPhotoStatus = await cekiService.checkUserPhoto(userName);
    if (!userPhotoStatus.hasPhoto) {
      return res.status(403).json({
        success: false,
        error: "Vous devez avoir une photo de profil pour jouer.",
      });
    }

    const gameId = cekiService.createCompetitiveGameSession(
      userName,
      selectedGroups
    );

    res.json({
      success: true,
      gameId: gameId,
      currentRound: 0,
      totalScore: 0,
    });
  } catch (error) {
    console.error("Erreur lors du démarrage du jeu compétitif:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du démarrage du jeu compétitif.",
    });
  }
});

/**
 * GET /api/ceki/game/round
 * Génère un nouveau round de jeu.
 * Pour le mode compétitif, nécessite un gameId.
 */
router.get("/game/round", authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;
    const gameId = req.query.gameId; // Peut être null pour le mode sans fin

    // Vérifier que l'utilisateur a une photo pour pouvoir jouer
    const userPhotoStatus = await cekiService.checkUserPhoto(userName);
    if (!userPhotoStatus.hasPhoto) {
      return res.status(403).json({
        success: false,
        error: "Vous devez avoir une photo de profil pour jouer.",
      });
    }

    let gameRound;
    if (gameId) {
      // Mode compétitif
      const session = cekiService.getCompetitiveGameSession(gameId);
      if (!session || session.userId !== userName) {
        return res.status(404).json({
          success: false,
          error: "Session de jeu non trouvée ou non autorisée.",
        });
      }
      gameRound = await cekiService.generateGameRound(gameId);
    } else {
      // Mode sans fin (comportement existant)
      const selectedGroups = req.query.groups
        ? req.query.groups.split(",")
        : [];
      gameRound = await cekiService.generateGameRound(selectedGroups);
    }

    if (!gameRound) {
      return res.status(503).json({
        success: false,
        error:
          "Impossible de générer un round de jeu. Pas assez d'utilisateurs avec des photos dans les promos sélectionnées.",
      });
    }

    res.json({
      success: true,
      roundId: gameRound.roundId,
      photoUrl: gameRound.photoUrl,
      choices: gameRound.choices,
      currentRound: gameRound.currentRound, // Sera 0 pour le mode sans fin, ou le numéro de round pour compétitif
      totalScore: gameRound.totalScore, // Sera 0 pour le mode sans fin, ou le score cumulé pour compétitif
    });
  } catch (error) {
    console.error("Erreur lors de la génération du round:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la génération du round de jeu.",
    });
  }
});

/**
 * POST /api/ceki/game/start-timer
 * Démarre le chrono côté serveur pour un round de jeu compétitif après confirmation du chargement de l'image.
 */
router.post("/game/start-timer", authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;
    const { gameId, roundId } = req.body;

    if (!gameId || !roundId) {
      return res.status(400).json({
        success: false,
        error: "gameId et roundId sont requis.",
      });
    }

    // Vérifier que la session appartient à l'utilisateur
    const session = cekiService.getCompetitiveGameSession(gameId);
    if (!session || session.userId !== userName) {
      return res.status(404).json({
        success: false,
        error: "Session de jeu non trouvée ou non autorisée.",
      });
    }

    // Démarrer le chrono côté serveur
    const success = cekiService.startRoundTimer(gameId, roundId);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Impossible de démarrer le chrono. Round non trouvé.",
      });
    }

    res.json({
      success: true,
      message: "Chrono démarré côté serveur.",
      serverTime: Date.now(), // Optionnel : pour synchronisation frontend
    });
  } catch (error) {
    console.error("Erreur lors du démarrage du chrono:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du démarrage du chrono.",
    });
  }
});

/**
 * POST /api/ceki/game/answer
 * Vérifie la réponse d'un utilisateur et met à jour l'état du jeu.
 * Pour le mode compétitif, nécessite un gameId.
 */
router.post("/game/answer", authMiddleware, async (req, res) => {
  try {
    const { roundId, choiceId, timeElapsed, gameId } = req.body; // gameId est ajouté ici

    if (!roundId || !choiceId) {
      return res.status(400).json({
        success: false,
        error: "roundId et choiceId sont requis.",
      });
    }

    // Le temps écoulé est optionnel pour la compatibilité avec l'ancien mode
    const time = timeElapsed !== undefined ? timeElapsed : 5000;

    let result;
    if (gameId) {
      // Mode compétitif
      const session = cekiService.getCompetitiveGameSession(gameId);
      if (!session || session.userId !== req.session.user.userName) {
        return res.status(404).json({
          success: false,
          error: "Session de jeu non trouvée ou non autorisée.",
        });
      }
      result = await cekiService.verifyAnswer(
        gameId,
        roundId,
        parseInt(choiceId),
        time
      );
    } else {
      // Mode sans fin (comportement existant)
      result = cekiService.verifyAnswer(roundId, parseInt(choiceId), time);
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Round non trouvé ou expiré.",
      });
    }

    res.json({
      success: true,
      correct: result.correct,
      scoreGainedThisRound: result.scoreGainedThisRound, // Score pour ce round
      totalScore: result.totalScore, // Score cumulé (compétitif) ou score du round (sans fin)
      currentRound: result.currentRound, // Numéro de round actuel (compétitif)
      isGameOver: result.isGameOver, // Indique si la partie est terminée (compétitif)
      correctAnswer: result.correctAnswer,
    });
  } catch (error) {
    console.error("Erreur lors de la vérification de la réponse:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la vérification de la réponse.",
    });
  }
});

/**
 * GET /api/ceki/photo/:filename
 * Sert les images de profil
 */
router.get("/photo/:filename", authMiddleware, async (req, res) => {
  try {
    const fileName = req.params.filename;

    // Validation du nom de fichier pour éviter les attaques de traversée de répertoire
    if (
      !fileName ||
      fileName.includes("..") ||
      fileName.includes("/") ||
      fileName.includes("\\")
    ) {
      return res.status(400).json({
        success: false,
        error: "Nom de fichier invalide",
      });
    }

    const filePath = path.join(__dirname, "../data/profile-photos", fileName);

    // Vérifier que le fichier existe
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: "Photo non trouvée",
      });
    }

    // Définir le type de contenu approprié
    const ext = path.extname(fileName).toLowerCase();
    let contentType = "image/jpeg";
    if (ext === ".png") contentType = "image/png";
    if (ext === ".webp") contentType = "image/webp";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache 1 heure

    // Envoyer le fichier
    res.sendFile(filePath);
  } catch (error) {
    console.error("Erreur lors de la récupération de la photo:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la photo",
    });
  }
});

module.exports = router;
