// backend/src/services/casService.js
const axios = require("axios");
const loginService = require('./loginService');

const casBaseURL = "https://cas.centralelille.fr";
const serviceURL = `${process.env.URL_BACK}/api/auth/callback`;

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


    const usernameMatch = /<cas:user>(.*?)<\/cas:user>/.exec(response.data);
    const displayNameMatch = /<cas:displayName>(.*?)<\/cas:displayName>/.exec(response.data);

    const userName = usernameMatch ? usernameMatch[1] : null;
    const displayName = displayNameMatch ? displayNameMatch[1] : null;

    if (!userName) {
      return res.status(401).send("Échec de l'authentification CAS.");
    }

    req.session.user = { userName, casTicket: ticket, displayName };

    // Enregistre la connexion de l'utilisateur
    loginService.addLogin(displayName);

    res.redirect(process.env.URL_FRONT);
  } catch (error) {
    console.error("[CAS Service] Erreur lors de la validation du ticket CAS:", error.message);
    res.status(500).send("Erreur lors de la validation CAS.");
  }
};