const supabase = require("../utils/supabaseClient");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const axios = require("axios");
const FormData = require("form-data");

/**
 * Vérifie si un utilisateur a une photo de profil
 * @param {string} username - Nom d'utilisateur
 * @returns {Promise<{hasPhoto: boolean, photoName: string|null, isBanned: boolean, isAdmin: boolean}>}
 */
async function checkUserPhoto(username) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("hasPhoto, photoName, photo_banned_until, is_admin")
      .eq("username", username)
      .single();

    if (error) {
      console.error("Erreur lors de la vérification de la photo:", error);
      return {
        hasPhoto: false,
        photoName: null,
        isBanned: false,
        isAdmin: false,
      };
    }

    const isBanned = data.photo_banned_until
      ? new Date(data.photo_banned_until) > new Date()
      : false;

    return {
      hasPhoto: data.hasPhoto || false,
      photoName: data.photoName || null,
      isBanned: isBanned,
      isAdmin: data.is_admin || false,
    };
  } catch (error) {
    console.error("Erreur lors de la vérification de la photo:", error);
    return {
      hasPhoto: false,
      photoName: null,
      isBanned: false,
      isAdmin: false,
    };
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
  const VISAGE_VERIFICATION = process.env.VISAGE_VERIFICATION === "true";
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
    data.append("media", imageBuffer, {
      filename: "image.jpg",
      contentType: "image/jpeg",
    });
    data.append("models", "faces");
    data.append("api_user", API_USER);
    data.append("api_secret", API_SECRET);

    const response = await axios({
      method: "post",
      url: "https://api.sightengine.com/1.0/check.json",
      data: data,
      headers: data.getHeaders(),
      timeout: 10000, // Timeout de 10 secondes
    });

    // Vérifier si le statut est succès et s'il y a EXACTEMENT UN visage détecté
    if (
      response.data.status === "success" &&
      response.data.faces &&
      response.data.faces.length === 1
    ) {
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
      .select("username, display_name, photoName, group, support_bds")
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
    usedUsernames: new Set(), // Pour garantir l'unicité des questions
  });
  return gameId;
}

/**
 * Crée et initialise une session de jeu en mode sans fin.
 * @param {string} userId - L'ID de l'utilisateur.
 * @param {Array<string>} selectedGroups - Les groupes de promotions sélectionnés.
 * @returns {string} Le gameId de la session créée.
 */
