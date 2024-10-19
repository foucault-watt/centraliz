const axios = require("axios");

const casBaseURL = "https://cas.centralelille.fr";
const serviceURL = `${process.env.URL_BACK}/api/auth/callback`;

exports.login = (req, res) => {
  console.log("Cas login");
  const loginUrl = `${casBaseURL}/login?service=${encodeURIComponent(
    serviceURL
  )}`;
  res.redirect(loginUrl);
};

exports.callback = async (req, res) => {
  const { ticket } = req.query;
  if (!ticket) {
    return res.status(400).send("Erreur : ticket CAS manquant.");
  }

  try {
    const validateUrl = `${casBaseURL}/p3/serviceValidate?service=${encodeURIComponent(
      serviceURL
    )}&ticket=${ticket}`;
    const response = await axios.get(validateUrl);

    const usernameMatch = /<cas:user>(.*?)<\/cas:user>/.exec(response.data);
    const userName = usernameMatch ? usernameMatch[1] : null;

    if (!userName) {
      return res.status(401).send("Échec de l'authentification CAS.");
    }

    req.session.user = { userName, casTicket: ticket, displayName: /<cas:displayName>(.*?)<\/cas:displayName>/.exec(response.data)[1] };
    console.log("tata", req.session.user);
    res.redirect(process.env.URL_FRONT);

    console.log("Ticket CAS validé.");
  } catch (error) {
    console.error("Erreur lors de la validation du ticket CAS:", error);
    res.status(500).send("Erreur lors de la validation CAS.");
  }
};