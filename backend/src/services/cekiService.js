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
      photoName: data.photoName || null
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
        photoName: photoName
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
        photoName: null
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
  const randomBytes = crypto.randomBytes(16).toString('hex');
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

// Stockage temporaire des rounds de jeu (en production, utiliser Redis)
const activeRounds = new Map();

// Nettoyer les rounds expirés (plus de 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [roundId, roundData] of activeRounds.entries()) {
    if (now - roundData.timestamp > 5 * 60 * 1000) { // 5 minutes
      activeRounds.delete(roundId);
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
      console.error("Erreur lors de la récupération des utilisateurs avec photos:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs avec photos:", error);
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
    data.forEach(user => {
      const group = user.group;
      if (group) {
        promosCount[group] = (promosCount[group] || 0) + 1;
      }
    });

    // Convertir en tableau d'objets
    const promosStats = Object.entries(promosCount).map(([group, count]) => ({
      group: group,
      count: count
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
      console.error("Erreur lors de la récupération des utilisateurs avec photos par groupes:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs avec photos par groupes:", error);
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
 * Génère un round de jeu aléatoire
 * @param {Array} selectedGroups - Tableau des groupes sélectionnés (optionnel)
 * @returns {Promise<Object|null>}
 */
async function generateGameRound(selectedGroups = []) {
  try {
    // Récupérer les utilisateurs avec photos (filtrés par groupes si spécifiés)
    const usersWithPhotos = await getUsersWithPhotosByGroups(selectedGroups);
    if (usersWithPhotos.length < 4) {
      return null; // Pas assez d'utilisateurs avec photos pour faire un jeu
    }

    // Sélectionner un utilisateur aléatoire avec photo
    const randomIndex = Math.floor(Math.random() * usersWithPhotos.length);
    const selectedUser = usersWithPhotos[randomIndex];

    // Créer la bonne réponse
    const correctChoice = {
      id: 1,
      displayName: selectedUser.display_name
    };

    // Sélectionner 3 autres utilisateurs aléatoires avec photos (différents du bon)
    const otherUsersWithPhotos = usersWithPhotos.filter(user =>
      user.username !== selectedUser.username &&
      user.display_name !== selectedUser.display_name
    );
    
    const shuffledOthers = shuffleArray(otherUsersWithPhotos);
    const wrongChoices = shuffledOthers.slice(0, 3).map((user, index) => ({
      id: index + 2,
      displayName: user.display_name
    }));

    // Mélanger tous les choix
    const allChoices = shuffleArray([correctChoice, ...wrongChoices]);
    
    // Réassigner les IDs après mélange
    const choices = allChoices.map((choice, index) => ({
      id: index + 1,
      displayName: choice.displayName
    }));

    // Trouver l'ID de la bonne réponse après mélange
    const correctChoiceId = choices.find(choice =>
      choice.displayName === selectedUser.display_name
    ).id;

    // Générer un ID unique pour ce round
    const roundId = crypto.randomBytes(16).toString('hex');

    // Stocker les informations du round
    activeRounds.set(roundId, {
      correctChoiceId: correctChoiceId,
      correctDisplayName: selectedUser.display_name,
      correctGroup: selectedUser.group,
      photoName: selectedUser.photoName,
      timestamp: Date.now()
    });

    return {
      roundId: roundId,
      photoName: selectedUser.photoName,
      choices: choices
    };

  } catch (error) {
    console.error("Erreur lors de la génération du round:", error);
    return null;
  }
}

/**
 * Vérifie la réponse d'un utilisateur
 * @param {string} roundId - ID du round
 * @param {number} choiceId - ID du choix sélectionné
 * @returns {Object|null}
 */
function verifyAnswer(roundId, choiceId) {
  const roundData = activeRounds.get(roundId);
  
  if (!roundData) {
    return null; // Round non trouvé ou expiré
  }

  const isCorrect = roundData.correctChoiceId === choiceId;
  
  // Nettoyer le round après vérification
  activeRounds.delete(roundId);

  return {
    correct: isCorrect,
    correctAnswer: {
      id: roundData.correctChoiceId,
      displayName: roundData.correctDisplayName,
      group: roundData.correctGroup
    }
  };
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
  generateGameRound,
  verifyAnswer
};
