const axios = require('axios');

async function fetchIcalData() {
    const targetUrl = "https://centralelilleassos.fr/evenements/export/ical/?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJrZXkiOiJjbGFfZXZlbnQ6aW5kZXg6ZXZlbnQifQ.fwCKrMr6zu4JpPigmiNcLkKL1yDJxnqqSY7D3juUN9w";
    
    try {
        const response = await axios.get(targetUrl);
        return response.data;
    } catch (error) {
        console.error("Erreur lors de la récupération du fichier iCal :", error);
        throw error;
    }
}

module.exports = {
    fetchIcalData
};