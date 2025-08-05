const axios = require('axios');
const supabase = require('../utils/supabaseClient');

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
        const { data: user, error } = await supabase
            .from('users')
            .select('ical_link')
            .eq('username', userId)
            .single();

        if (error || !user || !user.ical_link) {
            throw new Error('Utilisateur non trouvé ou lien iCal manquant');
        }

        const response = await axios.get(user.ical_link);
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

async function fetchExternalCalendar(icalLink) {
    try {
        const response = await axios.get(icalLink);
        const data = response.data;
        
        if (typeof data === 'string' && 
            data.includes('BEGIN:VCALENDAR') && 
            data.includes('BEGIN:VEVENT')) {
            return data;
        } else {
            throw new Error('Les données reçues ne sont pas un iCal valide');
        }
    } catch (error) {
        console.error("Erreur lors de la récupération du calendrier externe:", error);
        throw error;
    }
}

async function checkUser(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('ical_link')
            .eq('username', userId)
            .single();

        if (error) {
            throw error;
        }
        return { exists: !!user?.ical_link };
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

        // Extrait la date de naissance (format: DD/MM/YYYY) et convertit en YYYY-MM-DD
        const birthDateMatch = calNameLine.match(/\d{2}\/\d{2}\/\d{4}/);
        const birthDate = birthDateMatch ? birthDateMatch[0].split('/').reverse().join('-') : null;

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

        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('username', userId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
            throw fetchError;
        }

        const userData = {
            username: userId,
            ical_link: icalLink,
            birth_date: userInfo?.birthDate,
            group: userInfo?.group
        };

        if (existingUser) {
            const { error: updateError } = await supabase
                .from('users')
                .update(userData)
                .eq('username', userId);
            if (updateError) {
                throw updateError;
            }
        } else {
            const { error: insertError } = await supabase
                .from('users')
                .insert(userData);
            if (insertError) {
                throw insertError;
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Erreur lors de l'enregistrement de l'utilisateur:", error);
        throw error;
    }
}

async function getAllUsers() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('username, display_name, group')
            .not('ical_link', 'is', null)
            .not('display_name', 'is', null);

        if (error) {
            throw error;
        }

        return users.map(user => ({
            userName: user.username,
            displayName: user.display_name,
            group: user.group
        }));
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs:", error);
        throw error;
    }
}

module.exports = {
    fetchHpData,
    checkUser,
    saveUser,
    validateIcal,
    getAllUsers,
    fetchExternalCalendar
};
