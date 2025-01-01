// backend/src/services/casService.js
const axios = require("axios");
const loginService = require('./loginService');
const fs = require('fs');
const path = require('path');

const casBaseURL = "https://cas.centralelille.fr";
const serviceURL = `${process.env.URL_BACK}/api/auth/callback`;
const USER_DATA_FILE = path.join(__dirname, '../data/users.json');

exports.login = (req, res) => {
  const loginUrl = `${casBaseURL}/login?service=${encodeURIComponent(serviceURL)}`;
  res.redirect(loginUrl);
};

exports.callback = async (req, res) => {
  const { ticket } = req.query;

  if (!ticket) {
    console.warn("[CAS Service] Ticket CAS manquant dans la requête");
    return res.status(400).send("Erreur : ticket CAS manquant.");
  }

  try {
    const validateUrl = `${casBaseURL}/p3/serviceValidate?service=${encodeURIComponent(serviceURL)}&ticket=${ticket}`;
    const response = await axios.get(validateUrl);

    // Amélioration de l'extraction des données XML
    const xmlData = response.data;
    const userName = xmlData.match(/<cas:user>(.*?)<\/cas:user>/)?.[1];
    
    // Nouvelle méthode pour extraire displayName depuis les attributs
    const displayName = xmlData.match(/<cas:displayName>(.*?)<\/cas:displayName>/)?.[1];

    if (!userName) {
      console.error("[CAS Service] Nom d'utilisateur non trouvé dans la réponse CAS");
      return res.status(401).send("Échec de l'authentification CAS.");
    }

    console.log("[CAS Service] Données extraites:", { userName, displayName }); // Debug log

    // Sauvegarde ou mise à jour des informations utilisateur
    const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
    if (!users[userName]) {
      // Nouvel utilisateur
      users[userName] = {
        userName: userName,
        displayName: displayName || null,
        icalLink: null
      };
    } else {
      // Mise à jour du displayName pour un utilisateur existant
      users[userName].displayName = displayName || users[userName].displayName;
    }
    
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
    console.log("[CAS Service] Utilisateur mis à jour:", users[userName]);

    req.session.user = { userName, casTicket: ticket, displayName };
    loginService.addLogin(displayName);
    res.redirect(process.env.URL_FRONT);

  } catch (error) {
    console.error("[CAS Service] Erreur complète:", error);
    console.error("[CAS Service] Réponse CAS:", error.response?.data);
    res.status(500).send("Erreur lors de la validation CAS.");
  }
};