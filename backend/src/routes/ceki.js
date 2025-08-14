const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const cekiService = require("../services/cekiService");
const authMiddleware = require("../middlewares/auth");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
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
      cb(new Error('Type de fichier non autorisé. Seuls JPG, PNG et WEBP sont acceptés.'), false);
    }
  }
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
      photoName: photoStatus.photoName
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du statut de la photo:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la vérification du statut de la photo"
    });
  }
});

/**
 * POST /api/ceki/upload-photo
 * Upload et traitement d'une photo de profil
 */
router.post("/upload-photo", authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Aucun fichier fourni"
      });
    }

    const userName = req.session.user.userName;
    
    // Vérifier si l'utilisateur a déjà une photo et la supprimer
    const currentPhotoStatus = await cekiService.checkUserPhoto(userName);
    if (currentPhotoStatus.hasPhoto && currentPhotoStatus.photoName) {
      await cekiService.deletePhotoFile(currentPhotoStatus.photoName);
    }

    // Générer un nom de fichier unique
    const fileExtension = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const fileName = cekiService.generateRandomFileName(fileExtension);
    const filePath = path.join(__dirname, "../data/profile-photos", fileName);

    // Traitement et compression de l'image avec Sharp
    await sharp(req.file.buffer)
      .resize(PHOTO_SIZE, PHOTO_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: PHOTO_QUALITY })
      .toFile(filePath);

    // Mettre à jour la base de données
    const updateSuccess = await cekiService.updateUserPhoto(userName, fileName);
    
    if (!updateSuccess) {
      // Si la mise à jour de la BDD échoue, supprimer le fichier
      await cekiService.deletePhotoFile(fileName);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la mise à jour de la base de données"
      });
    }

    res.json({
      success: true,
      message: "Photo uploadée avec succès",
      photoName: fileName
    });

  } catch (error) {
    console.error("Erreur lors de l'upload de la photo:", error);
    
    // Gestion des erreurs spécifiques de multer
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: "Le fichier est trop volumineux (maximum 10MB)"
      });
    }
    
    if (error.message.includes('Type de fichier non autorisé')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: "Erreur lors de l'upload de la photo"
    });
  }
});

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
        error: "Aucune photo à supprimer"
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
        error: "Erreur lors de la suppression de la photo"
      });
    }

    res.json({
      success: true,
      message: "Photo supprimée avec succès"
    });

  } catch (error) {
    console.error("Erreur lors de la suppression de la photo:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression de la photo"
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
      promos: promosStats
    });

  } catch (error) {
    console.error("Erreur lors de la récupération des stats promos:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des statistiques des promos"
    });
  }
});

/**
 * GET /api/ceki/game/round
 * Génère un nouveau round de jeu
 */
router.get("/game/round", authMiddleware, async (req, res) => {
  try {
    const userName = req.session.user.userName;
    
    // Vérifier que l'utilisateur a une photo pour pouvoir jouer
    const userPhotoStatus = await cekiService.checkUserPhoto(userName);
    if (!userPhotoStatus.hasPhoto) {
      return res.status(403).json({
        success: false,
        error: "Vous devez avoir une photo de profil pour jouer"
      });
    }

    // Récupérer les groupes sélectionnés depuis les paramètres de requête
    const selectedGroups = req.query.groups ? req.query.groups.split(',') : [];

    // Générer un nouveau round avec les groupes sélectionnés
    const gameRound = await cekiService.generateGameRound(selectedGroups);
    
    if (!gameRound) {
      return res.status(503).json({
        success: false,
        error: "Impossible de générer un round de jeu. Pas assez d'utilisateurs avec des photos dans les promos sélectionnées."
      });
    }

    res.json({
      success: true,
      roundId: gameRound.roundId,
      photoUrl: `/api/ceki/photo/${gameRound.photoName}`,
      choices: gameRound.choices
    });

  } catch (error) {
    console.error("Erreur lors de la génération du round:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la génération du round de jeu"
    });
  }
});

/**
 * POST /api/ceki/game/answer
 * Vérifie la réponse d'un utilisateur
 */
router.post("/game/answer", authMiddleware, async (req, res) => {
  try {
    const { roundId, choiceId } = req.body;

    if (!roundId || !choiceId) {
      return res.status(400).json({
        success: false,
        error: "roundId et choiceId sont requis"
      });
    }

    // Vérifier la réponse
    const result = cekiService.verifyAnswer(roundId, parseInt(choiceId));
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Round non trouvé ou expiré"
      });
    }

    res.json({
      success: true,
      correct: result.correct,
      correctAnswer: result.correctAnswer
    });

  } catch (error) {
    console.error("Erreur lors de la vérification de la réponse:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la vérification de la réponse"
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
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: "Nom de fichier invalide"
      });
    }

    const filePath = path.join(__dirname, "../data/profile-photos", fileName);
    
    // Vérifier que le fichier existe
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: "Photo non trouvée"
      });
    }

    // Définir le type de contenu approprié
    const ext = path.extname(fileName).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.webp') contentType = 'image/webp';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1 heure
    
    // Envoyer le fichier
    res.sendFile(filePath);

  } catch (error) {
    console.error("Erreur lors de la récupération de la photo:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la photo"
    });
  }
});

module.exports = router;
