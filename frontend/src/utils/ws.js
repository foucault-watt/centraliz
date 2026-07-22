/**
 * Client WebSocket générique et authentifié pour Centraliz.
 * Ne se connecte jamais tout seul : c'est à l'appelant (ex. une page de jeu)
 * d'appeler connect() au montage et disconnect() au démontage.
 */

const PROTOCOL_VERSION = 1;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

// Passe par /api pour suivre le même chemin que fetchApi (utils/api.js) :
// c'est ce préfixe que nginx route vers le backend Node en production.
const toWebSocketUrl = (httpUrl) => `${httpUrl.replace(/^http/, "ws")}/api`;

export function createWebSocketClient() {
  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let manuallyClosed = true;
  const messageListeners = new Set();

  const scheduleReconnect = () => {
    if (manuallyClosed) return;
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts,
      MAX_RECONNECT_DELAY_MS,
    );
    reconnectAttempts += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  const connect = () => {
    manuallyClosed = false;
    clearTimeout(reconnectTimer);

    ws = new WebSocket(toWebSocketUrl(process.env.REACT_APP_URL_BACK));

    ws.onopen = () => {
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        console.warn("[WS] Message reçu invalide (JSON), ignoré");
        return;
      }
      messageListeners.forEach((listener) => listener(message));
    };

    // Une déconnexion (volontaire ou non) passe toujours par onclose,
    // donc la reconnexion automatique n'est gérée qu'à cet endroit.
    ws.onclose = () => {
      scheduleReconnect();
    };
  };

  const disconnect = () => {
    manuallyClosed = true;
    clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null;
      ws.close(1000, "client_disconnect");
      ws = null;
    }
  };

  // Les messages saisis pendant une déconnexion sont perdus, jamais rejoués
  // au retour de la connexion.
  const send = (type, payload, requestId) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WS] Message "${type}" non envoyé : socket non connecté`);
      return;
    }
    ws.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type,
        requestId: requestId ?? null,
        payload: payload ?? null,
      }),
    );
  };

  const onMessage = (listener) => {
    messageListeners.add(listener);
    return () => messageListeners.delete(listener);
  };

  return { connect, disconnect, send, onMessage };
}
