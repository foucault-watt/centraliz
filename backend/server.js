const app = require('./src/config/app');

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Serveur backend lancé sur localhost:${PORT} - Merci Rézoléo !`);
});