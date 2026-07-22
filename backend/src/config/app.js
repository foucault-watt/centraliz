// backend/src/config/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();
const authRoutes = require("../routes/auth");
const csvRoutes = require("../routes/csv");
const claRoutes = require("../routes/cla");
const hpRoutes = require("../routes/hp");
const feedbackRoutes = require("../routes/feedback");
const zimbraRoutes = require("../routes/zimbra");
const publicRoutes = require("../routes/publicData");
const evaRoutes = require("../routes/eva");
const statsRoutes = require("../routes/stats");
const rankRoutes = require("../routes/ranking");
const coefRoutes = require("../routes/coef");
const morgan = require("morgan");
const logService = require("../services/logService");
const { initializeSession } = require("./session");

async function createApp() {
  const app = express();

  app.use(helmet());

  app.use(
    morgan("combined", {
      skip: function (req) {
        return req.url === "/healthcheck";
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
      origin: `${process.env.URL_FRONT}`,
      credentials: true,
    })
  );

  app.use(await initializeSession(process.env));
  app.use(express.json());

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

  app.use(`/api/${process.env.SECRET_API}/crash`, async (req, res) => {
    res.send("CRASH");
    process.exit(1);
  });

  app.use((err, req, res, next) => {
    logService.log(`ERROR: ${err.stack}`);
    res.status(500).json({ error: "Une erreur est survenue" });
  });

  return app;
}

module.exports = { createApp };
