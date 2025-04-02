// backend/src/services/casService.js
const axios = require("axios");
const loginService = require("./loginService");
const fs = require("fs");
const path = require("path");
const cadsService = require("./cadsService");

const casBaseURL = "https://cas.centralelille.fr";
const serviceURL = `${process.env.URL_BACK}/api/auth/callback`;
const USER_DATA_FILE = path.join(__dirname, "../data/users.json");

exports.login = (req, res) => {
  const loginUrl = `${casBaseURL}/login?service=${encodeURIComponent(
    serviceURL
  )}`;
  res.redirect(loginUrl);
};

exports.callback = async (req, res) => {
  const { ticket } = req.query;

  if (!ticket) {
    console.warn("[CAS Service] Ticket CAS manquant dans la requête");
    return res.status(400).send("Erreur : ticket CAS manquant.");
  }

  try {
    const validateUrl = `${casBaseURL}/p3/serviceValidate?service=${encodeURIComponent(
      serviceURL
    )}&ticket=${ticket}`;
    const response = await axios.get(validateUrl);

    // Amélioration de l'extraction des données XML
    const xmlData = response.data;

    const userName = xmlData.match(/<cas:user>(.*?)<\/cas:user>/)?.[1];

    // Nouvelle méthode pour extraire displayName depuis les attributs
    const displayName = xmlData.match(
      /<cas:displayName>(.*?)<\/cas:displayName>/
    )?.[1];
    
    // Extraction des groupes d'appartenance (memberOf)
    const memberOfMatches = xmlData.match(/<cas:memberOf>(.*?)<\/cas:memberOf>/g);
    const memberOf = memberOfMatches 
      ? memberOfMatches.map(match => match.replace(/<cas:memberOf>(.*?)<\/cas:memberOf>/, '$1')) 
      : [];
    
    // Vérifier si l'utilisateur est membre de IE1
    const isIE1Member = memberOf.some(group => group.includes('CHIMIE'));

    if (!userName) {
      console.error(
        "[CAS Service] Nom d'utilisateur non trouvé dans la réponse CAS"
      );
      return res.status(401).send("Échec de l'authentification CAS.");
    }

    // Sauvegarde ou mise à jour des informations utilisateur
    const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, "utf-8"));
    if (!users[userName]) {
      // Nouvel utilisateur
      users[userName] = {
        userName: userName,
        displayName: displayName || null,
        icalLink: null,
        isIE1Member: isIE1Member
      };
    } else {
      // Mise à jour des informations pour un utilisateur existant
      users[userName].displayName = displayName || users[userName].displayName;
      users[userName].isIE1Member = isIE1Member;
    }

    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
    console.log("[CAS Service] Utilisateur mis à jour:", users[userName]);

    req.session.user = { 
      userName, 
      casTicket: ticket, 
      displayName,
      isIE1Member
    };
    loginService.addLogin(displayName);

    // Vérifier s'il y a une demande d'enregistrement CADS en attente
    if (req.session.cadsRegistrationPending) {
      // Ajouter l'utilisateur au service CADS
      const success = cadsService.addUser({
        userName: userName,
        displayName: displayName || userName,
      });

      // Nettoyer la session
      delete req.session.cadsRegistrationPending;

      // Rediriger vers la page de succès CADS
      return res.redirect(
        `${process.env.URL_FRONT}`
      );
    }

    // Redirection standard après authentification
    res.redirect(process.env.URL_FRONT);
  } catch (error) {
    console.error("[CAS Service] Erreur complète:", error);
    console.error("[CAS Service] Réponse CAS:", error.response?.data);
    res.status(500).send("Erreur lors de la validation CAS.");
  }
};
