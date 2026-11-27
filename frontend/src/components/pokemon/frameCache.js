// Images du jeu déjà reçues, par identifiant (empreinte côté serveur).
//
// Le serveur retient les 32 dernières images envoyées à chaque connexion et,
// pour une image déjà vue (animation en boucle), n'envoie que son
// identifiant. Le navigateur doit donc en garder au moins autant : on en
// garde le double.
export const FRAME_CACHE_LIMIT = 64;

export function createFrameCache({
  limit = FRAME_CACHE_LIMIT,
  createUrl = (blob) => URL.createObjectURL(blob),
  revokeUrl = (url) => URL.revokeObjectURL(url),
} = {}) {
  const urls = new Map(); // id -> url, du plus ancien au plus récent
  let current = ""; // url affichée, jamais libérée tant qu'elle l'est

  const release = (url) => {
    if (url && url !== current) revokeUrl(url);
  };

  return {
    // Image reçue entière : la met en cache (si elle a un identifiant) et
    // renvoie son url à afficher.
    put(blob, id) {
      const url = createUrl(blob);
      const previous = current;
      current = url;
      const dropped = new Set([previous]);
      if (id) {
        dropped.add(urls.get(id));
        urls.delete(id);
        urls.set(id, url);
        if (urls.size > limit) {
          const [oldestId, oldestUrl] = urls.entries().next().value;
          urls.delete(oldestId);
          dropped.add(oldestUrl);
        }
      }
      const kept = new Set(urls.values());
      for (const old of dropped) if (!kept.has(old)) release(old);
      return url;
    },
    // Image déjà reçue : renvoie son url, ou "" si elle n'est plus en cache.
    get(id) {
      const url = urls.get(id);
      if (!url) return "";
      urls.delete(id);
      urls.set(id, url);
      const previous = current;
      current = url;
      if (!new Set(urls.values()).has(previous)) release(previous);
      return url;
    },
    clear() {
      for (const url of urls.values()) revokeUrl(url);
      if (current && ![...urls.values()].includes(current)) revokeUrl(current);
      urls.clear();
      current = "";
    },
    size: () => urls.size,
  };
}
