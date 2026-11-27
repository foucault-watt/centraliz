const express = require("express");
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const pokemonService = require("../services/pokemonService");
const pokemonSpeedService = require("../services/pokemonSpeedService");
const pokemonPresence = require("../services/pokemonPresence");
const pokemonAnalytics = require("../services/pokemonAnalytics");
const pokemonSessions = require("../services/pokemonSessions");
const analyticsService = require("../services/analyticsService");
const { createSseSender, paddingComment } = require("../services/pokemonSse");

const router = express.Router();
const MAX_TRACKED_FRAME_AGE_MS = 15000;

// Une ligne par session de jeu et par appareil (voir pokemonSessions). Rien
// n'est enregistré en démo.
pokemonSessions.setRecorder(({ userUsername, properties }) => {
  if (pokemonService.isDemo) return;
  void analyticsService.trackEvent({
    userUsername,
    eventName: "pokemon_session",
    module: "pokemon",
    eventType: "system",
    isAutomatic: true,
    properties,
  });
});

router.get("/speed", authMiddleware, adminMiddleware, async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  try {
    res.json(await pokemonSpeedService.getSpeed());
  } catch (error) {
    next(error);
  }
});

router.put("/speed", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    res.json(await pokemonSpeedService.setSpeed(req.body?.speed));
  } catch (error) {
    if (!error.status) return next(error);
    res.status(error.status).json({ message: error.message });
  }
});

// Pour la liste des joueurs : qui, et depuis quel appareil (session).
const presenceContext = (req) => ({
  user: req.session && req.session.user,
  sessionId: req.sessionID,
  userAgent: req.get("user-agent"),
});

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
    pokemonPresence.notePlaying(presenceContext(req), result.button);
    pokemonSessions.noteInput(presenceContext(req), result.button);
    res.json(result);
    if (!pokemonService.isDemo) {
      pokemonAnalytics.trackActivity(req, "pokemon_play_started", "interaction");
    }
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
    const user = req.session && req.session.user;
    const viewer = user && (user.id || user.userName || user.username);
    const context = presenceContext(req);
    pokemonPresence.noteWatching(context);
    pokemonSessions.noteWatch(context, "polling");
    const frame = pokemonService.getFrameBuffer(req.query.fps, viewer);

    res.setHeader("Content-Type", `image/${frame.format}`);
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    // Le navigateur s'en sert pour distinguer images nouvelles et doublons,
    // et pour mesurer l'âge de l'image (calculé ici : pas de décalage
    // d'horloge entre serveur et navigateur).
    if (frame.lastFrameAt) {
      res.setHeader("X-Frame-Timestamp", frame.lastFrameAt);
    }
    if (frame.ageMs != null) {
      res.setHeader("X-Frame-Age-Ms", String(frame.ageMs));
    }
    // Empreinte de l'image : si le navigateur l'a déjà (If-None-Match),
    // 304 sans corps (environ une image sur deux en jeu). Comparaison
    // manuelle : le navigateur envoie aussi Cache-Control: no-cache, que la
    // détection automatique d'Express prend pour un refus du 304.
    const etag = frame.frameId ? `"${frame.frameId}"` : null;
    if (etag) res.setHeader("ETag", etag);
    res.setHeader("Access-Control-Expose-Headers", "ETag, X-Frame-Timestamp, X-Frame-Age-Ms");

    if (etag && req.get("if-none-match") === etag) {
      res.status(304).end();
    } else {
      res.send(frame.buffer);
      pokemonSessions.noteServerTraffic(context, { bytes: frame.buffer.length, frames: 1 });
    }
    if (!pokemonService.isDemo && frame.ageMs != null && frame.ageMs <= MAX_TRACKED_FRAME_AGE_MS) {
      pokemonAnalytics.trackActivity(req, "pokemon_stream_viewed", "exposure");
    }
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

// En-têtes d'un flux SSE. X-Accel-Buffering: no demande à nginx de ne pas
// retenir les données (sans changer sa configuration).
function openSse(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write("retry: 2000\n\n");
}

const HEARTBEAT_MS = 15000;
const PRESENCE_REFRESH_MS = 3000;

// Flux continu des images (Server-Sent Events) : le serveur envoie chaque
// image différente dès qu'elle est capturée, au plus `fps` fois par seconde.
// Remplace l'interrogation en boucle de /frame (gardée en secours).
function streamFrames(req, res, experimental = false) {
  if (res.destroyed) return;
  const user = req.session && req.session.user;
  const viewer = user && (user.id || user.userName || user.username);
  const fps = pokemonService.clampFps(req.query.fps, experimental) || 10;

  openSse(res);
  const sender = createSseSender(res, { fps });
  const unsubscribe = pokemonService.subscribe({ fps, viewer, onFrame: sender.offer, experimental });

  const context = presenceContext(req);
  pokemonPresence.noteWatching(context);
  pokemonSessions.streamOpened(context);
  pokemonSessions.noteWatch(context, "sse");
  const presenceTimer = setInterval(() => {
    pokemonPresence.noteWatching(context);
    pokemonSessions.noteWatch(context, "sse");
  }, PRESENCE_REFRESH_MS);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
  if (!pokemonService.isDemo) {
    pokemonAnalytics.trackActivity(req, "pokemon_stream_viewed", "exposure");
  }

  res.once("close", () => {
    clearInterval(presenceTimer);
    clearInterval(heartbeat);
    sender.close();
    unsubscribe();
    pokemonSessions.streamClosed(context, { bytes: sender.stats.bytes, frames: sender.stats.sent });
  });
}

router.get("/stream", authMiddleware, (req, res) => streamFrames(req, res));
router.get("/admin/stream", authMiddleware, adminMiddleware, (req, res) => streamFrames(req, res, true));

// Test public du flux, sans aucune donnée du jeu : 10 messages en 2,5 s puis
// fin. Sert à vérifier de l'extérieur que nginx et le proxy HTTPS laissent
// passer un flux au fil de l'eau (npm run pokemon:remote ou curl -N).
// ?pad=N ajoute N octets de bourrage après chaque message : permet de
// mesurer la taille qui force les proxys à ne pas garder le flux.
router.get("/stream-test", (req, res) => {
  openSse(res);
  const pad = Math.min(Math.max(parseInt(req.query.pad, 10) || 0, 0), 65536);
  let count = 0;
  const timer = setInterval(() => {
    count += 1;
    res.write(`event: tick\ndata: {"n":${count},"at":${Date.now()}}\n\n`);
    if (pad) res.write(paddingComment(pad));
    if (count >= 10) {
      clearInterval(timer);
      res.end();
    }
  }, 250);
  req.on("close", () => clearInterval(timer));
});

// Résumé des mesures du navigateur (aller-retour, retard, images et octets
// reçus) depuis le précédent : toutes les 60 s et à la fermeture de la page
// (navigator.sendBeacon, envoyé en text/plain pour éviter une requête
// préalable CORS). Ajouté à la session en mémoire, rien n'est écrit ici.
router.post(
  "/session-stats",
  express.text({ type: "text/plain", limit: "4kb" }),
  authMiddleware,
  (req, res) => {
    let summary = req.body;
    if (typeof summary === "string") {
      try {
        summary = JSON.parse(summary);
      } catch {
        summary = null;
      }
    }
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
      return res.status(400).json({ success: false });
    }
    pokemonSessions.noteClientSummary(presenceContext(req), summary);
    return res.status(204).end();
  }
);

// Qui regarde et qui joue en ce moment (visible par tous les connectés).
router.get("/presence", authMiddleware, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(pokemonPresence.getPresence());
});

module.exports = router;
