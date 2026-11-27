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
const { createMoodleService } = require("../services/moodleService");
const moodleRoutes = require("../routes/moodle")({
  authMiddleware: require("../middlewares/auth"),
  moodleService: createMoodleService({ credentialsService: require("../services/zimbraService") }),
});
const publicRoutes = require("../routes/publicData");
const evaRoutes = require("../routes/eva");
const statsRoutes = require("../routes/stats");
const rankRoutes = require("../routes/ranking");
const coefRoutes = require("../routes/coef");
const gradesRoutes = require("../routes/grades");
const cekiRoutes = require("../routes/ceki");
const bibliRoutes = require("../routes/bibli");
const bdsRoutes = require("../routes/bds");
const eventsRoutes = require("../routes/events");
const analyticsRoutes = require("../routes/analytics");
const pokemonRoutes = require("../routes/pokemon");
const campaignsRoutes = require("../routes/campaigns");
const userRoutes = require("../routes/user");
const themePaletteRoutes = require("../routes/themePalette");
const navPagesRoutes = require("../routes/navPages");
const morgan = require("morgan");
const logService = require("../services/logService");
const app = express();
const { installRestartRoutes, skipSensitiveRequest } = require('../utils/restartRoutes');

// Faire confiance au premier proxy (nécessaire pour ngrok et le déploiement)
app.set("trust proxy", 1);

// Utiliser Helmet pour sécuriser les en-têtes HTTP
app.use(helmet());

const POKEMON_POLLING = /^\/api\/pokemon\/(frame|frame-status|presence)(\?|$)/;
const isPokemonPolling = (req) => POKEMON_POLLING.test(req.originalUrl || req.url || "");

// Utiliser Morgan pour les logs détaillés des requêtes HTTP
app.use(
  morgan("combined", {
    skip: function (req, res) {
      // Le flux Pokémon interroge ces routes jusqu'à 30 fois par seconde et
      // par spectateur : les logger remplirait le disque (~800 Mo/jour par
      // spectateur). Seules leurs erreurs sont gardées.
      if (isPokemonPolling(req) && res.statusCode < 400) return true;
      // Skip les logs Morgan qui seraient dupliqués
      return skipSensitiveRequest(req, process.env.SECRET_API);
    },
    stream: {
      write: (message) => {
        logService.log(`HTTP: ${message.trim()}`);
      },
    },
  }),
);

app.use(
  cors({
    origin: `${process.env.URL_FRONT}`, // Remplacez par l'URL de votre frontend
    credentials: true,
  }),
);

// Extrait dans une variable pour que le serveur WebSocket puisse rejouer
// exactement le même middleware (même secret, même store) sur les upgrades.
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || process.env.SECRET_KEY_CENTRALIZ,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.SECURE === "true", // Mettez à true en production avec HTTPS
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE || "lax", // 'lax' par défaut, 'none' pour ngrok
  },
});

app.use(sessionMiddleware);

app.use(express.json());

const { remoteConfig, createRemoteMcpRouter } = require('../mcp/remoteHttp.cjs');
const mcpConfig = remoteConfig(process.env);
if (mcpConfig) {
  const path = require('node:path');
  const credentialsService = require('../services/zimbraService');
  const moodleService = createMoodleService({ credentialsService });
  const { router } = createRemoteMcpRouter({ ...mcpConfig, credentialsService, moodleService,
    storeFile: path.resolve(__dirname, '../../data/mcp-oauth/store.json') });
  app.use(router);
}

// Utiliser les routes
app.use("/api/auth", authRoutes);
app.use("/api/zimbra", zimbraRoutes);
app.use("/api/moodle", moodleRoutes);
app.use("/api", csvRoutes);
app.use("/api", claRoutes);
app.use("/api", hpRoutes);
app.use("/api", feedbackRoutes);
app.use("/api", publicRoutes);
app.use("/api/eva", evaRoutes);
app.use("/api", statsRoutes);
app.use("/api", rankRoutes);
app.use("/api/coef", coefRoutes);
app.use("/api/grades", gradesRoutes);
app.use("/api/ceki", cekiRoutes);
app.use("/api/bibli", bibliRoutes);
app.use("/api/bds", bdsRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/pokemon", pokemonRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/theme-palette", themePaletteRoutes);
app.use("/api/nav-pages", navPagesRoutes);

installRestartRoutes(app, {
  secret: process.env.SECRET_API,
  exit: (code) => (app.locals.restart ?? process.exit)(code),
});

// Assurez-vous que ce middleware est placé après les routes pour éviter les conflits
app.use((err, req, res, next) => {
  logService.log(`ERROR: ${err.stack}`);
  res.status(500).json({ error: "Une erreur est survenue" });
});

module.exports = { app, sessionMiddleware };
