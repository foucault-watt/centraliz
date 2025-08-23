const supabase = require("../utils/supabaseClient");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const axios = require('axios');
const FormData = require('form-data');

/**
 * Vérifie si un utilisateur a une photo de profil
 * @param {string} username - Nom d'utilisateur
 * @returns {Promise<{hasPhoto: boolean, photoName: string|null}>}
 */
async function checkUserPhoto(username) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("hasPhoto, photoName")
      .eq("username", username)
      .single();

    if (error) {
      console.error("Erreur lors de la vérification de la photo:", error);
      return { hasPhoto: false, photoName: null };
    }

    return {
      hasPhoto: data.hasPhoto || false,
      photoName: data.photoName || null,
    };
  } catch (error) {
    console.error("Erreur lors de la vérification de la photo:", error);
    return { hasPhoto: false, photoName: null };
  }
}

/**
 * Met à jour les informations de photo d'un utilisateur
 * @param {string} username - Nom d'utilisateur
 * @param {string} photoName - Nom du fichier photo
 * @returns {Promise<boolean>}
 */
async function updateUserPhoto(username, photoName) {
  try {
    const { error } = await supabase
      .from("users")
      .update({
        hasPhoto: true,
        photoName: photoName,
      })
      .eq("username", username);

    if (error) {
      console.error("Erreur lors de la mise à jour de la photo:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la photo:", error);
    return false;
  }
}

/**
 * Supprime les informations de photo d'un utilisateur (mais pas le fichier)
 * @param {string} username - Nom d'utilisateur
 * @returns {Promise<boolean>}
 */
async function removeUserPhoto(username) {
  try {
    const { error } = await supabase
      .from("users")
      .update({
        hasPhoto: false,
        photoName: null,
      })
      .eq("username", username);

    if (error) {
      console.error("Erreur lors de la suppression de la photo:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erreur lors de la suppression de la photo:", error);
    return false;
  }
}

/**
 * Génère un nom de fichier aléatoire unique
 * @param {string} originalExtension - Extension du fichier original
 * @returns {string}
 */
function generateRandomFileName(originalExtension) {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString("hex");
  return `${timestamp}_${randomBytes}.${originalExtension}`;
}

/**
 * Supprime un fichier photo du système de fichiers
 * @param {string} photoName - Nom du fichier à supprimer
 * @returns {Promise<boolean>}
 */
async function deletePhotoFile(photoName) {
  try {
    const photoPath = path.join(__dirname, "../data/profile-photos", photoName);
    await fs.unlink(photoPath);
    return true;
  } catch (error) {
    console.error("Erreur lors de la suppression du fichier:", error);
    return false;
  }
}

/**
 * Vérifie si un visage est présent dans une image en utilisant l'API Sightengine.
 * @param {Buffer} imageBuffer - Le buffer de l'image à analyser.
 * @returns {Promise<boolean>} True si un visage est détecté, false sinon.
 */
async function verifyFaceInImage(imageBuffer) {
  const VISAGE_VERIFICATION = process.env.VISAGE_VERIFICATION === 'true';
  const API_USER = process.env.SIGHTENGINE_API_USER;
  const API_SECRET = process.env.SIGHTENGINE_API_SECRET;

  if (!VISAGE_VERIFICATION) {
    return true; // Si la vérification est désactivée, on considère que l'image est "safe"
  }

  if (!API_USER || !API_SECRET) {
    // En production, on pourrait vouloir logger cette erreur, mais pas la renvoyer au client
    return false; // Ne pas autoriser l'upload si les clés sont manquantes et la vérification activée
  }

  try {
    const data = new FormData();
    data.append('media', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    data.append('models', 'faces');
    data.append('api_user', API_USER);
    data.append('api_secret', API_SECRET);

    const response = await axios({
      method: 'post',
      url: 'https://api.sightengine.com/1.0/check.json',
      data: data,
      headers: data.getHeaders(),
      timeout: 10000 // Timeout de 10 secondes
    });

    // Vérifier si le statut est succès et s'il y a EXACTEMENT UN visage détecté
    if (response.data.status === 'success' && response.data.faces && response.data.faces.length === 1) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    // En production, on pourrait vouloir logger cette erreur
    return false;
  }
}


// Stockage temporaire des rounds de jeu (pour les parties en cours)
const activeRounds = new Map();
// Stockage temporaire des sessions de jeu compétitif
const activeCompetitiveGameSessions = new Map();

// Nettoyer les rounds expirés (plus de 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [roundId, roundData] of activeRounds.entries()) {
    if (now - roundData.timestamp > 5 * 60 * 1000) {
      // 5 minutes
      activeRounds.delete(roundId);
    }
  }
  // Nettoyer les sessions de jeu compétitif expirées (plus de 30 minutes, ou après la fin du jeu)
  for (const [gameId, sessionData] of activeCompetitiveGameSessions.entries()) {
    if (now - sessionData.timestamp > 30 * 60 * 1000) {
      // 30 minutes
      activeCompetitiveGameSessions.delete(gameId);
    }
  }
}, 60000); // Nettoyer chaque minute

