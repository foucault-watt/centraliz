// Abonnés au flux d'images (SSE). Partagé par le vrai jeu et la démo :
// chaque nouvelle image différente est publiée une fois, et chaque abonné
// décide lui-même s'il peut l'envoyer (cadence, client lent).

function createFrameBus() {
  const subscribers = new Set(); // { fps, viewer, onFrame }
  // { id, buffer, capturedAt } ; le vrai jeu ajoute base64 et les pixels
  // bruts (raw, width, height, channels) pour le rectangle modifié du SSE.
  let latest = null;

  return {
    subscribe(subscriber, { sendLatest = true } = {}) {
      subscribers.add(subscriber);
      if (sendLatest && latest) subscriber.onFrame(latest);
      return () => subscribers.delete(subscriber);
    },
    publish(frame) {
      latest = frame;
      for (const subscriber of subscribers) {
        try {
          subscriber.onFrame(frame);
        } catch {
          // Un abonné en erreur ne doit pas bloquer les autres.
        }
      }
    },
    size: () => subscribers.size,
    fpsList: () => [...subscribers].map((s) => s.fps).filter(Boolean),
    viewers: () => [...subscribers].map((s) => s.viewer).filter(Boolean),
    latest: () => latest,
  };
}

module.exports = { createFrameBus };
