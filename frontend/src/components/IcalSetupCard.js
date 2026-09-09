import { CalendarPlus, ExternalLink, Maximize2 } from "lucide-react";
import { useRef, useState } from "react";
import { fetchApi } from "../utils/api";

const TUTORIAL_VIDEO_SRC = "/tutoriel-lien-ical-mobile.mp4";

const IcalSetupCard = ({ userName, onSaved }) => {
  const [icalLink, setIcalLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {
        window.open(TUTORIAL_VIDEO_SRC, "_blank", "noopener,noreferrer");
      });
    } else if (video.webkitEnterFullscreen) {
      // Safari iOS n'implémente pas la Fullscreen API standard sur <video>.
      video.webkitEnterFullscreen();
    } else {
      window.open(TUTORIAL_VIDEO_SRC, "_blank", "noopener,noreferrer");
    }
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

      <div className="relative mt-3 rounded-xl overflow-hidden border border-gray-200 bg-black">
        <video
          ref={videoRef}
          src={TUTORIAL_VIDEO_SRC}
          className="w-full max-h-64 object-contain bg-black"
          controls
          playsInline
          preload="metadata"
        />
        <button
          type="button"
          onClick={handleFullscreen}
          className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-black/60 text-white p-1.5 hover:bg-black/80 transition-colors"
          aria-label="Voir la vidéo en plein écran"
          title="Plein écran"
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Comment récupérer ton lien, en vidéo (marche sur mobile).
      </p>

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
        <button
          type="submit"
          className="ui-button-primary shrink-0"
          disabled={submitting}
        >
          {submitting ? "Validation..." : "Valider"}
        </button>
      </form>
      {linkError && <p className="text-sm text-danger mt-2">{linkError}</p>}
    </div>
  );
};

export default IcalSetupCard;
