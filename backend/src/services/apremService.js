bconst fs = require("fs").promises;
const path = require("path");

const dataPath = path.join(__dirname, "../data/aprem.json");
const backupPath = path.join(__dirname, "../data/aprem_backup.json");

const loadData = async () => {
  try {
    const data = await fs.readFile(dataPath, "utf8");
    const parsedData = JSON.parse(data);

    // Vérification minimale de l'intégrité des données
    if (!parsedData.players || !parsedData.trials) {
      console.error(
        "Structure de données incomplète, création des propriétés manquantes"
      );
      // Au lieu de remplacer complètement, compléter les données manquantes
      if (!parsedData.players) parsedData.players = {};
      if (!parsedData.trials) parsedData.trials = {};
      if (!parsedData.standRequests) parsedData.standRequests = {};

      // Sauvegarder la structure réparée
      await fs.writeFile(dataPath, JSON.stringify(parsedData, null, 2), "utf8");
    }

    return parsedData;
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error.message);

    // Si le fichier n'existe pas, créer une nouvelle structure
    if (error.code === "ENOENT") {
      const initialData = {
        players: {},
        trials: {},
        standRequests: {},
      };

      try {
        // Créer le dossier data s'il n'existe pas
        const dataDir = path.dirname(dataPath);
        await fs.mkdir(dataDir, { recursive: true });

        // Créer le fichier initial
        await fs.writeFile(
          dataPath,
          JSON.stringify(initialData, null, 2),
          "utf8"
        );
        console.log("Fichier de données créé avec structure initiale");
      } catch (writeError) {
        console.error(
          "Erreur lors de la création du fichier initial:",
          writeError
        );
      }

      return initialData;
    }

    // Pour les autres erreurs, essayer de lire le fichier comme du texte brut
    try {
      const rawData = await fs.readFile(dataPath, "utf8");
      console.warn("Fichier JSON corrompu, tentative de récupération");

      // Si le fichier existe mais est corrompu, créer une nouvelle structure
      // tout en préservant le fichier original dans un backup
      const timestamp = Date.now();
      const backupFileName = `aprem_corrupted_${timestamp}.json`;
      const backupPath = path.join(path.dirname(dataPath), backupFileName);

      await fs.writeFile(backupPath, rawData, "utf8");
      console.log(`Backup du fichier corrompu créé: ${backupFileName}`);

      // Créer une nouvelle structure
      const newData = {
        players: {},
        trials: {},
        standRequests: {},
      };

      await fs.writeFile(dataPath, JSON.stringify(newData, null, 2), "utf8");
      console.log("Nouveau fichier de données créé avec structure propre");

      return newData;
    } catch (readError) {
      // Si même la lecture brute échoue, retourner une structure vide
      console.error(
        "Échec total de récupération, création d'une nouvelle structure de données"
      );
      return {
        players: {},
        trials: {},
        standRequests: {},
      };
    }
  }
};

const saveData = async (data) => {
  // Vérifier l'intégrité des données avant de sauvegarder
  if (!data || typeof data !== "object") {
    console.error("Tentative de sauvegarde de données invalides (non objet)");
    throw new Error("Données invalides (pas un objet)");
  }

  // S'assurer que les propriétés essentielles existent
  if (!data.players) data.players = {};
  if (!data.trials) data.trials = {};
  if (!data.standRequests) data.standRequests = {};

  try {
    // Créer un fichier temporaire pour la transaction
    const tempPath = `${dataPath}.temp`;

    // Écrire d'abord dans le fichier temporaire
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");

    // Vérifier que le fichier temporaire est bien formé
    try {
      const tempData = await fs.readFile(tempPath, "utf8");
      JSON.parse(tempData); // Simplement tester que c'est un JSON valide
    } catch (validationError) {
      // Si le fichier temporaire est corrompu, annuler la transaction
      await fs.unlink(tempPath);
      throw new Error("Données corrompues détectées pendant la validation");
    }

    // Renommer le fichier temporaire pour remplacer l'original (opération atomique)
    try {
      await fs.rename(tempPath, dataPath);
    } catch (renameError) {
      // Si le renommage échoue, essayer une approche alternative
      console.warn("Renommage atomique échoué, tentative de copie/suppression");
      await fs.copyFile(tempPath, dataPath);
      await fs.unlink(tempPath);
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des données:", error.message);
    throw error;
  }
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
      points: 0, // Ajout du compteur de points
    };
    await saveData(data);
  }

  // Assurer la compatibilité avec les données existantes
  if (data.players[userName].trialCount === undefined) {
    data.players[userName].trialCount = 0;
    await saveData(data);
  }

  // Assurer la compatibilité avec les données existantes pour les points
  if (data.players[userName].points === undefined) {
    data.players[userName].points = 0;
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
const validateTrial = async (trialId, canards, points) => {
  try {
    const data = await loadData();

    if (!data.trials[trialId]) {
      return false;
    }

    // Créer une copie des données pour pouvoir restaurer en cas d'erreur
    const originalData = JSON.parse(JSON.stringify(data));

    try {
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
          points: 0,
        };
      }

      // Assurer la compatibilité avec les données existantes
      if (data.players[userName].trialCount === undefined) {
        data.players[userName].trialCount = 0;
      }

      // Assurer la compatibilité avec les données existantes pour les points
      if (data.players[userName].points === undefined) {
        data.players[userName].points = 0;
      }

      // Incrémenter le compteur de demandes validées
      data.players[userName].trialCount += 1;

      // Ajouter un seul canard à la fois
      data.players[userName].canards += 1;

      // Ajouter les points (valeur par défaut: 1)
      data.players[userName].points += points || 1;

      await saveData(data);
      return true;
    } catch (updateError) {
      // En cas d'erreur pendant la mise à jour, essayer de restaurer l'état original
      console.error(
        "Erreur pendant la validation, tentative de restauration:",
        updateError
      );
      try {
        await saveData(originalData);
        console.log("Restauration réussie, données préservées");
      } catch (restoreError) {
        console.error("Échec de la restauration:", restoreError);
      }
      throw updateError;
    }
  } catch (error) {
    console.error("Erreur critique dans validateTrial:", error);
    throw error;
  }
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
