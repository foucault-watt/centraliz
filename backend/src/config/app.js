// backend/src/config/app.js
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();
const authRoutes = require("../routes/auth");
const csvRoutes = require("../routes/csv"); // Autres routes selon votre application
const claRoutes = require("../routes/cla");
const hpRoutes = require("../routes/hp");
const feedbackRoutes = require("../routes/feedback");
const zimbraRoutes = require("../routes/zimbra");
const publicRoutes = require("../routes/publicData");
const evaRoutes = require("../routes/eva");
const statsRoutes = require("../routes/stats");
const rankRoutes = require("../routes/ranking");
const coefRoutes = require("../routes/coef");
const alainRoutes = require("../routes/alain");
const morgan = require("morgan");
const logService = require("../services/logService");
const app = express();

// Utiliser Helmet pour sécuriser les en-têtes HTTP
app.use(helmet());

// Utiliser Morgan pour les logs détaillés des requêtes HTTP
app.use(
  morgan("combined", {
    skip: function (req, res) {
      // Skip les logs Morgan qui seraient dupliqués
      return req.url === "/healthcheck"; // exemple de filtre
    },
    stream: {
      write: (message) => {
        logService.log(`HTTP: ${message.trim()}`);
      },
    },
  })
);

app.use(
  cors({
    origin: `${process.env.URL_FRONT}`, // Remplacez par l'URL de votre frontend
    credentials: true,
  })
);

app.use(
  session({
    secret: "monfpizengpzeogn", // Remplacez par une clé secrète sécurisée
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.SECURE === "true", // Mettez à true en production avec HTTPS
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.use(express.json());

// Utiliser les routes
app.use("/api/auth", authRoutes);
app.use("/api/zimbra", zimbraRoutes);
app.use("/api", csvRoutes);
app.use("/api", claRoutes);
app.use("/api", hpRoutes);
app.use("/api", feedbackRoutes);
app.use("/api", publicRoutes);
app.use("/api/eva", evaRoutes);
app.use("/api", statsRoutes);
app.use("/api", rankRoutes);
app.use("/api/coef", coefRoutes);
app.use("/api/alain", alainRoutes);

// Route de test pour crash du serveur (à utiliser avec précaution)
app.use(`/api/${process.env.SECRET_API}/crash`, async (req, res) => {
  res.send("CRASH");
  process.exit(1);
});

// Assurez-vous que ce middleware est placé après les routes pour éviter les conflits
app.use((err, req, res, next) => {
  logService.log(`ERROR: ${err.stack}`);
  res.status(500).json({ error: "Une erreur est survenue" });
});

module.exports = app;
