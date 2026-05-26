const express = require("express");
const authMiddleware = require("../middlewares/auth");
const pokemonService = require("../services/pokemonService");

const router = express.Router();

router.get("/health", authMiddleware, async (req, res) => {
  try {
    const health = await pokemonService.getHealth();
    res.json(health);
  } catch (error) {
    console.error("Erreur lors de la vérification de santé Pokémon:", error);
    res.status(error.status || 503).json({
      success: false,
      status: "offline",
      error:
        error.details ||
        error.message ||
        "Impossible de joindre le backend Pokémon.",
      acceptedButtons: pokemonService.ALLOWED_BUTTONS,
    });
  }
});

router.post("/input", authMiddleware, async (req, res) => {
  try {
    const { button } = req.body || {};
    const result = await pokemonService.sendInput(button);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    const payload = {
      success: false,
      error:
        error.details || error.message || "Impossible d'envoyer l'input.",
    };

    if (error.acceptedButtons) {
      payload.acceptedButtons = error.acceptedButtons;
    }

    if (status >= 500) {
      console.error("Erreur lors de l'envoi d'un input Pokémon:", error);
    }

    res.status(status).json(payload);
  }
});

router.get("/frame-status", authMiddleware, async (req, res) => {
  try {
    const status = pokemonService.getFrameStatus();
    res.json(status);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      status: "error",
      error:
        error.details ||
        error.message ||
        "Impossible de récupérer le statut du flux Pokémon.",
    });
  }
});

router.get("/frame", authMiddleware, async (req, res) => {
  try {
    const frame = pokemonService.getFrameBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    if (frame.lastFrameAt) {
      res.setHeader("X-Frame-Timestamp", frame.lastFrameAt);
    }

    res.send(frame.buffer);
  } catch (error) {
    res.status(error.status || 503).json({
      success: false,
      status: "error",
      error:
        error.details ||
        error.message ||
        "Aucune frame Pokémon n'est disponible pour le moment.",
    });
  }
});

module.exports = router;
