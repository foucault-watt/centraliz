import { useEffect } from "react";
import { fetchApi } from "../../utils/api";

// Mesures réseau du navigateur pendant une session de jeu, résumées et
// envoyées au serveur toutes les 60 s et à la fermeture de la page. Le
// serveur les additionne à la session en mémoire et n'écrit qu'une ligne à
// la fin de la session : rien par image ni par bouton.
//
// Aller-retour (bouton → réponse, et image en mode secours) gardé en
// histogramme, mêmes cases que le serveur (pokemonSessions.js).

export const LATENCY_BUCKETS = [50, 100, 150, 200, 300, 500, 750, 1000, 2000, Infinity];
export const REPORT_EVERY_MS = 60000;
const ENDPOINT = "/api/pokemon/session-stats";

const emptySummary = () => ({
  frames: 0,
  bytes: 0,
  rttHist: LATENCY_BUCKETS.map(() => 0),
  rttSum: 0,
  delaySum: 0,
  delayCount: 0,
});

let current = emptySummary();
let smoothedRtt = null;

export function recordRtt(ms) {
  if (!Number.isFinite(ms) || ms < 0) return;
  const index = LATENCY_BUCKETS.findIndex((limit) => ms <= limit);
  current.rttHist[index] += 1;
  current.rttSum += Math.round(ms);
  smoothedRtt = smoothedRtt == null ? ms : smoothedRtt * 0.8 + ms * 0.2;
}

// Image affichée : octets reçus et âge de l'image au départ du serveur. Le
// retard ajoute le trajet retour (moitié de l'aller-retour), mesuré ou, en
// flux, estimé d'après les derniers allers-retours.
export function recordFrame({ bytes = 0, ageMs = null, rttMs = null } = {}) {
  current.frames += 1;
  current.bytes += bytes > 0 ? bytes : 0;
  if (ageMs != null && Number.isFinite(ageMs)) {
    const trip = rttMs ?? smoothedRtt;
    current.delaySum += Math.round(ageMs + (trip != null ? trip / 2 : 0));
    current.delayCount += 1;
  }
}

const isEmpty = (summary) =>
  !summary.frames && !summary.delayCount && !summary.rttHist.some(Boolean);

// Rend le résumé depuis le précédent et repart de zéro (null si vide).
export function takeSummary() {
  const summary = current;
  current = emptySummary();
  return isEmpty(summary) ? null : summary;
}

export function resetSessionStatsForTests() {
  current = emptySummary();
  smoothedRtt = null;
}

export function sendSummary({ beacon = false } = {}) {
  const summary = takeSummary();
  if (!summary) return false;
  const body = JSON.stringify(summary);
  // text/plain : pas de requête préalable CORS, que sendBeacon ne sait pas faire.
  if (beacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const base = process.env.REACT_APP_URL_BACK || "";
    const sent = navigator.sendBeacon(`${base}${ENDPOINT}`, new Blob([body], { type: "text/plain" }));
    if (sent) return true;
  }
  Promise.resolve()
    .then(() =>
      fetchApi(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body,
        keepalive: true,
      })
    )
    .catch(() => {});
  return true;
}

// Envoi périodique et à la fermeture de la page (ou en quittant la page Pokémon).
export function useSessionStatsReporter() {
  useEffect(() => {
    const timer = setInterval(() => sendSummary(), REPORT_EVERY_MS);
    const onPageHide = () => sendSummary({ beacon: true });
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", onPageHide);
      sendSummary({ beacon: true });
    };
  }, []);
}
