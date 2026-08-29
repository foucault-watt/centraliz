// Capture l'événement Android/Chrome beforeinstallprompt, qui ne se déclenche
// qu'une seule fois et est perdu s'il n'est pas intercepté tout de suite. On
// le stocke ici (hors React) pour pouvoir rejouer l'invite plus tard, à un
// moment choisi (juste après l'ajout de l'emploi du temps, ou depuis
// Réglages) plutôt qu'à l'arrivée sur le site.
let deferredPrompt = null;
let installed = false;
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => listener(getInstallPromptState()));
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  notify();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installed = true;
  notify();
});

export const getInstallPromptState = () => ({
  canInstall: Boolean(deferredPrompt) && !installed,
  installed,
});

export const subscribeToInstallPrompt = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Déclenche l'invite native. Résout avec le choix de l'utilisateur
// ("accepted" | "dismissed"), ou null si aucune invite n'est disponible
// (déjà installé, plateforme sans support, ou événement pas encore capté).
export const triggerInstallPrompt = async () => {
  if (!deferredPrompt) return null;

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome;
};
