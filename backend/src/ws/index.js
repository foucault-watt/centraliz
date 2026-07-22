// backend/src/ws/index.js
const { EventEmitter } = require("events");
const { WebSocketServer } = require("ws");
const { sessionMiddleware } = require("../config/app");

const PROTOCOL_VERSION = 1;
const MAX_MESSAGE_BYTES = 64 * 1024;
const HEARTBEAT_INTERVAL_MS = 30_000;
const SHUTDOWN_CLOSE_CODE = 1001; // "going away"

const handlers = new Map();

/**
 * Enregistre un handler pour un type de message ("namespace.action").
 * Les futurs consommateurs (Pokémon, chat, ...) branchent leurs propres
 * types ici sans modifier ce module.
 */
function registerHandler(type, handler) {
  handlers.set(type, handler);
}

function isAllowedOrigin(origin) {
  const allowed = process.env.URL_FRONT;
  return Boolean(allowed) && origin === allowed;
}

// express-session a besoin d'un objet "res" pour se brancher (setHeader,
// end, ...), même si on n'écrit jamais de vraie réponse HTTP ici : on ne
// s'en sert que pour déclencher la lecture synchrone du cookie de session.
function createFakeResponse() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.getHeader = () => undefined;
  res.setHeader = () => {};
  res.removeHeader = () => {};
  res.writeHead = () => res;
  res.end = () => res.emit("finish");
  return res;
}

function rejectUpgrade(socket, status, reason) {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\n\r\n`);
  socket.destroy();
}

function handleUpgrade(req, socket, head, wss) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    console.warn(`[WS] Upgrade refusé, origine non autorisée: ${origin}`);
    rejectUpgrade(socket, 403, "Forbidden");
    return;
  }

  sessionMiddleware(req, createFakeResponse(), () => {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser) {
      console.warn(
        `[WS] Upgrade refusé, session non authentifiée (IP: ${req.socket.remoteAddress})`,
      );
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
}

function sendEnvelope(ws, type, payload, requestId) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(
    JSON.stringify({
      v: PROTOCOL_VERSION,
      type,
      requestId: requestId ?? null,
      payload: payload ?? null,
    }),
  );
}

function handleMessage(ws, raw) {
  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    sendEnvelope(ws, "error", {
      code: "invalid_json",
      message: "Message JSON invalide",
    });
    return;
  }

  const { v, type, requestId, payload } = message || {};

  if (requestId !== undefined && requestId !== null && typeof requestId !== "string") {
    sendEnvelope(ws, "error", {
      code: "invalid_request_id",
      message: "requestId doit être une chaîne",
    });
    return;
  }

  if (v !== PROTOCOL_VERSION) {
    sendEnvelope(
      ws,
      "error",
      { code: "unsupported_version", message: `Version non supportée: ${v}` },
      requestId,
    );
    return;
  }

  if (typeof type !== "string" || !type.includes(".")) {
    sendEnvelope(
      ws,
      "error",
      { code: "invalid_type", message: "Le champ type doit être 'namespace.action'" },
      requestId,
    );
    return;
  }

  const handler = handlers.get(type);
  if (!handler) {
    sendEnvelope(ws, "error", { code: "unknown_type", message: `Type inconnu: ${type}` }, requestId);
    return;
  }

  handler(ws, payload, requestId);
}

function setupConnection(ws, req) {
  ws.isAlive = true;
  ws.userName = req.session.user.userName;

  console.log(`[WS] Connexion ouverte (user=${ws.userName})`);

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => handleMessage(ws, data));

  ws.on("close", (code) => {
    console.log(`[WS] Connexion fermée (user=${ws.userName}, code=${code})`);
  });

  ws.on("error", (err) => {
    console.error(`[WS] Erreur socket (user=${ws.userName}): ${err.message}`);
  });
}

function startHeartbeat(wss) {
  return setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.warn(`[WS] Heartbeat manqué, fermeture de la connexion (user=${ws.userName})`);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function shutdown(wss, heartbeatInterval) {
  clearInterval(heartbeatInterval);
  return new Promise((resolve) => {
    wss.clients.forEach((ws) => {
      ws.close(SHUTDOWN_CLOSE_CODE, "server_shutdown");
    });
    wss.close(resolve);
  });
}

/**
 * Attache un canal WebSocket générique et authentifié au serveur HTTP donné.
 * Retourne { wss, shutdown } pour permettre un arrêt propre (SIGTERM/SIGINT).
 */
function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  httpServer.on("upgrade", (req, socket, head) => {
    handleUpgrade(req, socket, head, wss);
  });

  wss.on("connection", setupConnection);

  const heartbeatInterval = startHeartbeat(wss);

  return {
    wss,
    shutdown: () => shutdown(wss, heartbeatInterval),
  };
}

module.exports = { attachWebSocketServer, registerHandler };
