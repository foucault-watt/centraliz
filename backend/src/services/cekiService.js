const supabase = require("../utils/supabaseClient");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");

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
 * @param {string} gameId - L'ID de la session de jeu (obligatoire pour le mode compétitif).
 * @returns {Promise<Object|null>}
 */
async function generateGameRound(gameId) {
  const session = activeCompetitiveGameSessions.get(gameId);
  if (!session) {
    console.error("Session de jeu compétitif non trouvée ou expirée:", gameId);
    return null;
  }

  try {
    const usersWithPhotos = await getUsersWithPhotosByGroups(
      session.selectedGroups
    );
    if (usersWithPhotos.length < 4) {
      console.error(
        "Pas assez d'utilisateurs avec photos dans les promos sélectionnées pour le gameId:",
        gameId
      );
      return null;
    }

    const randomIndex = Math.floor(Math.random() * usersWithPhotos.length);
    const selectedUser = usersWithPhotos[randomIndex];

    const correctChoice = {
      id: 1,
      displayName: selectedUser.display_name,
    };

    const otherUsersWithPhotos = usersWithPhotos.filter(
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

    // Stocker les informations du round dans la session de jeu compétitif
    session.roundDataMap.set(roundId, {
      correctChoiceId: correctChoiceId,
      correctDisplayName: selectedUser.display_name,
      correctGroup: selectedUser.group,
      photoName: selectedUser.photoName,
      timestamp: Date.now(),
    });

    // Mettre à jour le timestamp de la session pour éviter l'expiration prématurée
    session.timestamp = Date.now();
    activeCompetitiveGameSessions.set(gameId, session);

    return {
      roundId: roundId,
      photoUrl: `/api/ceki/photo/${selectedUser.photoName}`,
      choices: choices,
      currentRound: session.currentRound + 1, // Le round suivant
      totalScore: session.totalScore,
    };
  } catch (error) {
    console.error(
      "Erreur lors de la génération du round pour gameId:",
      gameId,
      error
    );
    return null;
  }
}

const MAX_ROUNDS_COMPETITIVE = 10;

/**
 * Vérifie la réponse d'un utilisateur et met à jour l'état de la session de jeu compétitif.
 * @param {string} gameId - L'ID de la session de jeu compétitif.
 * @param {string} roundId - ID du round.
 * @param {number} choiceId - ID du choix sélectionné.
 * @param {number} timeElapsed - Temps écoulé pour la réponse en ms.
 * @returns {Object|null}
 */
async function verifyAnswer(gameId, roundId, choiceId, timeElapsed = null) {
  const session = activeCompetitiveGameSessions.get(gameId);
  if (!session) {
    console.error("Session de jeu compétitif non trouvée ou expirée:", gameId);
    return null;
  }

  const roundData = session.roundDataMap.get(roundId);
  if (!roundData) {
    console.error(
      "Round non trouvé ou expiré dans la session:",
      roundId,
      gameId
    );
    return null;
  }

  const isCorrect = roundData.correctChoiceId === choiceId;

  // Calcul du temps écoulé côté serveur (plus fiable que le frontend)
  let actualTimeElapsed = 0;
  if (session.timerStartTime) {
    actualTimeElapsed = Date.now() - session.timerStartTime;
  } else {
    // Fallback: utiliser le temps envoyé par le frontend si le chrono serveur n'a pas été démarré
    actualTimeElapsed = timeElapsed || 0;
    console.warn(
      "Chrono serveur non démarré, utilisation du temps frontend pour gameId:",
      gameId
    );
  }

  // Calcul du score basé sur le temps serveur (max 5 secondes)
  const MAX_TIME = 5000; // 5 secondes
  let scoreGainedThisRound = 0;
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

  const isGameOver = session.currentRound >= MAX_ROUNDS_COMPETITIVE;

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

  return {
    correct: isCorrect,
    scoreGainedThisRound: scoreGainedThisRound,
    totalScore: session.totalScore,
    currentRound: session.currentRound,
    isGameOver: isGameOver,
    actualTimeElapsed: actualTimeElapsed, // Retourner le temps réel calculé côté serveur
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
};
