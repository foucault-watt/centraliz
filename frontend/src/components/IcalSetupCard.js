import { CalendarPlus, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { fetchApi } from "../utils/api";

export const ICAL_CARD_DISMISS_STORAGE_KEY = "centraliz.edtCardDismissed";

const wasDismissedThisSession = () => {
  try {
    return window.sessionStorage.getItem(ICAL_CARD_DISMISS_STORAGE_KEY) === "true";
  } catch (error) {
    return false;
  }
};

const IcalSetupCard = ({ userName, onSaved }) => {
  const [dismissed, setDismissed] = useState(wasDismissedThisSession);
  const [icalLink, setIcalLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(ICAL_CARD_DISMISS_STORAGE_KEY, "true");
    } catch (error) {
      // Stockage indisponible (mode privé, etc.) : le dismiss reste local à ce montage.
    }
    setDismissed(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLinkError("");
    setSubmitting(true);

    try {
      const validationResponse = await fetchApi("/api/validate-ical", {
        method: "POST",
        body: JSON.stringify({ icalLink }),
      });
      const validationData = await validationResponse.json();

      if (!validationData.isValid) {
        setLinkError(
          "Ce lien ne semble pas valide. Vérifie que tu l'as bien copié !"
        );
        return;
      }

      const saveResponse = await fetchApi("/api/save-user", {
        method: "POST",
        body: JSON.stringify({ userId: userName, icalLink }),
      });

      if (!saveResponse.ok) {
        setLinkError("Oups ! Une erreur s'est produite. Réessaie !");
        return;
      }

      await onSaved();
    } catch (error) {
      console.error("Error saving ical link:", error);
      setLinkError("Oups ! Une erreur s'est produite. Réessaie !");
    } finally {
      setSubmitting(false);
    }
  };

  if (dismissed) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <CalendarPlus size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Emploi du temps
          </p>
          <h2 className="text-lg font-bold text-secondary mt-0.5">
            Ajoute ton lien iCal
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Colle ton lien iCal Hyperplanning pour afficher ton planning ici.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
          aria-label="Fermer, je le ferai plus tard"
          title="Plus tard"
        >
          <X size={16} />
        </button>
      </div>

      <a
        href="https://planning.centralelille.fr"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark"
      >
        Ouvrir Hyperplanning
        <ExternalLink size={14} />
      </a>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          className="ui-input flex-1"
          value={icalLink}
          onChange={(e) => setIcalLink(e.target.value)}
          placeholder="https://planning.centralelille.fr/..."
          aria-label="Lien iCal"
          required
        />
        <div className="flex gap-2 shrink-0">
          <button type="submit" className="ui-button-primary" disabled={submitting}>
            {submitting ? "Validation..." : "Valider"}
          </button>
          <button type="button" className="ui-button-secondary" onClick={handleDismiss}>
            Plus tard
          </button>
        </div>
      </form>
      {linkError && <p className="text-sm text-danger mt-2">{linkError}</p>}
    </div>
  );
};

export default IcalSetupCard;
