const http = require('http');
const { app } = require('./src/config/app');
const { attachWebSocketServer } = require('./src/ws');

const PORT = 3001;
const server = http.createServer(app);
const { shutdown: shutdownWebSocket } = attachWebSocketServer(server);

server.listen(PORT, () => {
    console.log(`Serveur backend lancé sur localhost:${PORT} - Merci Rézoléo !`);
});

// Délai laissé aux requêtes en cours avant de couper les connexions qui
// restent. Les flux SSE (images Pokémon) ne se terminent jamais d'eux-mêmes :
// sans ça, server.close attendait jusqu'à ce que systemd tue le processus
// (90 s de coupure à chaque redémarrage). Les navigateurs se reconnectent
// seuls au flux (retry: 2000).
const SHUTDOWN_GRACE_MS = 2000;
let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] Signal ${signal} reçu, arrêt en cours...`);
    await shutdownWebSocket();
    server.close(() => {
        console.log('[Server] Arrêt terminé.');
        process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => {
        console.log('[Server] Fermeture des connexions encore ouvertes.');
        server.closeAllConnections();
    }, SHUTDOWN_GRACE_MS).unref();
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS + 3000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
