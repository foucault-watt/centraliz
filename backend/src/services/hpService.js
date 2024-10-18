const axios = require('axios');
const fs = require('fs');
const path = require('path');

const USER_DATA_FILE = path.join(__dirname, '../data/users.json');

// Ensure the data directory exists
if (!fs.existsSync(path.dirname(USER_DATA_FILE))) {
    fs.mkdirSync(path.dirname(USER_DATA_FILE), { recursive: true });
}

// Initialize users.json if it doesn't exist
if (!fs.existsSync(USER_DATA_FILE)) {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify({}));
}

async function validateIcal(icalLink) {
    try {
        const response = await axios.get(icalLink);
        const data = response.data;

        // Vérifie si les données ressemblent à un iCal
        // Un fichier iCal valide commence toujours par BEGIN:VCALENDAR
        // et contient au moins un événement (BEGIN:VEVENT)
        return {
            isValid: typeof data === 'string' &&
                    data.includes('BEGIN:VCALENDAR') &&
                    data.includes('BEGIN:VEVENT')
        };
    } catch (error) {
        return { isValid: false };
    }
}

async function fetchHpData(userId) {
    try {
        const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
        const userIcalLink = users[userId];
        
        if (!userIcalLink) {
            throw new Error('Utilisateur non trouvé');
        }

        const response = await axios.get(userIcalLink);
        const data = response.data;
        
        // Vérifie si les données ressemblent à un iCal
        if (typeof data === 'string' && 
            data.includes('BEGIN:VCALENDAR') && 
            data.includes('BEGIN:VEVENT')) {
            return data;
        } else {
            throw new Error('Les données reçues ne sont pas un iCal valide');
        }
    } catch (error) {
        console.error("Erreur lors de la récupération du fichier hp :", error);
        throw error;
    }
}

function checkUser(userId) {
    try {
        const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
        return { exists: !!users[userId] };
    } catch (error) {
        console.error("Erreur lors de la vérification de l'utilisateur:", error);
        throw error;
    }
}

async function saveUser(userId, icalLink) {
    try {
        // Vérifie d'abord si le lien est valide
        const validation = await validateIcal(icalLink);
        if (!validation.isValid) {
            throw new Error('Lien iCal invalide');
        }

        const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
        users[userId] = icalLink;
        fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
        return { success: true };
    } catch (error) {
        console.error("Erreur lors de l'enregistrement de l'utilisateur:", error);
        throw error;
    }
}

module.exports = {
    fetchHpData,
    checkUser,
    saveUser,
    validateIcal
};