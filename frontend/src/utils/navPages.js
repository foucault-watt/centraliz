import { useEffect, useState } from "react";
import { defaultPageIds, pagesCatalog } from "../config/pages";
import { fetchApi } from "./api";

let cachedIds = null;
let inflight = null;

const toPages = (ids) =>
  ids.map((id) => pagesCatalog.find((p) => p.id === id)).filter(Boolean);

const fetchIds = () => {
  if (!inflight) {
    inflight = fetchApi("/api/nav-pages")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(data.error || "nav-pages");
        cachedIds = data.pages.map((p) => p.id);
        return cachedIds;
      })
      .catch((error) => {
        console.error("[NavPages] Erreur de chargement:", error);
        return defaultPageIds;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

export const invalidateNavPages = () => {
  cachedIds = null;
};

// Pages de la navbar pour l'utilisateur courant (null tant que non chargées).
export const useNavPages = () => {
  const [ids, setIds] = useState(cachedIds);

  useEffect(() => {
    let cancelled = false;
    fetchIds().then((result) => {
      if (!cancelled) setIds(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ids ? toPages(ids) : null;
};
