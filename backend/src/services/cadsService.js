const fs = require("fs");
const path = require("path");

// Chemin vers le fichier JSON pour stocker les utilisateurs CADS
const CADS_FILE_PATH = path.join(__dirname, "../data/cads-users.json");

// Assurer que le fichier existe
const ensureFileExists = () => {
  const dirPath = path.dirname(CADS_FILE_PATH);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(CADS_FILE_PATH)) {
    fs.writeFileSync(CADS_FILE_PATH, JSON.stringify([]));
  }
};

// Obtenir la liste des utilisateurs enregistrés
const getUsers = () => {
  ensureFileExists();
  try {
    const data = fs.readFileSync(CADS_FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(
      `[CADS Service] Erreur lors de la lecture du fichier: ${error.message}`
    );
    return [];
  }
};

// Ajouter un nouvel utilisateur au fichier
const addUser = (user) => {
  try {
    const users = getUsers();

    // Vérifier si l'utilisateur existe déjà
    const existingUser = users.find((u) => u.userName === user.userName);

    if (!existingUser) {
      // Ajouter l'utilisateur avec horodatage
      users.push({
        userName: user.userName,
        displayName: user.displayName,
        registeredAt: new Date().toISOString(),
      });

      fs.writeFileSync(CADS_FILE_PATH, JSON.stringify(users, null, 2));
      console.log(`[CADS Service] Utilisateur ajouté: ${user.userName}`);
      return true;
    } else {
      console.log(
        `[CADS Service] Utilisateur déjà enregistré: ${user.userName}`
      );
      return false;
    }
  } catch (error) {
    console.error(
      `[CADS Service] Erreur lors de l'ajout d'un utilisateur: ${error.message}`
    );
    return false;
  }
};

module.exports = {
  getUsers,
  addUser,
};
