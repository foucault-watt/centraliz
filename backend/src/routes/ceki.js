const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const cekiService = require("../services/cekiService");
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const analyticsService = require("../services/analyticsService");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_SIZE = 500; // 500x500px
const PHOTO_QUALITY = 90; // 90% qualité JPEG

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
      isBanned: photoStatus.isBanned,
      isAdmin: photoStatus.isAdmin,
      noPhotoCompetitiveGamesPlayed:
        photoStatus.noPhotoCompetitiveGamesPlayed,
      remainingFreeCompetitiveGames:
        photoStatus.remainingFreeCompetitiveGames,
      canPlayCompetitiveWithoutPhoto:
        photoStatus.canPlayCompetitiveWithoutPhoto,
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
      if (currentPhotoStatus.isBanned) {
        return res.status(403).json({
          success: false,
          error: "Vous êtes temporairement banni de l'upload de photos.",
        });
      }
      if (currentPhotoStatus.hasPhoto && currentPhotoStatus.photoName) {
        await cekiService.deletePhotoFile(currentPhotoStatus.photoName);
      }

      // Générer un nom de fichier unique (déclaré une seule fois)
      const fileExtension = req.file.mimetype === "image/png" ? "png" : "jpg";
      const fileName = cekiService.generateRandomFileName(fileExtension);
      const filePath = path.join(__dirname, "../data/profile-photos", fileName);

      // Traitement et compression de l'image avec Sharp pour obtenir le buffer traité
      const processedImageBuffer = await sharp(req.file.buffer)
        .resize(PHOTO_SIZE, PHOTO_SIZE, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: PHOTO_QUALITY })
        .toBuffer(); // Utiliser toBuffer() au lieu de toFile()

      // Vérifier la présence de visage si la fonctionnalité est activée
      const isFaceDetected = await cekiService.verifyFaceInImage(
        processedImageBuffer
      );
      if (!isFaceDetected) {
        return res.status(400).json({
          success: false,
          error:
            "Aucun visage détecté sur la photo. Veuillez en choisir une autre.",
        });
      }

      // Si la vérification de visage est réussie, écrire le fichier et mettre à jour la BDD
      await fs.writeFile(filePath, processedImageBuffer); // Écrire le fichier seulement si la vérification réussit

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
      analyticsService.trackEvent({
        req,
        eventName: "ceki_photo_uploaded",
        module: "cekilui",
        eventType: "conversion",
        isAutomatic: false,
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
    let noPhotoAccess = null;

    if (!userPhotoStatus.hasPhoto) {
      if (!userPhotoStatus.canPlayCompetitiveWithoutPhoto) {
        return res.status(403).json({
          success: false,
          error:
            "Vous avez utilisé vos 2 parties d'essai. Ajoutez une photo pour continuer à jouer.",
          requiresPhoto: true,
        });
      }

      const allPlayablePromos = await cekiService.getAllPlayablePromoGroups();
      const sortedSelectedGroups = [...selectedGroups].sort();
      const sortedAllPlayablePromos = [...allPlayablePromos].sort();
      const isAllPromosSelection =
        sortedSelectedGroups.length === sortedAllPlayablePromos.length &&
        sortedSelectedGroups.every(
          (group, index) => group === sortedAllPlayablePromos[index]
        );

      if (!isAllPromosSelection) {
        return res.status(403).json({
          success: false,
          error:
            "Sans photo, l'essai gratuit est disponible uniquement en mode compétitif sur toutes les promos.",
          requiresAllPromos: true,
        });
      }

      const playableUsers = await cekiService.getUsersWithPhotosByGroups(
        selectedGroups
      );
      if (playableUsers.length < 10) {
        return res.status(400).json({
          success: false,
          error:
            "Pas assez de joueurs avec photo pour lancer une partie compétitive toutes promos pour le moment.",
        });
      }

      noPhotoAccess = await cekiService.incrementNoPhotoCompetitiveGamesPlayed(
        userName
      );

      if (!noPhotoAccess) {
        return res.status(500).json({
          success: false,
          error:
            "Impossible d'enregistrer votre partie d'essai pour le moment.",
        });
      }
    }

    const gameId = cekiService.createCompetitiveGameSession(
      userName,
      selectedGroups,
      {
        isNoPhotoTrial: !userPhotoStatus.hasPhoto,
      }
    );
    analyticsService.trackEvent({
      req,
      eventName: "ceki_game_started",
      module: "cekilui",
      eventType: "interaction",
      isAutomatic: false,
      properties: {
        mode: "competitive",
        selected_group_count: selectedGroups.length,
      },
    });

    res.json({
      success: true,
      gameId: gameId,
      currentRound: 0,
      totalScore: 0,
      noPhotoTrial: !userPhotoStatus.hasPhoto,
      noPhotoCompetitiveGamesPlayed:
        noPhotoAccess?.noPhotoCompetitiveGamesPlayed ??
        userPhotoStatus.noPhotoCompetitiveGamesPlayed,
      remainingFreeCompetitiveGames:
        noPhotoAccess?.remainingFreeCompetitiveGames ??
        userPhotoStatus.remainingFreeCompetitiveGames,
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
 * POST /api/ceki/game/start-endless
 * Démarre une nouvelle session de jeu en mode sans fin.
 */
router.post("/game/start-endless", authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;
    const { selectedGroups } = req.body;

    // La sélection de groupe est optionnelle pour le mode sans fin, mais si elle est vide, on prend tout.
    const groups =
      selectedGroups && selectedGroups.length > 0 ? selectedGroups : [];

    const userPhotoStatus = await cekiService.checkUserPhoto(userName);
    if (!userPhotoStatus.hasPhoto) {
      return res.status(403).json({
        success: false,
        error: "Vous devez avoir une photo de profil pour jouer.",
      });
    }

    const gameId = cekiService.createEndlessGameSession(userName, groups);
    analyticsService.trackEvent({
      req,
      eventName: "ceki_game_started",
      module: "cekilui",
      eventType: "interaction",
      isAutomatic: false,
      properties: {
        mode: "endless",
        selected_group_count: groups.length,
      },
    });

    res.json({
      success: true,
      gameId: gameId,
    });
  } catch (error) {
    console.error("Erreur lors du démarrage du jeu sans fin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du démarrage du jeu sans fin.",
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

    const userPhotoStatus = await cekiService.checkUserPhoto(userName);
    const session = gameId
      ? cekiService.getCompetitiveGameSession(gameId)
      : null;
    const canBypassPhotoRequirement =
      session &&
      session.userId === userName &&
      session.isNoPhotoTrial === true;

    if (!userPhotoStatus.hasPhoto && !canBypassPhotoRequirement) {
      return res.status(403).json({
        success: false,
        error:
          "Vous devez avoir une photo de profil pour jouer ou utiliser une partie d'essai compétitive.",
      });
    }

    let gameRound;
    if (gameId) {
      // Mode compétitif
      if (!session || session.userId !== userName) {
        return res.status(404).json({
          success: false,
          error: "Session de jeu non trouvée ou non autorisée.",
        });
      }
      gameRound = await cekiService.generateGameRound({ gameId });
    } else {
      // Mode sans fin (comportement existant) - DÉPRÉCIÉ, passe maintenant par gameId
      // On garde ce bloc pour une potentielle compatibilité descendante, mais la logique
      // frontend devrait être mise à jour pour toujours créer une session et passer un gameId.
      const selectedGroups = req.query.groups
        ? req.query.groups.split(",")
        : [];
      gameRound = await cekiService.generateGameRound({ selectedGroups });
    }

    if (!gameRound || gameRound.error) {
      return res.status(400).json({
        success: false,
        error:
          gameRound.error ||
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
      supportBds: gameRound.supportBds || null,
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
      result = await cekiService.verifyAnswer({
        gameId,
        roundId,
        choiceId: parseInt(choiceId),
        timeElapsed: time,
      });
    } else {
      // Mode sans fin (comportement existant)
      result = await cekiService.verifyAnswer({
        roundId,
        choiceId: parseInt(choiceId),
        timeElapsed: time,
      });
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Round non trouvé ou expiré.",
      });
    }

    analyticsService.trackEvent({
      req,
      eventName: "ceki_round_answered",
      module: "cekilui",
      eventType: "interaction",
      isAutomatic: false,
      properties: { mode: gameId ? "competitive" : "endless" },
    });

    if (result.isGameOver) {
      analyticsService.trackEvent({
        req,
        eventName: "ceki_game_finished",
        module: "cekilui",
        eventType: "conversion",
        isAutomatic: false,
        properties: {
          mode: gameId ? "competitive" : "endless",
          current_round: result.currentRound,
        },
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

/**
 * POST /api/ceki/report-photo
 * Permet à un utilisateur de signaler une photo.
 */
router.post("/report-photo", authMiddleware, async (req, res) => {
  try {
    const { photoName, reason, details } = req.body;
    const reportedByUsername = req.session.user.userName;

    if (!photoName || !reason) {
      return res.status(400).json({
        success: false,
        error: "Le nom de la photo et la raison sont requis.",
      });
    }

    const success = await cekiService.createPhotoReport({
      photoName,
      reportedByUsername,
      reason,
      details,
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la création du signalement.",
      });
    }

    analyticsService.trackEvent({
      req,
      eventName: "ceki_photo_reported",
      module: "cekilui",
      eventType: "interaction",
      isAutomatic: false,
      properties: { reason },
    });

    res.json({
      success: true,
      message: "La photo a été signalée avec succès.",
    });
  } catch (error) {
    console.error("Erreur lors du signalement de la photo:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur lors du signalement de la photo.",
    });
  }
});

/**
 * GET /api/ceki/admin/reported-photos
 * Récupère toutes les photos signalées. Accès admin uniquement.
 */
router.get(
  "/admin/reported-photos",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const reportedPhotos = await cekiService.getReportedPhotos();

      if (reportedPhotos === null) {
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la récupération des photos signalées.",
        });
      }

      res.json({
        success: true,
        reportedPhotos: reportedPhotos,
      });
    } catch (error) {
      console.error("Erreur dans la route getReportedPhotos:", error);
      res.status(500).json({
        success: false,
        error: "Erreur serveur lors de la récupération des photos signalées.",
      });
    }
  }
);

/**
 * POST /api/ceki/admin/resolve-report
 * Permet à un admin de résoudre un signalement.
 */
router.post(
  "/admin/resolve-report",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { action, photoName, username, banDuration } = req.body;

    try {
      if (!action || !photoName) {
        return res
          .status(400)
          .json({ success: false, error: "Action et nom de photo requis." });
      }

      let resolutionStatus;

      switch (action) {
        case "delete_photo":
          // On doit récupérer le nom de l'utilisateur qui a posté la photo
          const { data: user, error } = await cekiService.getUserByPhotoName(
            photoName
          );
          if (error || !user) {
            return res
              .status(404)
              .json({
                success: false,
                error: "Utilisateur de la photo non trouvé.",
              });
          }
          await cekiService.deletePhotoFile(photoName);
          await cekiService.removeUserPhoto(user.username);
          resolutionStatus = await cekiService.resolveReportsForPhoto(
            photoName,
            "resolved_photo_deleted"
          );
          break;

        case "ban_user":
          if (!banDuration) {
            return res
              .status(400)
              .json({
                success: false,
                error: "La durée de bannissement est requise.",
              });
          }
          const { data: userToBan, error: banError } =
            await cekiService.getUserByPhotoName(photoName);
          if (banError || !userToBan) {
            return res
              .status(404)
              .json({
                success: false,
                error: "Utilisateur de la photo non trouvé.",
              });
          }
          await cekiService.banUserPhotoUpload(userToBan.username, banDuration);
          resolutionStatus = await cekiService.resolveReportsForPhoto(
            photoName,
            `resolved_user_banned_${banDuration}d`
          );
          break;

        case "dismiss":
          resolutionStatus = await cekiService.resolveReportsForPhoto(
            photoName,
            "resolved_dismissed"
          );
          break;

        default:
          return res
            .status(400)
            .json({ success: false, error: "Action non valide." });
      }

      if (!resolutionStatus) {
        return res
          .status(500)
          .json({
            success: false,
            error: "Erreur lors de la résolution du signalement.",
          });
      }

      res.json({
        success: true,
        message: `Signalement pour ${photoName} traité avec succès.`,
      });
    } catch (error) {
      console.error("Erreur lors de la résolution du signalement:", error);
      res.status(500).json({ success: false, error: "Erreur serveur." });
    }
  }
);

/**
 * GET /api/ceki/leaderboard
 * Récupère le classement pour un type de jeu donné.
 */
router.get("/leaderboard", authMiddleware, async (req, res) => {
  try {
    const gameType = req.query.type;

    if (!gameType) {
      return res.status(400).json({
        success: false,
        error: "Le paramètre 'type' est requis.",
      });
    }

    const leaderboard = await cekiService.getLeaderboard(gameType);

    if (leaderboard === null) {
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération du classement.",
      });
    }

    res.json({
      success: true,
      leaderboard: leaderboard,
    });
  } catch (error) {
    console.error("Erreur dans la route getLeaderboard:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur lors de la récupération du classement.",
    });
  }
});

module.exports = router;