/**
 * Récupère tous les utilisateurs ayant une photo
 * @returns {Promise<Array>}
 */
async function getUsersWithPhotos() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("username, display_name, photoName")
      .eq("hasPhoto", true)
      .not("photoName", "is", null);

    if (error) {
      console.error(
        "Erreur lors de la récupération des utilisateurs avec photos:",
        error
      );
      return [];
    }

    return data || [];
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des utilisateurs avec photos:",
      error
    );
    return [];
  }
}

/**
 * Récupère tous les utilisateurs pour les choix de réponse
 * @returns {Promise<Array>}
 */
async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("username, display_name")
      .not("display_name", "is", null);

    if (error) {
      console.error("Erreur lors de la récupération des utilisateurs:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    return [];
  }
}

/**
 * Récupère les statistiques des promos (nombre de personnes avec photos par promo)
 * @returns {Promise<Array>}
 */
async function getPromosStats() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("group")
      .eq("hasPhoto", true)
      .not("photoName", "is", null)
      .not("group", "is", null);

    if (error) {
      console.error("Erreur lors de la récupération des stats promos:", error);
      return [];
    }

    // Compter le nombre de personnes par promo
    const promosCount = {};
    data.forEach((user) => {
      const group = user.group;
      if (group) {
        promosCount[group] = (promosCount[group] || 0) + 1;
      }
    });

    // Convertir en tableau d'objets
    const promosStats = Object.entries(promosCount).map(([group, count]) => ({
      group: group,
      count: count,
    }));

    // Trier par nom de promo
    promosStats.sort((a, b) => a.group.localeCompare(b.group));

    return promosStats;
  } catch (error) {
    console.error("Erreur lors de la récupération des stats promos:", error);
    return [];
  }
}

/**
 * Récupère les utilisateurs avec photos filtrés par promos
 * @param {Array} selectedGroups - Tableau des groupes sélectionnés
 * @returns {Promise<Array>}
 */
async function getUsersWithPhotosByGroups(selectedGroups = []) {
  try {
    let query = supabase
      .from("users")
      .select("username, display_name, photoName, group")
      .eq("hasPhoto", true)
      .not("photoName", "is", null);

    // Si des groupes sont spécifiés, filtrer par ces groupes
    if (selectedGroups.length > 0) {
      query = query.in("group", selectedGroups);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Erreur lors de la récupération des utilisateurs avec photos par groupes:",
        error
      );
      return [];
    }

    return data || [];
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des utilisateurs avec photos par groupes:",
      error
    );
    return [];
  }
}

/**
 * Mélange un tableau de manière aléatoire
 * @param {Array} array
 * @returns {Array}
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Crée et initialise une session de jeu compétitif.
 * @param {string} userId - L'ID de l'utilisateur.
 * @param {Array<string>} selectedGroups - Les groupes de promotions sélectionnés pour cette partie.
 * @returns {string} Le gameId de la session créée.
 */
function createCompetitiveGameSession(userId, selectedGroups) {
  const gameId = crypto.randomBytes(16).toString("hex");
  activeCompetitiveGameSessions.set(gameId, {
    userId: userId,
    selectedGroups: selectedGroups,
    currentRound: 0,
    totalScore: 0,
    timestamp: Date.now(),
    roundDataMap: new Map(), // Pour stocker les roundData pour chaque tour
    timerStartTime: null, // Timestamp de début du chrono pour le round actuel
  });
  return gameId;
}

/**
 * Récupère une session de jeu compétitif.
 * @param {string} gameId - L'ID de la session de jeu.
 * @returns {Object|undefined} La session de jeu ou undefined si non trouvée/expirée.
 */
function getCompetitiveGameSession(gameId) {
  return activeCompetitiveGameSessions.get(gameId);
}

/**
 * Démarre le chrono côté serveur pour un round de jeu compétitif.
 * @param {string} gameId - L'ID de la session de jeu.
 * @param {string} roundId - L'ID du round.
 * @returns {boolean} True si le chrono a été démarré avec succès.
 */
function startRoundTimer(gameId, roundId) {
  const session = activeCompetitiveGameSessions.get(gameId);
  if (!session) {
    console.error("Session de jeu compétitif non trouvée:", gameId);
    return false;
  }

  const roundData = session.roundDataMap.get(roundId);
  if (!roundData) {
    console.error("Round non trouvé dans la session:", roundId, gameId);
    return false;
  }

  // Démarrer le chrono côté serveur
  session.timerStartTime = Date.now();
  session.timestamp = Date.now(); // Mettre à jour le timestamp de la session
  activeCompetitiveGameSessions.set(gameId, session);

  return true;
}

