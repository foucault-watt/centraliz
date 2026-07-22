const { createApp } = require("./src/config/app");

const PORT = Number(process.env.PORT || 3001);

async function startServer() {
  try {
    const app = await createApp();
    app.listen(PORT, () => {
      console.log(`Serveur backend lancé sur localhost:${PORT} - Merci Rézoléo !`);
    });
  } catch (error) {
    console.error(`[Server] Startup failed: ${error.message}`);
    process.exit(1);
  }
}

startServer();