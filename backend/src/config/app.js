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
const zimbraRoutes = require("../routes/zimbra"); // Importer les routes Zimbra
const morgan = require("morgan");
const app = express();

// Utiliser Helmet pour sécuriser les en-têtes HTTP
app.use(helmet());

// Utiliser Morgan pour les logs détaillés des requêtes HTTP
app.use(morgan("combined"));

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

// Route de test pour crash du serveur (à utiliser avec précaution)
app.use("/api/crashh", async (req, res) => {
  res.send("CRASH");
  process.exit(1);
});

module.exports = app;