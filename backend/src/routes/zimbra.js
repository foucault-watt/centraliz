// backend/src/routes/zimbra.js
const express = require("express");
const router = express.Router();
const ZimbraService = require("../services/zimbraService");
const authMiddleware = require("../middlewares/auth");
const analyticsService = require("../services/analyticsService");

/**
 * Route pour vérifier si un mot de passe est stocké pour l'utilisateur.
 * GET /api/zimbra/check
 */
router.get("/check", authMiddleware, async (req, res) => {
  const username = req.session.user.userName;
  try {
    const hasPassword = await ZimbraService.hasStoredPassword(username);
    res.json({ hasPassword });
  } catch (error) {
    console.error(
      `[Zimbra Route] Erreur lors de la vérification du mot de passe stocké pour ${username}:`,
      error.message
    );
    res
      .status(500)
      .json({ error: "Erreur lors de la vérification du mot de passe stocké" });
  }
});

/**
 * Route pour authentifier l'utilisateur en utilisant le mot de passe stocké.
 * POST /api/zimbra/auto-auth
 */
router.post("/auto-auth", authMiddleware, async (req, res) => {
  const username = req.session.user.userName;
  try {
    const jsonData = await ZimbraService.authenticateWithStoredPassword(
      username
    );
    const mails = await ZimbraService.parseMails(jsonData);
    req.session.zimbraToken = await ZimbraService.getTokenFromUsername(
      username
    );
    analyticsService.trackEvent({
      req,
      eventName: "mail_authenticated",
      module: "communication",
      eventType: "load",
      isAutomatic: true,
      properties: { method: "stored_password", mail_count: mails.length },
    });
    res.json({ success: true, mails });
  } catch (error) {
    console.error(
      `[Zimbra Route] Échec de l'authentification automatique pour ${username}:`,
      error.message
    );
    res.status(401).json({ error: "Authentification automatique échouée" });
  }
});

/**
 * Route pour authentifier l'utilisateur Zimbra et récupérer les mails.
 * POST /api/zimbra
 */
router.post("/", authMiddleware, async (req, res) => {
  const { ent_username, password, rememberMe } = req.body;
  const username = req.session.user.userName;
  if (!ent_username || !password) {
    console.warn(
      "[Zimbra Route] Nom d'utilisateur ENT ou mot de passe manquant"
    );
    return res
      .status(400)
      .json({ error: "Nom d'utilisateur ENT et mot de passe requis" });
  }

  try {
    const jsonData = await ZimbraService.authenticate(ent_username, password);
    const mails = await ZimbraService.parseMails(jsonData);
    req.session.zimbraToken = Buffer.from(
      `${ent_username}:${password}`
    ).toString("base64");

    // Link ent_username to user
    await ZimbraService.linkEntUsername(username, ent_username);

    if (rememberMe) {
      await ZimbraService.storeEncryptedPassword(ent_username, password);
    }

    analyticsService.trackEvent({
      req,
      eventName: "mail_authenticated",
      module: "communication",
      eventType: "interaction",
      isAutomatic: false,
      properties: { method: "manual", remember_me: Boolean(rememberMe), mail_count: mails.length },
    });
    res.json({ success: true, mails });
  } catch (error) {
    console.error(
      `[Zimbra Route] Échec de l'authentification Zimbra pour ${username} (ENT: ${ent_username}):`,
      error.message
    );
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

  if (!zimbraToken) {
    console.warn(
      `[Zimbra Route] Token Zimbra manquant pour l'utilisateur: ${username}`
    );
    return res.status(401).json({ error: "Accès aux mails non autorisé" });
  }

  try {
    const mails = await ZimbraService.getMailsFromToken(zimbraToken);
    console.log(
      `[Zimbra Route] Mails récupérés pour ${username}: ${mails.length} emails`
    );
    analyticsService.trackEvent({
      req,
      eventName: "mail_list_loaded",
      module: "communication",
      eventType: "load",
      isAutomatic: true,
      properties: { mail_count: mails.length },
    });
    res.json({ mails });
  } catch (error) {
    console.error(
      `[Zimbra Route] Erreur lors de la récupération des mails pour ${username}:`,
      error.message
    );
    res.status(500).json({ error: "Erreur lors de la récupération des mails" });
  }
});

/**
 * Route pour récupérer le contenu brut d'un mail
 * GET /api/zimbra/mail/:id
 */
router.get("/mail/:id", authMiddleware, async (req, res) => {
  const { zimbraToken } = req.session;
  const username = req.session.user.userName;
  const mailId = req.params.id;

  if (!zimbraToken) {
    return res.status(401).json({ error: "Accès au mail non autorisé" });
  }

  try {
    const content = await ZimbraService.getRawMailContent(zimbraToken, mailId);
    analyticsService.trackEvent({
      req,
      eventName: "mail_detail_opened",
      module: "communication",
      eventType: "interaction",
      isAutomatic: false,
    });
    res.json({ content });
  } catch (error) {
    console.error(
      `[Zimbra Route] Erreur lors de la récupération du mail ${mailId}:`,
      error.message
    );
    res.status(500).json({ error: "Erreur lors de la récupération du mail" });
  }
});

module.exports = router;
