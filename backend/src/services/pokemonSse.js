// Envoi des images à un client SSE.
//
// - Jamais de file d'attente : on garde seulement la dernière image en
//   attente. Un client lent (mauvais réseau) saute des images au lieu
//   d'accumuler du retard et de faire gonfler la mémoire du serveur.
// - Cadence plafonnée à ce que le client a demandé (fps).
// - Si l'écriture est refusée (tampon plein), on attend l'événement
//   « drain » avant d'envoyer la suivante.

function frameEvent(frame, now = Date.now()) {
  if (!frame.base64) frame.base64 = frame.buffer.toString("base64");
  const data = JSON.stringify({ id: frame.id, ageMs: Math.max(0, now - frame.capturedAt), img: frame.base64 });
  return `id: ${frame.id}\nevent: frame\ndata: ${data}\n\n`;
}

function createSseSender(res, { fps = 10, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const minIntervalMs = 1000 / Math.max(fps, 1);
  let pending = null;
  let lastSentAt = -Infinity; // la première image part tout de suite
  let lastSentId = null;
  let congested = false;
  let timer = null;
  let closed = false;
  const stats = { sent: 0, skipped: 0 };

  const flush = () => {
    if (closed || !pending || congested || timer) return;
    const wait = minIntervalMs - (now() - lastSentAt);
    if (wait > 0) {
      timer = setTimer(() => {
        timer = null;
        flush();
      }, wait);
      return;
    }
    const frame = pending;
    pending = null;
    if (frame.id === lastSentId) return;
    lastSentAt = now();
    lastSentId = frame.id;
    stats.sent += 1;
    const accepted = res.write(frameEvent(frame, now()));
    if (accepted === false) {
      congested = true;
      res.once("drain", () => {
        congested = false;
        flush();
      });
    }
  };

  return {
    offer(frame) {
      if (closed) return;
      if (pending) stats.skipped += 1; // remplacée avant d'avoir pu partir
      pending = frame;
      flush();
    },
    close() {
      closed = true;
      if (timer) clearTimer(timer);
    },
    stats,
  };
}

module.exports = { createSseSender, frameEvent };
