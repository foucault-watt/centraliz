const http = require('http');
const { app } = require('./src/config/app');
const { attachWebSocketServer } = require('./src/ws');

const PORT = 3001;
const server = http.createServer(app);
const { shutdown: shutdownWebSocket } = attachWebSocketServer(server);

server.listen(PORT, () => {
    console.log(`Serveur backend lancé sur localhost:${PORT} - Merci Rézoléo !`);
});

async function shutdown(signal) {
    console.log(`[Server] Signal ${signal} reçu, arrêt en cours...`);
    await shutdownWebSocket();
    server.close(() => {
        console.log('[Server] Arrêt terminé.');
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
