const express = require("express");
const router = express.Router();
const cadsService = require("../services/cadsService");
const authMiddleware = require("../middlewares/auth");

// Route pour enregistrer un utilisateur (accessible sans authentification)
router.get("/", (req, res) => {
  // Marquer l'intention d'enregistrement dans la session
  req.session.cadsRegistrationPending = true;

  // Si l'utilisateur est déjà authentifié, traiter immédiatement
  if (req.session.user) {
    const success = cadsService.addUser({
      userName: req.session.user.userName,
      displayName: req.session.user.displayName || req.session.user.userName,
    });

    // Nettoyer l'intention d'enregistrement
    delete req.session.cadsRegistrationPending;

    // Rediriger vers le frontend
    return res.redirect(
      `${process.env.URL_FRONT}`
    );
  }

  // Sinon, rediriger vers l'authentification
  res.redirect("/api/auth/login");
});

// Route pour obtenir la liste des utilisateurs (protégée)
router.get("/users", authMiddleware, (req, res) => {
  const users = cadsService.getUsers();
  res.json(users);
});

// Ajouter la route de vérification
router.get("/users/check", (req, res) => {
  const { userName } = req.query;

  if (!userName) {
    return res.status(400).json({ error: "userName est requis" });
  }

  const users = cadsService.getUsers();
  const isCanartUser = users.some((user) => user.userName === userName);

  res.json({ isCanartUser });
});

module.exports = router;
