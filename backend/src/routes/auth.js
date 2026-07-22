const express = require("express");
const router = express.Router();
const casService = require("../services/casService");

router.get("/status", (req, res) => {
  res.json({
    authenticated: !!req.session.user,
    user: req.session.user || null,
  });
});

const logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: "Erreur lors de la déconnexion" });
    }
    res.clearCookie("connect.sid");
    return res.status(204).send();
  });
};

router.get("/login", casService.login);
router.get("/callback", casService.callback);
router.post("/logout", logout);
router.get("/logout", logout);
module.exports = router;