const express = require("express");
const router = express.Router();
const casService = require("../services/casService");
const tokenService = require("../services/tokenService");
const loginService = require("../services/loginService"); // Importez loginService
const cookieParser = require('cookie-parser');

// Middleware pour parser les cookies, nécessaire pour lire le cookie remember_me
router.use(cookieParser());

router.get("/status", async (req, res) => {
  if (req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }

  const rememberMeToken = req.cookies.remember_me;
  if (!rememberMeToken) {
    return res.json({ authenticated: false, user: null });
  }

  const user = await tokenService.validateToken(rememberMeToken);
  if (user) {
    req.session.user = {
      userName: user.username,
      displayName: user.display_name,
      icalLink: user.ical_link,
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