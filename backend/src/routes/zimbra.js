// backend/src/routes/zimbra.js
const express = require("express");
const router = express.Router();
const ZimbraService = require("../services/zimbraService");
const authMiddleware = require("../middlewares/auth");
const analyticsService = require("../services/analyticsService");
const selectUsersWithEntPasswordStorage = require("../utils/selectUsersWithEntPasswordStorage");
const {
  attachUserKey,
  buildUserKeyMissingError,
  readUserKey,
  requireUserKey,
} = require("../middlewares/userKey");

const handleEntError = (res, error, fallbackMessage) => {
  const statusCode = error.statusCode || 500;
  const payload = ZimbraService.buildErrorPayload(
    error.statusCode
      ? error
      : ZimbraService.createServiceError(fallbackMessage, {
          statusCode: 500,
        })
  );

  return res.status(statusCode).json(payload);
};

const usesBrowserStorage = (req) =>
  req.session.user.ent_password_storage === "browser";

const browserPasswordRequired = (res) =>
  res.status(428).json({
    error: "Mot de passe ENT requis sur ce navigateur",
    code: "ENT_PASSWORD_REQUIRED",
  });

const requireStoredPassword = (req, res, next) =>
  usesBrowserStorage(req) ? browserPasswordRequired(res) : requireUserKey(req, res, next);

router.use(async (req, res, next) => {
  const user = req.session?.user;
  if (!user || usesBrowserStorage(req)) return next();
  try {
    const { data, error } = await selectUsersWithEntPasswordStorage(
      "username", (query) => query.eq("username", user.userName).maybeSingle(),
    );
    if (error) throw error;
    if (data?.ent_password_storage === "browser") {
      user.ent_password_storage = "browser";
      delete req.session.zimbraToken;
    }
    return next();
  } catch {
    return res.status(503).json({ error: "Impossible de vérifier le mode ENT." });
  }
});

/**
 * Route pour vérifier si un mot de passe est stocké pour l'utilisateur.
 * GET /api/zimbra/check
 */
router.get("/check", authMiddleware, async (req, res) => {
  const username = req.session.user.userName;
  try {
    const hasPassword = !usesBrowserStorage(req) &&
      await ZimbraService.hasStoredPassword(username);
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
router.post("/auto-auth", authMiddleware, requireStoredPassword, async (req, res) => {
  const username = req.session.user.userName;
  try {
    const jsonData = await ZimbraService.authenticateWithStoredPassword(
      username,
      req.userKey
    );
    const mails = await ZimbraService.parseMails(jsonData);
    req.session.zimbraToken = await ZimbraService.getTokenFromUsername(
      username,
      req.userKey
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
    handleEntError(res, error, "Authentification automatique échouée");
  }
});

/**
 * Route pour authentifier l'utilisateur Zimbra et récupérer les mails.
 * POST /api/zimbra
 */
router.post("/", authMiddleware, attachUserKey, async (req, res) => {
  const { ent_username, password } = req.body || {};
  const browserStorage = usesBrowserStorage(req);
  const rememberMe = !browserStorage && Boolean(req.body?.rememberMe);
  const username = req.session.user.userName;
  if (typeof ent_username !== "string" || !ent_username ||
      typeof password !== "string" || !password) {
    console.warn(
      "[Zimbra Route] Nom d'utilisateur ENT ou mot de passe manquant"
    );
    return res
      .status(400)
      .json({ error: "Nom d'utilisateur ENT et mot de passe requis" });
  }

  try {
    if (rememberMe && !req.userKey) {
      const userKeyError = buildUserKeyMissingError();
      return res.status(userKeyError.statusCode).json(userKeyError.payload);
    }

    const jsonData = await ZimbraService.authenticate(ent_username, password);
    const mails = await ZimbraService.parseMails(jsonData);
    if (browserStorage) {
      res.set("Cache-Control", "no-store");
    } else {
      req.session.zimbraToken = Buffer.from(
        `${ent_username}:${password}`
      ).toString("base64");
    }

    // Link ent_username to user
    await ZimbraService.linkEntUsername(username, ent_username);

    if (rememberMe) {
      await ZimbraService.storeEncryptedPassword(
        ent_username,
        password,
        readUserKey(req)
      );
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
    handleEntError(res, error, "Authentification Zimbra échouée");
  }
});

/**
 * Route pour récupérer les mails de l'utilisateur.
 * GET /api/zimbra/mails
 */
router.get("/mails", authMiddleware, async (req, res) => {
  if (usesBrowserStorage(req)) return browserPasswordRequired(res);
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
    handleEntError(res, error, "Erreur lors de la récupération des mails");
  }
});

/**
 * Route pour récupérer le contenu brut d'un mail
 * GET /api/zimbra/mail/:id
 */
const sendMailContent = async (req, res, zimbraToken) => {
  const mailId = req.params.id;
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
    handleEntError(res, error, "Erreur lors de la récupération du mail");
  }
};

router.get("/mail/:id", authMiddleware, (req, res) => {
  if (usesBrowserStorage(req)) return browserPasswordRequired(res);
  const { zimbraToken } = req.session;
  if (!zimbraToken) {
    return res.status(401).json({ error: "Accès au mail non autorisé" });
  }
  return sendMailContent(req, res, zimbraToken);
});

router.post("/mail/:id", authMiddleware, (req, res) => {
  if (!usesBrowserStorage(req)) return res.sendStatus(404);
  res.set("Cache-Control", "no-store");
  const { ent_username, password } = req.body || {};
  if (typeof ent_username !== "string" || !ent_username ||
      typeof password !== "string" || !password) {
    return browserPasswordRequired(res);
  }
  return sendMailContent(
    req, res, Buffer.from(`${ent_username}:${password}`).toString("base64"),
  );
});

module.exports = router;
