const fs = require("fs").promises;
const path = require("path");

const dataPath = path.join(__dirname, "../data/aprem.json");

const loadData = async () => {
  try {
    const data = await fs.readFile(dataPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    // Si le fichier n'existe pas ou est corrompu, retourner une structure vide
    return { players: {}, trials: {} };
  }
};

const saveData = async (data) => {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
};

// Obtenir les données d'un joueur
const getPlayerData = async (userName) => {
  const data = await loadData();

  if (!data.players[userName]) {
    data.players[userName] = {
      stands: {
        taureau: false,
        bowling: false,
        alibi: false,
        pancake: false,
        atelier: false,
      },
      canards: 0,
      trialCount: 0, // Ajout du compteur de demandes de pêche
    };
    await saveData(data);
  }

  // Assurer la compatibilité avec les données existantes
  if (data.players[userName].trialCount === undefined) {
    data.players[userName].trialCount = 0;
    await saveData(data);
  }

  return data.players[userName];
};

// Valider un stand pour un joueur
const validateStand = async (userName, stand) => {
  const data = await loadData();

  if (!data.players[userName]) {
    data.players[userName] = {
      stands: {
        taureau: false,
        bowling: false,
        alibi: false,
        pancake: false,
        atelier: false,
      },
      canards: 0,
    };
  }

  if (Object.keys(data.players[userName].stands).includes(stand)) {
    data.players[userName].stands[stand] = true;
    await saveData(data);
    return true;
  }

  return false;
};

// Créer une demande d'essai
const createTrial = async (userName, timestamp) => {
  const data = await loadData();

  const trialId = Date.now().toString() + userName;

  data.trials[trialId] = {
    userName,
    timestamp,
    status: "pending",
    expiresAt: timestamp + 120000, // expiration après 2 minutes
  };

  await saveData(data);
  return trialId;
};

// Obtenir toutes les demandes d'essai
const getAllTrials = async () => {
  const data = await loadData();
  return data.trials;
};

// Obtenir les demandes d'essai pour un joueur spécifique
const getPlayerTrials = async (userName) => {
  const data = await loadData();
  const playerTrials = {};

  for (const [id, trial] of Object.entries(data.trials)) {
    if (trial.userName === userName) {
      playerTrials[id] = trial;
    }
  }

  return playerTrials;
};

// Supprimer les essais expirés
const cleanExpiredTrials = async () => {
  const data = await loadData();
  const currentTime = Date.now();
  let changed = false;

  for (const [id, trial] of Object.entries(data.trials)) {
    if (trial.status === "pending" && trial.expiresAt < currentTime) {
      delete data.trials[id];
      changed = true;
    }
  }

  if (changed) {
    await saveData(data);
  }

  return changed;
};

// Valider un essai
const validateTrial = async (trialId, canards) => {
  const data = await loadData();

  if (!data.trials[trialId]) {
    return false;
  }

  const userName = data.trials[trialId].userName;
  data.trials[trialId].status = "validated";

  if (!data.players[userName]) {
    data.players[userName] = {
      stands: {
        taureau: false,
        bowling: false,
        alibi: false,
        pancake: false,
        atelier: false,
      },
      canards: 0,
      trialCount: 0,
    };
  }

  // Assurer la compatibilité avec les données existantes
  if (data.players[userName].trialCount === undefined) {
    data.players[userName].trialCount = 0;
  }

  // Incrémenter le compteur de demandes validées
  data.players[userName].trialCount += 1;

  // Ajouter un seul canard à la fois
  data.players[userName].canards += 1;

  await saveData(data);
  return true;
};

// Rejeter un essai
const rejectTrial = async (trialId) => {
  const data = await loadData();

  if (!data.trials[trialId]) {
    return false;
  }

  data.trials[trialId].status = "rejected";
  await saveData(data);
  return true;
};

// Créer une demande de validation de stand
const createStandRequest = async (userName, stand, timestamp) => {
  const data = await loadData();

  const requestId = Date.now().toString() + userName + stand;

  if (!data.standRequests) {
    data.standRequests = {};
  }

  data.standRequests[requestId] = {
    userName,
    stand,
    timestamp,
    status: "pending",
    expiresAt: timestamp + 120000, // expiration après 2 minutes
  };

  await saveData(data);
  return requestId;
};

// Obtenir toutes les demandes de validation de stand
const getAllStandRequests = async () => {
  const data = await loadData();
  return data.standRequests || {};
};

// Obtenir les demandes de validation de stand pour un joueur spécifique
const getPlayerStandRequests = async (userName) => {
  const data = await loadData();
  const playerRequests = {};

  if (!data.standRequests) {
    return playerRequests;
  }

  for (const [id, request] of Object.entries(data.standRequests)) {
    if (request.userName === userName) {
      playerRequests[id] = request;
    }
  }

  return playerRequests;
};

// Supprimer les demandes de validation de stand expirées
const cleanExpiredStandRequests = async () => {
  const data = await loadData();

  if (!data.standRequests) {
    data.standRequests = {};
    await saveData(data);
    return false;
  }

  const currentTime = Date.now();
  let changed = false;

  for (const [id, request] of Object.entries(data.standRequests)) {
    if (request.status === "pending" && request.expiresAt < currentTime) {
      delete data.standRequests[id];
      changed = true;
    }
  }

  if (changed) {
    await saveData(data);
  }

  return changed;
};

// Valider une demande de validation de stand
const validateStandRequest = async (requestId) => {
  const data = await loadData();

  if (!data.standRequests || !data.standRequests[requestId]) {
    return false;
  }

  const request = data.standRequests[requestId];
  const userName = request.userName;
  const stand = request.stand;

  // Changer le statut de la demande
  data.standRequests[requestId].status = "validated";

  // Valider le stand pour le joueur
  if (!data.players[userName]) {
    data.players[userName] = {
      stands: {
        taureau: false,
        bowling: false,
        alibi: false,
        pancake: false,
        atelier: false,
      },
      canards: 0,
    };
  }

  data.players[userName].stands[stand] = true;

  await saveData(data);
  return true;
};

// Rejeter une demande de validation de stand
const rejectStandRequest = async (requestId) => {
  const data = await loadData();

  if (!data.standRequests || !data.standRequests[requestId]) {
    return false;
  }

  data.standRequests[requestId].status = "rejected";
  await saveData(data);
  return true;
};

// Vérifier si un joueur peut demander un essai
const canPlayerRequestTrial = async (userName) => {
  const data = await loadData();
  const playerData = data.players[userName] || {
    stands: {
      taureau: false,
      bowling: false,
      alibi: false,
      pancake: false,
      atelier: false,
    },
    canards: 0,
    trialCount: 0,
  };

  // Calcul du nombre de tampons validés
  const validatedStamps = Object.values(playerData.stands).filter(
    (value) => value
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

  // Si le joueur a déjà atteint son maximum d'essais, il ne peut plus en faire
  if (playerData.trialCount >= maxTrials) {
    return {
      allowed: false,
      reason: `Vous avez déjà utilisé tous vos essais (${playerData.trialCount}/${maxTrials}) pour votre niveau de tampons actuel`,
    };
  }

  // Si le joueur n'a aucun tampon, il ne peut pas faire d'essai
  if (validatedStamps === 0) {
    return {
      allowed: false,
      reason: "Vous devez valider au moins un stand avant de demander un essai",
    };
  }

  // Vérifier si le joueur a déjà une demande en cours
  const playerTrials = await getPlayerTrials(userName);
  const pendingTrials = Object.values(playerTrials).filter(
    (trial) => trial.status === "pending"
  );

  if (pendingTrials.length > 0) {
    return {
      allowed: false,
      reason: "Vous avez déjà une demande d'essai en attente",
    };
  }

  return {
    allowed: true,
    maxTrials: maxTrials,
    usedTrials: playerData.trialCount,
  };
};

// Vérifier si un joueur peut demander la validation d'un stand
const canPlayerRequestStandValidation = async (userName, stand) => {
  const data = await loadData();
  const playerData = data.players[userName];

  // Si le joueur a déjà validé ce stand, il ne peut pas demander à nouveau
  if (playerData && playerData.stands[stand]) {
    return {
      allowed: false,
      reason: "Ce stand est déjà validé pour ce joueur",
    };
  }

  // Vérifier si le stand existe
  const validStands = ["taureau", "bowling", "alibi", "pancake", "atelier"];
  if (!validStands.includes(stand)) {
    return { allowed: false, reason: "Stand invalide" };
  }

  // Vérifier si le joueur a déjà une demande en cours pour ce stand
  const playerRequests = await getPlayerStandRequests(userName);
  const pendingStandRequests = Object.values(playerRequests).filter(
    (request) => request.status === "pending" && request.stand === stand
  );

  if (pendingStandRequests.length > 0) {
    return {
      allowed: false,
      reason: "Vous avez déjà une demande en attente pour ce stand",
    };
  }

  return { allowed: true };
};

module.exports = {
  getPlayerData,
  validateStand,
  createTrial,
  getAllTrials,
  getPlayerTrials,
  cleanExpiredTrials,
  validateTrial,
  rejectTrial,
  createStandRequest,
  getAllStandRequests,
  getPlayerStandRequests,
  cleanExpiredStandRequests,
  validateStandRequest,
  rejectStandRequest,
  canPlayerRequestTrial,
  canPlayerRequestStandValidation,
};
