// Dessin de l'écran du jeu dans un <canvas>, à partir de trois sortes
// d'images reçues :
//   frame : image entière ;
//   delta : rectangle modifié, à dessiner en (x, y) par-dessus l'image baseId ;
//   ref   : image déjà reçue, redessinée depuis le cache.
//
// Règle de la file :
//   - le décodage (createImageBitmap) démarre dès la réception, en parallèle ;
//   - l'application à l'écran se fait une à la fois, dans l'ordre d'arrivée
//     (FIFO) : un delta n'est jamais sauté et s'applique toujours sur l'image
//     qui le précède dans la file ;
//   - une image entière (frame), ou un ref vers une image déjà en cache, se
//     suffit à elle-même : elle remplace tout ce qui attend sans avoir
//     commencé (l'écran saute à la plus récente). Les images entières
//     écartées sont quand même gardées en cache pour de futurs ref ;
//   - un delta n'est accepté que si sa base est la dernière image de la file
//     (celle que l'écran aura une fois la file vidée), pas celle affichée ;
//     sinon, ou si une étape échoue, onBroken() demande de rouvrir le flux
//     (le serveur repart d'une image entière).
//
// Après un delta, l'image complète reconstituée est copiée en cache sous son
// identifiant, pour un ref ultérieur.

export const SCREEN_WIDTH = 240;
export const SCREEN_HEIGHT = 160;

const closeBitmap = (bitmap) => bitmap?.close?.();

// Image décodée prête à dessiner. Sans createImageBitmap (anciens
// navigateurs), une <img> décodée.
export async function decodeBlob(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    if (typeof img.decode === "function") await img.decode();
    else await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Copie de l'écran entier, telle qu'à l'instant de l'appel.
export function snapshotCanvas(canvas) {
  if (typeof createImageBitmap === "function") return createImageBitmap(canvas);
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d").drawImage(canvas, 0, 0);
  return copy;
}

export function createFramePainter({
  cache,
  getCanvas,
  decode = decodeBlob,
  snapshot = snapshotCanvas,
  onPaint = () => {},
  onBroken = () => {},
}) {
  let queue = [];
  let running = null; // élément en cours d'application
  let lastId = null; // image qu'aura l'écran une fois la file vidée
  let disposed = false;

  const startDecode = (blob) => {
    let promise;
    try {
      promise = Promise.resolve(decode(blob));
    } catch (error) {
      promise = Promise.reject(error);
    }
    promise.catch(() => {}); // l'erreur est traitée à l'application
    return promise;
  };

  const discard = (job) => {
    if (!job.bitmap) return;
    job.bitmap.then(
      (bitmap) => (job.kind === "frame" && !disposed ? cache.put(job.id, bitmap) : closeBitmap(bitmap)),
      () => {}
    );
  };

  // Écarte ce qui attend. L'élément en cours, s'il attend encore son
  // décodage, ne sera pas dessiné : une image plus récente le remplace.
  const dropPending = () => {
    queue.forEach(discard);
    queue = [];
    if (running) running.superseded = true;
  };

  const broken = () => {
    dropPending();
    lastId = null;
    if (!disposed) onBroken();
  };

  const draw = (bitmap, x, y) => {
    const context = getCanvas()?.getContext("2d");
    if (!context) return;
    context.drawImage(bitmap, x, y);
    onPaint();
  };

  const run = async (job) => {
    if (job.kind === "ref") {
      const bitmap = cache.get(job.id);
      if (bitmap) draw(bitmap, 0, 0);
      else broken();
      return;
    }

    let bitmap;
    try {
      bitmap = await job.bitmap;
    } catch {
      // Image illisible. En mode secours (sans identifiant), on attend la
      // suivante ; en flux, l'écran ne correspond plus à ce que croit le
      // serveur.
      if (job.id && !job.superseded) broken();
      return;
    }
    if (disposed || job.superseded) {
      discard(job);
      return;
    }

    if (job.kind === "frame") {
      draw(bitmap, 0, 0);
      cache.put(job.id, bitmap);
      return;
    }

    draw(bitmap, job.x, job.y);
    closeBitmap(bitmap);
    const canvas = getCanvas();
    if (!canvas) return;
    try {
      const full = await snapshot(canvas);
      if (disposed) closeBitmap(full);
      else cache.put(job.id, full);
    } catch {
      // Pas de copie : un ref vers cette image rouvrira le flux.
    }
  };

  const pump = async () => {
    if (running) return;
    while (queue.length && !disposed) {
      running = queue.shift();
      try {
        await run(running);
      } catch {
        broken();
      } finally {
        running = null;
      }
    }
  };

  const willHave = (id) => running?.id === id || queue.some((job) => job.id === id);

  return {
    // Image entière (id null en mode secours).
    frame(blob, id = null) {
      dropPending();
      queue.push({ kind: "frame", id, bitmap: startDecode(blob) });
      lastId = id;
      pump();
    },
    // Rectangle à dessiner par-dessus baseId. false si baseId n'est pas la
    // dernière image de la file : il faut alors rouvrir le flux.
    delta({ id, baseId, x, y, blob }) {
      if (!id || baseId == null || baseId !== lastId) return false;
      queue.push({ kind: "delta", id, x: Number(x) || 0, y: Number(y) || 0, bitmap: startDecode(blob) });
      lastId = id;
      pump();
      return true;
    },
    // Image déjà reçue. false si elle n'est ni en cache ni attendue dans la
    // file : il faut alors rouvrir le flux.
    ref(id) {
      const ready = Boolean(cache.get(id));
      if (!ready && !willHave(id)) return false;
      // Déjà en cache : se suffit à elle-même. Sinon (produite par un delta
      // encore en attente), elle doit passer après lui.
      if (ready) dropPending();
      queue.push({ kind: "ref", id });
      lastId = id;
      pump();
      return true;
    },
    // Nouvelle connexion : le serveur repart d'une image entière.
    reset() {
      dropPending();
      lastId = null;
    },
    dispose() {
      dropPending();
      lastId = null;
      disposed = true;
    },
    get lastId() {
      return lastId;
    },
  };
}