function createEndlessGameSession(userId, selectedGroups) {
  const gameId = crypto.randomBytes(16).toString("hex");
  activeCompetitiveGameSessions.set(gameId, {
    userId: userId,
    selectedGroups: selectedGroups,
    currentRound: 0,
    totalScore: 0, // Non utilisé en mode sans fin, mais gardé pour la cohérence
    timestamp: Date.now(),
    roundDataMap: new Map(),
    timerStartTime: null,
    usedUsernames: new Set(),
    isEndless: true, // Marqueur pour le mode sans fin
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
    // Mode compétitif ou sans fin avec session
    session = activeCompetitiveGameSessions.get(gameId);
    if (!session) {
      console.error("Session de jeu non trouvée ou expirée:", gameId);
      return {
        error: "La session de jeu a expiré, veuillez relancer une partie.",
      };
    }
    const allUsersInSelectedGroups = await getUsersWithPhotosByGroups(
      session.selectedGroups
    );

    // Filtrer les utilisateurs déjà utilisés dans cette session
    usersToPickFrom = allUsersInSelectedGroups.filter(
      (user) => !session.usedUsernames.has(user.username)
    );

    // Si tous les joueurs ont été vus en mode sans fin, c'est la fin.
    if (session.isEndless && usersToPickFrom.length === 0) {
      return { error: "Félicitations, vous avez vu tout le monde !" };
    }

    currentRound = session.currentRound + 1;
    totalScore = session.totalScore;
  } else if (selectedGroups) {
    // Ancien mode sans fin (sans session), déprécié mais gardé pour compatibilité
    usersToPickFrom = await getUsersWithPhotosByGroups(selectedGroups);
  } else {
    console.error(
      "Paramètres invalides pour generateGameRound. gameId ou selectedGroups sont requis."
    );
    return null;
  }

  // Pour le premier round d'un mode compétitif, on vérifie qu'il y a assez de joueurs pour toute la partie
  if (
    session &&
    !session.isEndless &&
    currentRound === 1 &&
    usersToPickFrom.length < MAX_ROUNDS_COMPETITIVE
  ) {
    console.error(
      `Pas assez d'utilisateurs uniques pour une partie compétitive. Requis: ${MAX_ROUNDS_COMPETITIVE}, Disponible: ${usersToPickFrom.length}`
    );
    return {
      error: `Il faut au moins ${MAX_ROUNDS_COMPETITIVE} personnes différentes dans les promos sélectionnées pour lancer une partie.`,
    };
  }

  // Pour chaque round, on vérifie qu'il y a au moins 4 choix possibles (ou moins si c'est la fin)
  if (usersToPickFrom.length < 4 && usersToPickFrom.length > 0) {
    // S'il reste moins de 4 joueurs, on complète avec des joueurs déjà vus pour avoir 4 choix
    const allUsersInSelectedGroups = await getUsersWithPhotosByGroups(
      session.selectedGroups
    );
    const additionalChoices = allUsersInSelectedGroups.filter(
      (user) => !usersToPickFrom.some((u) => u.username === user.username)
    );
    usersToPickFrom = [
      ...usersToPickFrom,
      ...shuffleArray(additionalChoices),
    ].slice(0, 4);
  }

  if (usersToPickFrom.length < 1) {
    return { error: "Plus aucun joueur à afficher." };
  }

  try {
    // Le joueur à deviner est toujours pris parmi ceux pas encore vus
    const notSeenUsers = session
      ? (await getUsersWithPhotosByGroups(session.selectedGroups)).filter(
          (user) => !session.usedUsernames.has(user.username)
        )
      : usersToPickFrom;
    const randomIndex = Math.floor(Math.random() * notSeenUsers.length);
    const selectedUser = notSeenUsers[randomIndex];

    const correctChoice = {
      id: 1,
      displayName: selectedUser.display_name,
    };

    // Les mauvais choix sont pris parmi tous les autres joueurs possibles pour garantir 4 choix
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

    // S'il n'y a pas assez de mauvais choix, on remplit avec la bonne réponse pour éviter un crash
    while (wrongChoices.length < 3) {
      wrongChoices.push({
        id: wrongChoices.length + 2,
        displayName: correctChoice.displayName,
      });
    }

    const allChoices = shuffleArray([correctChoice, ...wrongChoices]);

    const choices = allChoices.map((choice, index) => ({
      id: index + 1,
      displayName: choice.displayName,
    }));

    const correctChoiceId = choices.find(
      (choice) => choice.displayName === selectedUser.display_name
    ).id;

    const roundId = crypto.randomBytes(16).toString("hex");

    const roundData = {
      correctChoiceId: correctChoiceId,
      correctDisplayName: selectedUser.display_name,
      correctGroup: selectedUser.group,
      photoName: selectedUser.photoName,
      supportBds: selectedUser.support_bds || null,
      timestamp: Date.now(),
    };

    if (session) {
      session.roundDataMap.set(roundId, roundData);
      session.usedUsernames.add(selectedUser.username);
      session.timestamp = Date.now();
      activeCompetitiveGameSessions.set(gameId, session);
    } else {
      activeRounds.set(roundId, roundData);
    }

    return {
      roundId: roundId,
      photoUrl: `/api/ceki/photo/${selectedUser.photoName}`,
      choices: choices,
      currentRound: currentRound,
      totalScore: totalScore,
      supportBds: selectedUser.support_bds || null,
    };
  } catch (error) {
    console.error("Erreur lors de la génération du round:", error);
    return null;
  }
}

const MAX_ROUNDS_COMPETITIVE = 10; // Le nombre de rounds dans une partie

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
    session = activeCompetitiveGameSessions.get(gameId);
    if (!session) {
      console.error(
        "Session de jeu non trouvée ou expirée pour gameId:",
        gameId
      );
      return null;
    }

    // On détermine le mode en fonction de la session et non plus de la simple présence du gameId
    isCompetitiveMode = !session.isEndless;

    roundData = session.roundDataMap.get(roundId);
  } else {
    // Mode sans fin (ancien)
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

    if (isGameOver && !session.isEndless) {
      const gameType =
        session.selectedGroups.length > 1 || session.selectedGroups.length === 0
          ? "all_promos"
          : session.selectedGroups[0];
      await submitScore(session.userId, session.totalScore, gameType);
      activeCompetitiveGameSessions.delete(gameId);
    }

    // Pour le mode sans fin, on vérifie si tous les joueurs ont été vus
    if (session.isEndless) {
      const allUsersInSelectedGroups = await getUsersWithPhotosByGroups(
        session.selectedGroups
      );
      if (session.usedUsernames.size >= allUsersInSelectedGroups.length) {
        isGameOver = true;
        activeCompetitiveGameSessions.delete(gameId); // Nettoyer la session
      }
    }

    currentRound = session.currentRound;
    totalScore = session.totalScore;
  } else {
    // Mode sans fin (ancien)
    if (isCorrect) {
      scoreGainedThisRound = 1;
    }
    activeRounds.delete(roundId);
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
 * Soumet un score au classement.
 * Utilise la fonction RPC `upsert_best_score` pour insérer ou mettre à jour le score
 * uniquement s'il est meilleur que le précédent.
 * @param {string} username - Nom d'utilisateur.
 * @param {number} score - Score final.
 * @param {string} gameType - Type de jeu ('all_promos' ou nom de la promo).
 * @returns {Promise<void>}
 */
async function submitScore(username, score, gameType) {
  try {
    const { error } = await supabase.rpc("upsert_best_score", {
      username_in: username,
      score_in: score,
      game_type_in: gameType,
    });

    if (error) {
      console.error("Erreur lors de la soumission du score via RPC:", error);
    }
  } catch (error) {
    console.error("Erreur inattendue lors de la soumission du score:", error);
  }
}

/**
 * Récupère le classement pour un type de jeu donné.
 * @param {string} gameType - Le type de jeu ('all_promos' ou une promo spécifique).
 * @returns {Promise<Array|null>}
 */
async function getLeaderboard(gameType) {
  try {
    const { data, error } = await supabase
      .from("ceki_best_scores")
      .select(
        `
        score,
        users (
          display_name
        )
      `
      )
      .eq("game_type", gameType)
      .order("score", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Erreur lors de la récupération du classement:", error);
      return null;
    }

    // Transformer les données pour un format plus simple
    return data.map((entry) => ({
      displayName: entry.users.display_name,
      score: entry.score,
    }));
  } catch (error) {
    console.error(
      "Erreur inattendue lors de la récupération du classement:",
      error
    );
    return null;
  }
}

/**
 * Crée un signalement pour une photo.
 * @param {object} reportData - Données du signalement.
 * @param {string} reportData.photoName - Nom de la photo signalée.
 * @param {string} reportData.reportedByUsername - Auteur du signalement.
 * @param {string} reportData.reason - Raison du signalement.
 * @param {string} [reportData.details] - Détails supplémentaires.
 * @returns {Promise<boolean>}
 */
async function createPhotoReport({
  photoName,
  reportedByUsername,
  reason,
  details,
}) {
  try {
    const { error } = await supabase.from("ceki_photo_reports").insert([
      {
        photo_name: photoName,
        reported_by_username: reportedByUsername,
        reason: reason,
        details: details,
      },
    ]);

    if (error) {
      console.error("Erreur lors de la création du signalement:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "Erreur inattendue lors de la création du signalement:",
      error
    );
    return false;
  }
}

/**
 * Récupère toutes les photos signalées, groupées par nom de photo.
 * @returns {Promise<Array|null>}
 */
async function getReportedPhotos() {
  try {
    // Cette requête est complexe. On utilise rpc pour appeler une fonction SQL ou on le fait en plusieurs étapes.
    // Étape 1: Récupérer tous les signalements non résolus.
    const { data: reports, error: reportsError } = await supabase
      .from("ceki_photo_reports")
      .select(
        `
        photo_name,
        reason,
        details,
        created_at,
        reported_by_username,
        users (
          display_name
        )
      `
      )
      .eq("status", "pending");

    if (reportsError) {
      console.error(
        "Erreur lors de la récupération des signalements:",
        reportsError
      );
      return null;
    }

    // Étape 2: Grouper les signalements par photo
    const groupedReports = reports.reduce((acc, report) => {
      const { photo_name } = report;
      if (!acc[photo_name]) {
        acc[photo_name] = {
          photoName: photo_name,
          reports: [],
          reportCount: 0,
          reporters: new Set(),
        };
      }
      acc[photo_name].reports.push({
        reason: report.reason,
        details: report.details,
        createdAt: report.created_at,
        reportedBy: report.users.display_name || report.reported_by_username,
      });
      acc[photo_name].reporters.add(report.reported_by_username);
      acc[photo_name].reportCount = acc[photo_name].reporters.size;
      return acc;
    }, {});

    // Convertir l'objet en tableau et trier par nombre de signalements
    const sortedReports = Object.values(groupedReports).sort(
      (a, b) => b.reportCount - a.reportCount
    );

    return sortedReports;
  } catch (error) {
    console.error("Erreur lors du groupement des photos signalées:", error);
    return null;
  }
}

/**
 * Bannit un utilisateur de l'upload de photos pour une durée déterminée.
 * @param {string} username - Nom d'utilisateur à bannir.
 * @param {number} days - Durée du bannissement en jours.
 * @returns {Promise<boolean>}
 */
async function banUserPhotoUpload(username, days) {
  try {
    const banUntil = new Date();
    banUntil.setDate(banUntil.getDate() + days);

    const { error } = await supabase
      .from("users")
      .update({ photo_banned_until: banUntil.toISOString() })
      .eq("username", username);

    if (error) {
      console.error("Erreur lors du bannissement de l'utilisateur:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Erreur inattendue lors du bannissement:", error);
    return false;
  }
}

/**
 * Met à jour le statut de tous les signalements pour une photo donnée.
 * @param {string} photoName - Nom de la photo.
 * @param {string} newStatus - Nouveau statut des signalements.
 * @returns {Promise<boolean>}
 */
async function resolveReportsForPhoto(photoName, newStatus) {
  try {
    const { error } = await supabase
      .from("ceki_photo_reports")
      .update({ status: newStatus })
      .eq("photo_name", photoName);

    if (error) {
      console.error("Erreur lors de la résolution des signalements:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "Erreur inattendue lors de la résolution des signalements:",
      error
    );
    return false;
  }
}

/**
 * Récupère un utilisateur par le nom de sa photo.
 * @param {string} photoName - Nom du fichier photo.
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
async function getUserByPhotoName(photoName) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("username")
      .eq("photoName", photoName)
      .single();

    if (error) {
      console.error(
        "Erreur lors de la récupération de l'utilisateur par nom de photo:",
        error
      );
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error(
      "Erreur inattendue lors de la récupération de l'utilisateur par nom de photo:",
      error
    );
    return { data: null, error };
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
  createEndlessGameSession, // Ajout de la nouvelle fonction
  generateGameRound,
  verifyAnswer,
  submitScore,
  getLeaderboard,
  getCompetitiveGameSession, // Exporter pour les tests ou si nécessaire
  startRoundTimer, // Nouvelle fonction pour démarrer le chrono côté serveur
  verifyFaceInImage,
  createPhotoReport,
  getReportedPhotos,
  banUserPhotoUpload,
  resolveReportsForPhoto,
  getUserByPhotoName,
};
