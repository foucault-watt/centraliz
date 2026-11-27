const http = require('http');
const { app } = require('./src/config/app');
const { attachWebSocketServer } = require('./src/ws');
const pokemonSessions = require('./src/services/pokemonSessions');

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

async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] Signal ${signal} reçu, arrêt en cours...`);
    const httpClosed = new Promise((resolve) => server.close(resolve));
    server.closeIdleConnections();
    const closeTimer = setTimeout(() => {
        console.log('[Server] Fermeture des connexions encore ouvertes.');
        server.closeAllConnections();
    }, SHUTDOWN_GRACE_MS);
    const deadline = setTimeout(() => {
        console.error('[Server] Délai maximal d’arrêt atteint.');
        process.exit(exitCode);
    }, SHUTDOWN_GRACE_MS + 3000);

    try {
        const webSocketClosed = shutdownWebSocket();
        await httpClosed;
        // Les dernières écritures du flux sont déjà comptabilisées.
        await Promise.all([pokemonSessions.flush(), webSocketClosed]);
        console.log('[Server] Arrêt terminé.');
    } catch (error) {
        console.error('[Server] Erreur pendant l’arrêt:', error);
    } finally {
        clearTimeout(closeTimer);
        clearTimeout(deadline);
        process.exit(exitCode);
    }
}

app.locals.restart = (code) => shutdown('redémarrage demandé', code);

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
