// Images complètes du jeu déjà affichées, par identifiant (empreinte côté
// serveur), sous forme d'ImageBitmap prêtes à dessiner.
//
// Le serveur retient les 32 dernières images envoyées à chaque connexion et,
// pour une image déjà vue (animation en boucle), n'envoie que son
// identifiant. Le navigateur doit donc en garder au moins autant : on en
// garde le double. Une image reçue en delta (rectangle) est stockée une fois
// reconstituée en entier.
//
// L'écran est un <canvas> : une image dessinée y reste après sa sortie du
// cache, on peut donc libérer (close) sans se soucier de l'image affichée.
export const FRAME_CACHE_LIMIT = 64;

const closeBitmap = (bitmap) => bitmap?.close?.();

export function createFrameCache({ limit = FRAME_CACHE_LIMIT, release = closeBitmap } = {}) {
  const bitmaps = new Map(); // id -> bitmap, du plus ancien au plus récent

  return {
    // Garde l'image complète sous son identifiant. Sans identifiant (mode
    // secours), elle n'est pas gardée : elle est libérée tout de suite.
    put(id, bitmap) {
      if (!id) {
        release(bitmap);
        return;
      }
      const previous = bitmaps.get(id);
      bitmaps.delete(id);
      bitmaps.set(id, bitmap);
      if (previous && previous !== bitmap) release(previous);
      while (bitmaps.size > limit) {
        const [oldestId, oldest] = bitmaps.entries().next().value;
        bitmaps.delete(oldestId);
        release(oldest);
      }
    },
    // Image déjà reçue (la remet en tête), ou null si elle n'est plus en cache.
    get(id) {
      const bitmap = bitmaps.get(id);
      if (!bitmap) return null;
      bitmaps.delete(id);
      bitmaps.set(id, bitmap);
      return bitmap;
    },
    clear() {
      for (const bitmap of bitmaps.values()) release(bitmap);
      bitmaps.clear();
    },
    size: () => bitmaps.size,
  };
}
