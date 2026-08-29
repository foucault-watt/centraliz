import { Palette, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchApi } from "../utils/api";
import { applyUserTheme } from "../utils/userTheme";

export const THEME_COLOR_CARD_DISMISS_STORAGE_KEY =
  "centraliz.themeColorCardDismissed";

const wasDismissedThisSession = () => {
  try {
    return (
      window.sessionStorage.getItem(THEME_COLOR_CARD_DISMISS_STORAGE_KEY) ===
      "true"
    );
  } catch (error) {
    return false;
  }
};

const AccentColorCard = ({ onSaved, forceVisible = false }) => {
  const [dismissed, setDismissed] = useState(
    forceVisible ? false : wasDismissedThisSession
  );
  const [entries, setEntries] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (dismissed) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetchApi("/api/theme-palette");
        const data = await response.json();
        if (!cancelled && data.success) {
          setEntries(data.entries || []);
        }
      } catch (fetchError) {
        console.error("Error loading theme palette:", fetchError);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(
        THEME_COLOR_CARD_DISMISS_STORAGE_KEY,
        "true"
      );
    } catch (error) {
      // Stockage indisponible (mode privé, etc.) : le dismiss reste local à ce montage.
    }
    setDismissed(true);
  };

  const handlePick = async (entry) => {
    setError("");
    setSavingId(entry.id);

    // Aperçu instantané, avant même la confirmation du serveur.
    applyUserTheme(entry.colorPrimary, entry.colorPrimaryDark);

    try {
      const response = await fetchApi("/api/user/theme-color", {
        method: "POST",
        body: JSON.stringify({
          themeColor: entry.colorPrimary,
          themeColorDark: entry.colorPrimaryDark,
        }),
      });

      if (!response.ok) {
        setError("Oups ! Une erreur s'est produite. Réessaie !");
        return;
      }

      await onSaved();
    } catch (fetchError) {
      console.error("Error saving theme color:", fetchError);
      setError("Oups ! Une erreur s'est produite. Réessaie !");
    } finally {
      setSavingId(null);
    }
  };

  if (dismissed || entries.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Palette size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Personnalisation
          </p>
          <h2 className="text-lg font-bold text-secondary mt-0.5">
            Choisis ta couleur
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Un petit coup de couleur pour que Centraliz soit vraiment le tien.
          </p>
        </div>
        {!forceVisible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
            aria-label="Fermer, je le ferai plus tard"
            title="Plus tard"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mt-3 max-h-64 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handlePick(entry)}
              disabled={savingId !== null}
              className="flex items-center gap-2 rounded-xl border border-gray-200 p-2 text-left hover:border-primary/40 disabled:opacity-60 transition-colors"
            >
              {entry.iconUrl ? (
                <img
                  src={`${process.env.REACT_APP_URL_BACK}${entry.iconUrl}`}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <span
                  className="h-7 w-7 rounded-full shrink-0"
                  style={{ backgroundColor: entry.colorPrimary }}
                />
              )}
              <span className="text-sm font-medium text-secondary truncate">
                {entry.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {!forceVisible && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="ui-button-secondary"
            onClick={handleDismiss}
          >
            Plus tard
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
};

export default AccentColorCard;
