import { Image as ImageIcon, School } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const SCHOOL_OPTIONS = ["ITEEM", "Centrale", "Chimie"];
const TYPE_OPTIONS = [
  "Soiree",
  "Conference",
  "Atelier",
  "Sport",
  "Culture",
  "Autre",
];

const initialForm = {
  title: "",
  description: "",
  event_date: "",
  event_time: "",
  location: "",
  event_type: TYPE_OPTIONS[0],
  ecoles: [],
  photo: null,
};

const EventCreatePage = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(""), 3500);
    return () => clearTimeout(t);
  }, [feedback]);

  if (!user?.has_association_role) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold">Accès refusé</h2>
        <p className="mt-2 text-sm text-gray-600">
          La création d'événements est réservée aux membres d'association.
        </p>
      </div>
    );
  }

  const toggleSchool = (school) => {
    setFormData((prev) => {
      const exists = prev.ecoles.includes(school);
      return {
        ...prev,
        ecoles: exists
          ? prev.ecoles.filter((e) => e !== school)
          : [...prev.ecoles, school],
      };
    });
  };

  const submitEvent = async (e) => {
    e.preventDefault();
    if (
      !formData.title ||
      !formData.event_date ||
      !formData.description ||
      !formData.location ||
      !formData.event_type
    ) {
      setFeedback("Merci de remplir tous les champs requis.");
      return;
    }
    if (formData.ecoles.length === 0) {
      setFeedback("Sélectionne au moins une école.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("description", formData.description);
      payload.append("event_date", formData.event_date);
      payload.append("event_time", formData.event_time);
      payload.append("location", formData.location);
      payload.append("event_type", formData.event_type);
      payload.append("ecoles", JSON.stringify(formData.ecoles));
      if (formData.photo) payload.append("photo", formData.photo);

      const resp = await fetch(`${process.env.REACT_APP_URL_BACK}/api/events`, {
        method: "POST",
        credentials: "include",
        body: payload,
      });
      const data = await resp.json();
      if (!data.success) {
        setFeedback(data.error || "Création impossible.");
        return;
      }
      // redirect back to calendars after creation
      navigate("/calendars", { replace: true });
    } catch (err) {
      console.error(err);
      setFeedback("Erreur réseau lors de la création.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
      <h2 className="text-2xl font-bold text-secondary mb-3">
        Créer un événement
      </h2>
      {feedback && (
        <div className="bg-primary/10 border border-primary/20 text-primary rounded-lg px-4 py-3 mb-4">
          {feedback}
        </div>
      )}

      <form onSubmit={submitEvent} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-semibold text-secondary">Titre</span>
            <input
              type="text"
              value={formData.title}
              onChange={(ev) =>
                setFormData((p) => ({ ...p, title: ev.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-secondary">Type</span>
            <select
              value={formData.event_type}
              onChange={(ev) =>
                setFormData((p) => ({ ...p, event_type: ev.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-secondary">Date</span>
            <input
              type="date"
              value={formData.event_date}
              onChange={(ev) =>
                setFormData((p) => ({ ...p, event_date: ev.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-secondary">
              Heure (optionnelle)
            </span>
            <input
              type="time"
              value={formData.event_time}
              onChange={(ev) =>
                setFormData((p) => ({ ...p, event_time: ev.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-secondary">Lieu</span>
            <input
              type="text"
              value={formData.location}
              onChange={(ev) =>
                setFormData((p) => ({ ...p, location: ev.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-secondary">
              Description
            </span>
            <textarea
              value={formData.description}
              onChange={(ev) =>
                setFormData((p) => ({ ...p, description: ev.target.value }))
              }
              rows={5}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-semibold text-secondary mb-2 flex items-center gap-1">
            <School size={15} className="text-primary" /> Écoles concernées
          </p>
          <div className="flex flex-wrap gap-2">
            {SCHOOL_OPTIONS.map((school) => {
              const selected = formData.ecoles.includes(school);
              return (
                <button
                  key={school}
                  type="button"
                  onClick={() => toggleSchool(school)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    selected
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {school}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-secondary flex items-center gap-1">
            <ImageIcon size={15} className="text-primary" /> Photo (optionnelle)
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(ev) =>
              setFormData((p) => ({
                ...p,
                photo:
                  ev.target.files && ev.target.files[0]
                    ? ev.target.files[0]
                    : null,
              }))
            }
            className="mt-2 block w-full text-sm text-gray-600"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate("/calendars")}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-primary text-white"
          >
            {isSubmitting ? "Publication..." : "Publier l'event"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventCreatePage;