/**
 * Génère un round de jeu aléatoire.
 * @param {Object} options - Options pour la génération du round.
 * @param {string} [options.gameId] - L'ID de la session de jeu (pour le mode compétitif).
 * @param {Array<string>} [options.selectedGroups] - Les groupes sélectionnés (pour le mode sans fin).
 * @returns {Promise<Object|null>}
 */
async function generateGameRound({ gameId, selectedGroups }) {
  let usersToPickFrom;
  let currentRound = 0;
  let totalScore = 0;
  let session = null;

  if (gameId) {
    // Mode compétitif
    session = activeCompetitiveGameSessions.get(gameId);
    if (!session) {
      console.error("Session de jeu compétitif non trouvée ou expirée:", gameId);
      return null;
    }
    usersToPickFrom = await getUsersWithPhotosByGroups(session.selectedGroups);
    currentRound = session.currentRound + 1;
    totalScore = session.totalScore;
  } else if (selectedGroups) {
    // Mode sans fin
    usersToPickFrom = await getUsersWithPhotosByGroups(selectedGroups);
    // Pour le mode sans fin, currentRound et totalScore ne sont pas gérés par le backend de la même manière
    // Ils sont gérés côté frontend ou ne sont pas pertinents pour la session backend.
  } else {
    console.error("Paramètres invalides pour generateGameRound. gameId ou selectedGroups sont requis.");
    return null;
  }

  if (usersToPickFrom.length < 4) {
    console.error(
      "Pas assez d'utilisateurs avec photos dans les promos sélectionnées."
    );
    return null;
  }

  try {
    const randomIndex = Math.floor(Math.random() * usersToPickFrom.length);
    const selectedUser = usersToPickFrom[randomIndex];

    const correctChoice = {
      id: 1,
      displayName: selectedUser.display_name,
    };

    const otherUsersWithPhotos = usersToPickFrom.filter(
      (user) =>
        user.username !== selectedUser.username &&
        user.display_name !== selectedUser.display_name
    );

    const shuffledOthers = shuffleArray(otherUsersWithPhotos);
    const wrongChoices = shuffledOthers.slice(0, 3).map((user, index) => ({
      id: index + 2,
      displayName: user.display_name,
    }));

    const allChoices = shuffleArray([correctChoice, ...wrongChoices]);

    const choices = allChoices.map((choice, index) => ({
      id: index + 1,
      displayName: choice.displayName,
    }));

    const correctChoiceId = choices.find(
      (choice) => choice.displayName === selectedUser.display_name
    ).id;

    const roundId = crypto.randomBytes(16).toString("hex");

    // Stocker les informations du round
    const roundData = {
      correctChoiceId: correctChoiceId,
      correctDisplayName: selectedUser.display_name,
      correctGroup: selectedUser.group,
      photoName: selectedUser.photoName,
      timestamp: Date.now(),
    };

    if (session) {
      // Mode compétitif: stocker dans la session
      session.roundDataMap.set(roundId, roundData);
      session.timestamp = Date.now(); // Mettre à jour le timestamp de la session
      activeCompetitiveGameSessions.set(gameId, session);
    } else {
      // Mode sans fin: stocker globalement (comme avant l'introduction du mode compétitif)
      activeRounds.set(roundId, roundData);
    }

    return {
      roundId: roundId,
      photoUrl: `/api/ceki/photo/${selectedUser.photoName}`,
      choices: choices,
      currentRound: currentRound, // Sera 0 pour le mode sans fin, ou le numéro de round pour compétitif
      totalScore: totalScore, // Sera 0 pour le mode sans fin, ou le score cumulé pour compétitif
    };
  } catch (error) {
    console.error(
      "Erreur lors de la génération du round:",
      error
    );
    return null;
  }
}

const MAX_ROUNDS_COMPETITIVE = 10;

/**
 * Vérifie la réponse d'un utilisateur et met à jour l'état du jeu.
 * @param {Object} options - Options pour la vérification de la réponse.
 * @param {string} options.roundId - ID du round.
 * @param {number} options.choiceId - ID du choix sélectionné.
 * @param {string} [options.gameId] - L'ID de la session de jeu (pour le mode compétitif).
 * @param {number} [options.timeElapsed] - Temps écoulé pour la réponse en ms (pour le mode sans fin).
 * @returns {Object|null}
 */
