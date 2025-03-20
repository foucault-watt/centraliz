const axios = require("axios");

async function fetchClaIcalData() {
  const targetUrl =
    "https://centralelilleassos.fr/evenements/export/ical/?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJrZXkiOiJjbGFfZXZlbnQ6aW5kZXg6ZXZlbnQ6djIifQ.CQ0j6tLB-ap1St00MS7HYvZV47idY5ZX_L79LPSnDPk";

  try {
    const response = await axios.get(targetUrl, { timeout: 8000 });
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du calendrier CLA:",
      error.message || "Erreur inconnue"
    );
    return {
      success: false,
      error: "Impossible de récupérer le calendrier CLA",
    };
  }
}

async function fetchFablabIcalData() {
  const targetUrl =
    "https://framagenda.org/remote.php/dav/pubjlic-calendars/BmoNRjcAKcaST5DN/?export";

  try {
    const response = await axios.get(targetUrl, { timeout: 1000 });
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du calendrier FabLab:",
      error.message || "Erreur inconnue"
    );
    return {
      success: false,
      error: "C'est normal, mais le calendrier du FabLab sera accessible dès le retour des vacances 🏖️",
    };
  }
}

async function fetchAllCalendarsData() {
  // Utilisation de Promise.allSettled pour ne pas échouer si une seule promesse échoue
  const results = await Promise.allSettled([
    fetchClaIcalData(),
    fetchFablabIcalData(),
  ]);

  // Traitement des résultats
  const claResult =
    results[0].status === "fulfilled"
      ? results[0].value
      : { success: false, error: "Impossible d'accéder au calendrier CLA" };
  const fablabResult =
    results[1].status === "fulfilled"
      ? results[1].value
      : { success: false, error: "Impossible d'accéder au calendrier FabLab" };

  return {
    cla: claResult,
    fablab: fablabResult,
  };
}

// Pour maintenir la compatibilité avec le code existant
async function fetchIcalData() {
  const result = await fetchClaIcalData();
  return result.success ? result.data : null;
}

module.exports = {
  fetchIcalData,
  fetchAllCalendarsData,
};
