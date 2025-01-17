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
        const user = users[userId];
        
        if (!user || !user.icalLink) {
            throw new Error('Utilisateur non trouvé ou lien iCal manquant');
        }

        const response = await axios.get(user.icalLink);
        const data = response.data;
        
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
        return { exists: users[userId] && !!users[userId].icalLink };
    } catch (error) {
        console.error("Erreur lors de la vérification de l'utilisateur:", error);
        throw error;
    }
}

function extractUserInfoFromIcal(icalData) {
    try {
        // Recherche la ligne X-WR-CALNAME qui contient les informations
        const calNameLine = icalData.split('\n').find(line => line.startsWith('X-WR-CALNAME'));
        if (!calNameLine) return null;

        // Extrait la date de naissance (format: DD/MM/YYYY)
        const birthDateMatch = calNameLine.match(/\d{2}\/\d{2}\/\d{4}/);
        const birthDate = birthDateMatch ? birthDateMatch[0] : null;

        // Extrait le groupe principal (premier groupe entre parenthèses)
        const groupMatch = calNameLine.match(/\((.*?)(?:\s*-|,)/);
        const group = groupMatch ? groupMatch[1].trim() : null;

        return {
            birthDate,
            group
        };
    } catch (error) {
        console.error("Erreur lors de l'extraction des informations:", error);
        return null;
    }
}

async function saveUser(userId, icalLink) {
    try {
        // Vérifie d'abord si le lien est valide
        const validation = await validateIcal(icalLink);
        if (!validation.isValid) {
            throw new Error('Lien iCal invalide');
        }

        // Récupère le contenu du fichier iCal pour extraire les informations
        const response = await axios.get(icalLink);
        const icalData = response.data;
        const userInfo = extractUserInfoFromIcal(icalData);

        const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
        if (!users[userId]) {
            users[userId] = {
                userName: userId,
                displayName: null,
                icalLink: null,
                birthDate: null,
                group: null
            };
        }
        
        users[userId].icalLink = icalLink;
        if (userInfo) {
            users[userId].birthDate = userInfo.birthDate;
            users[userId].group = userInfo.group;
        }

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