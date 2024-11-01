// backend/src/routes/zimbra.js
const express = require("express");
const router = express.Router();
const ZimbraService = require("../services/zimbraService");
const authMiddleware = require("../middlewares/auth");

/**
 * Route pour authentifier l'utilisateur Zimbra et récupérer les mails.
 * POST /api/zimbra
 */
router.post("/", authMiddleware, async (req, res) => {
  const { username, password } = req.body;
  
  console.log(`[Zimbra Route] Requête d'authentification Zimbra pour l'utilisateur: ${username}`);

  if (!username || !password) {
    console.warn("[Zimbra Route] Nom d'utilisateur ou mot de passe manquant");
    return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis" });
  }

  try {
    const xmlData = await ZimbraService.authenticate(username, password);
    const mails = await ZimbraService.parseRSS(xmlData);
    req.session.zimbraToken = Buffer.from(`${username}:${password}`).toString("base64"); // Stocker l'authHeader encodé

    console.log(`[Zimbra Route] Authentification Zimbra réussie pour ${username}`);
    res.json({ success: true, mails });
  } catch (error) {
    console.error(`[Zimbra Route] Échec de l'authentification Zimbra pour ${username}:`, error.message);
    res.status(401).json({ error: "Authentification Zimbra échouée" });
  }
});

/**
 * Route pour récupérer les mails de l'utilisateur.
 * GET /api/zimbra/mails
 */
router.get("/mails", authMiddleware, async (req, res) => {
  const { zimbraToken } = req.session;
  const username = req.session.user.userName;

  console.log(`[Zimbra Route] Requête de récupération des mails pour l'utilisateur: ${username}`);

  if (!zimbraToken) {
    console.warn(`[Zimbra Route] Token Zimbra manquant pour l'utilisateur: ${username}`);
    return res.status(401).json({ error: "Accès aux mails non autorisé" });
  }

  try {
    const mails = await ZimbraService.getMailsFromToken(zimbraToken);
    console.log(`[Zimbra Route] Mails récupérés pour ${username}: ${mails.length} emails`);
    res.json({ mails });
  } catch (error) {
    console.error(`[Zimbra Route] Erreur lors de la récupération des mails pour ${username}:`, error.message);
    res.status(500).json({ error: "Erreur lors de la récupération des mails" });
  }
});

module.exports = router;