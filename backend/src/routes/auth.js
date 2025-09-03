const express = require("express");
const router = express.Router();
const casService = require("../services/casService");
const tokenService = require("../services/tokenService");
const loginService = require("../services/loginService"); // Importez loginService
const cookieParser = require('cookie-parser');

// Middleware pour parser les cookies, nécessaire pour lire le cookie remember_me
router.use(cookieParser());

router.get("/status", async (req, res) => {
  let userFromSession = req.session.user;
  let fullUser = null;

  if (userFromSession) {
    // Si une session existe, on tente de récupérer les infos complètes de l'utilisateur depuis la BDD
    const { data, error } = await loginService.getUser(userFromSession.userName);
    if (error || !data) {
      console.error("[Auth Status] Erreur: impossible de récupérer l'utilisateur complet pour la session existante", error);
      // Si on ne peut pas récupérer l'utilisateur, on invalide la session
      req.session.destroy();
      res.clearCookie('remember_me');
      return res.json({ authenticated: false, user: null });
    }
    fullUser = data;
  } else {
    // Si pas de session, on vérifie le cookie remember_me
    const rememberMeToken = req.cookies.remember_me;
    if (!rememberMeToken) {
      return res.json({ authenticated: false, user: null });
    }

    const validatedUser = await tokenService.validateToken(rememberMeToken);
    if (!validatedUser) {
      res.clearCookie('remember_me');
      return res.json({ authenticated: false, user: null });
    }

    // Le token est valide, on récupère les infos complètes de l'utilisateur
    const { data, error } = await loginService.getUser(validatedUser.username);
    if (error || !data) {
      console.error("[Auth Status] Erreur: impossible de récupérer l'utilisateur complet pour la session remember_me", error);
      res.clearCookie('remember_me');
      return res.json({ authenticated: false, user: null });
    }
    fullUser = data;
  }

  if (fullUser) {
    // Créer/Mettre à jour la session avec les données complètes et correctes
    req.session.user = {
      userName: fullUser.username,
      displayName: fullUser.display_name,
      icalLink: fullUser.ical_link,
      is_admin: fullUser.is_admin,
      is_bibli_admin: fullUser.is_bibli_admin
    };
    return res.json({ authenticated: true, user: req.session.user });
  }

  res.clearCookie('remember_me');
  return res.json({ authenticated: false, user: null });
});

router.get("/login", (req, res, next) => {
  req.session.rememberMe = req.query.remember === 'true';
  casService.login(req, res, next);
});

router.get("/callback", casService.callback);

router.post("/logout", async (req, res) => {
  const rememberMeToken = req.cookies.remember_me;
  if (rememberMeToken) {
    await tokenService.deleteToken(rememberMeToken);
  }
  res.clearCookie('remember_me');
  req.session.destroy();
  res.status(200).send("Logged out");
});

module.exports = router;