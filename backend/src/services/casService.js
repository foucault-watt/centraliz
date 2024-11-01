// backend/src/services/casService.js
const axios = require("axios");

const casBaseURL = "https://cas.centralelille.fr";
const serviceURL = `${process.env.URL_BACK}/api/auth/callback`;

exports.login = (req, res) => {
  console.log("[CAS Service] Redirection vers CAS pour l'authentification");
  const loginUrl = `${casBaseURL}/login?service=${encodeURIComponent(serviceURL)}`;
  res.redirect(loginUrl);
};

exports.callback = async (req, res) => {
  const { ticket } = req.query;
  console.log(`[CAS Service] Callback CAS reçu avec ticket: ${ticket}`);

  if (!ticket) {
    console.warn("[CAS Service] Ticket CAS manquant dans la requête");
    return res.status(400).send("Erreur : ticket CAS manquant.");
  }

  try {
    const validateUrl = `${casBaseURL}/p3/serviceValidate?service=${encodeURIComponent(serviceURL)}&ticket=${ticket}`;
    console.log(`[CAS Service] Validation de ticket CAS via URL: ${validateUrl}`);
    const response = await axios.get(validateUrl);

    console.log("[CAS Service] Réponse de validation CAS reçue");

    const usernameMatch = /<cas:user>(.*?)<\/cas:user>/.exec(response.data);
    const displayNameMatch = /<cas:displayName>(.*?)<\/cas:displayName>/.exec(response.data);

    const userName = usernameMatch ? usernameMatch[1] : null;
    const displayName = displayNameMatch ? displayNameMatch[1] : null;

    if (!userName) {
      console.error("[CAS Service] Échec de l'authentification CAS : utilisateur non trouvé");
      return res.status(401).send("Échec de l'authentification CAS.");
    }

    req.session.user = { userName, casTicket: ticket, displayName };
    console.log(`[CAS Service] Authentification CAS réussie pour l'utilisateur: ${userName}`);

    res.redirect(process.env.URL_FRONT);
  } catch (error) {
    console.error("[CAS Service] Erreur lors de la validation du ticket CAS:", error.message);
    res.status(500).send("Erreur lors de la validation CAS.");
  }
};