const axios = require("axios");

async function fetchClaIcalData() {
  const targetUrl =
    "https://centralelilleassos.fr/evenements/export/ical/?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJrZXkiOiJjbGFfZXZlbnQ6aW5kZXg6ZXZlbnQifQ.fwCKrMr6zu4JpPigmiNcLkKL1yDJxnqqSY7D3juUN9w";

  try {
    const response = await axios.get(targetUrl);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération du fichier iCal CLA:", error);
    throw error;
  }
}

async function fetchFablabIcalData() {
  const targetUrl =
    "https://framagenda.org/remote.php/dav/public-calendars/BmoNRjcAKcaST5DN/?export";

  try {
    const response = await axios.get(targetUrl);
    return response.data;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du fichier iCal FabLab:",
      error
    );
    throw error;
  }
}

async function fetchAllCalendarsData() {
  try {
    const [claData, fablabData] = await Promise.all([
      fetchClaIcalData(),
      fetchFablabIcalData(),
    ]);

    return {
      cla: claData,
      fablab: fablabData,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des calendriers:", error);
    throw error;
  }
}

// Pour maintenir la compatibilité avec le code existant
async function fetchIcalData() {
  return fetchClaIcalData();
}

module.exports = {
  fetchIcalData,
  fetchAllCalendarsData,
};