async function verifyAnswer({ roundId, choiceId, gameId, timeElapsed = null }) {
  let roundData;
  let session = null;
  let isCompetitiveMode = false;

  if (gameId) {
    // Mode compétitif
    isCompetitiveMode = true;
    session = activeCompetitiveGameSessions.get(gameId);
    if (!session) {
      console.error("Session de jeu compétitif non trouvée ou expirée:", gameId);
      return null;
    }
    roundData = session.roundDataMap.get(roundId);
  } else {
    // Mode sans fin
    roundData = activeRounds.get(roundId);
  }

  if (!roundData) {
    console.error(
      "Round non trouvé ou expiré:",
      roundId,
      gameId ? `(gameId: ${gameId})` : "(mode sans fin)"
    );
    return null;
  }

  const isCorrect = roundData.correctChoiceId === choiceId;
  let scoreGainedThisRound = 0;
  let currentRound = 0;
  let totalScore = 0;
  let isGameOver = false;
  let actualTimeElapsed = timeElapsed; // Par défaut, utiliser le temps du frontend pour le mode sans fin

  if (isCompetitiveMode) {
    // Calcul du temps écoulé côté serveur (plus fiable que le frontend)
    if (session.timerStartTime) {
      actualTimeElapsed = Date.now() - session.timerStartTime;
    } else {
      console.warn(
        "Chrono serveur non démarré, utilisation du temps frontend pour gameId:",
        gameId
      );
    }

    // Calcul du score basé sur le temps serveur (max 5 secondes)
    const MAX_TIME = 5000; // 5 secondes
    if (isCorrect) {
      scoreGainedThisRound = Math.round(
        Math.max(0, 100 * (1 - actualTimeElapsed / MAX_TIME))
      );
    }

    // Mettre à jour la session
    session.totalScore += scoreGainedThisRound;
    session.currentRound++;
    session.timestamp = Date.now(); // Mettre à jour le timestamp pour éviter l'expiration
    session.timerStartTime = null; // Réinitialiser le chrono pour le prochain round
    session.roundDataMap.delete(roundId); // Nettoyer le round une fois traité

    isGameOver = session.currentRound >= MAX_ROUNDS_COMPETITIVE;

    if (isGameOver) {
      // Sauvegarder le score final
      const mode = session.selectedGroups.length === 1 ? "single_promo" : "all";
      const promo =
        session.selectedGroups.length === 1 ? session.selectedGroups[0] : null;
      const saveSuccess = await saveGameScore(
        session.userId,
        session.totalScore,
        mode,
        promo
      );
      if (!saveSuccess) {
        console.error(
          "Erreur lors de la sauvegarde du score final pour gameId:",
          gameId
        );
      }
      activeCompetitiveGameSessions.delete(gameId); // Nettoyer la session après la fin du jeu
    }
    currentRound = session.currentRound;
    totalScore = session.totalScore;
  } else {
    // Mode sans fin: pas de score cumulé ni de fin de jeu gérés par le backend
    // Le score pour ce round peut être calculé si nécessaire, mais n'affecte pas une session globale
    if (isCorrect) {
      scoreGainedThisRound = 1; // Ou une autre logique de score simple pour le mode sans fin
    }
    activeRounds.delete(roundId); // Nettoyer le round une fois traité
  }

  return {
    correct: isCorrect,
    scoreGainedThisRound: scoreGainedThisRound,
    totalScore: totalScore, // Sera 0 pour le mode sans fin, ou le score cumulé pour compétitif
    currentRound: currentRound, // Sera 0 pour le mode sans fin, ou le numéro de round pour compétitif
    isGameOver: isGameOver, // Indique si la partie est terminée (compétitif)
    actualTimeElapsed: actualTimeElapsed,
    correctAnswer: {
      id: roundData.correctChoiceId,
      displayName: roundData.correctDisplayName,
      group: roundData.correctGroup,
    },
  };
}

/**
 * Enregistre le score d'une partie
 * @param {string} username - Nom d'utilisateur
 * @param {number} score - Score final
 * @param {string} mode - Mode de jeu ('all', 'single_promo', 'endless')
 * @param {string|null} promo - Nom de la promo si mode 'single_promo'
 * @returns {Promise<boolean>}
 */
async function saveGameScore(username, score, mode, promo = null) {
  try {
    const { error } = await supabase.from("ceki_scores").insert([
      {
        username: username,
        score: score,
        mode: mode,
        promo: promo,
      },
    ]);

    if (error) {
      console.error("Erreur lors de la sauvegarde du score:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du score:", error);
    return false;
  }
}

module.exports = {
  checkUserPhoto,
  updateUserPhoto,
  removeUserPhoto,
  generateRandomFileName,
  deletePhotoFile,
  getUsersWithPhotos,
  getAllUsers,
  getPromosStats,
  getUsersWithPhotosByGroups,
  createCompetitiveGameSession,
  generateGameRound,
  verifyAnswer,
  saveGameScore,
  getCompetitiveGameSession, // Exporter pour les tests ou si nécessaire
  startRoundTimer, // Nouvelle fonction pour démarrer le chrono côté serveur
  verifyFaceInImage,
};
