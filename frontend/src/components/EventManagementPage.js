import {
  CalendarDays,
  Edit3,
  Image as ImageIcon,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchApi } from "../utils/api";
import ZoomableImage from "./ZoomableImage";

const TYPE_OPTIONS = [
  "Soirée",
  "Bar",
  "BBQ",
  "JT",
  "Dej",
  "Petit dej",
  "Sport",
  "Art",
  "Formation",
  "Autre",
];
const EMOJI_OPTIONS = [
  "🎉",
  "🥳",
  "🍕",
  "🍻",
  "🎶",
  "🎤",
  "🛠️",
  "🏆",
  "🎓",
  "💃",
  "✨",
  "🔥",
];

const TYPE_EMOJI_MAP = {
  Soirée: "🎉",
  Bar: "🍻",
  BBQ: "🍖",
  JT: "📣",
  Dej: "🍽️",
  "Petit dej": "🥐",
  Sport: "🏅",
  Art: "🎨",
  Formation: "📚",
  Autre: "✨",
};

const getDefaultEventEmoji = (eventType) => TYPE_EMOJI_MAP[eventType] || "✨";

const normalizeTimeValue = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const match = /^(\d{2}:\d{2})/.exec(text);
  if (match) return match[1];

  return text.slice(0, 5);
};

const emptyForm = (association = null) => ({
  title: "",
  short_title: "",
  event_emoji: getDefaultEventEmoji(TYPE_OPTIONS[0]),
  event_link: "",
  description: "",
  event_date: "",
  event_time: "",
  location: "",
  event_type: TYPE_OPTIONS[0],
  photo: null,
  association_slug: association?.association_slug || "",
  association_name: association?.association_name || "",
});

const formatEventDate = (eventDate, eventTime) => {
  if (!eventDate) return "Date inconnue";
  const dateObj = new Date(
    `${eventDate}${eventTime ? `T${eventTime}:00` : "T00:00:00"}`,
  );
  if (Number.isNaN(dateObj.getTime())) return eventDate;
  const datePart = dateObj.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return eventTime ? `${datePart} - ${eventTime}` : datePart;
};

const EventManagementPage = ({
  user,
  mode,
  association = null,
  associationOptions = [],
  title,
  subtitle,
}) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [formData, setFormData] = useState(() => emptyForm(association));
  const [selectedAssociationSlug, setSelectedAssociationSlug] = useState(
    association?.association_slug ||
      associationOptions[0]?.association_slug ||
      "",
  );

  const selectedAssociation = useMemo(() => {
    if (association) return association;
    return (
      associationOptions.find(
        (entry) => entry.association_slug === selectedAssociationSlug,
      ) ||
      associationOptions[0] ||
      null
    );
  }, [association, associationOptions, selectedAssociationSlug]);

  useEffect(() => {
    if (association) return;
    if (!associationOptions.length) return;

    const associationExists = associationOptions.some(
      (entry) => entry.association_slug === selectedAssociationSlug,
    );

    if (!selectedAssociationSlug || !associationExists) {
      setSelectedAssociationSlug(associationOptions[0].association_slug);
    }
  }, [association, associationOptions, selectedAssociationSlug]);

  const canManage = Boolean(
    user?.is_admin || association || user?.has_association_role,
  );

  useEffect(() => {
    if (association) {
      setFormData((prev) => ({
        ...prev,
        association_slug: association.association_slug,
        association_name: association.association_name,
      }));
    }
  }, [association]);

  useEffect(() => {
    if (mode === "admin" && selectedAssociation) {
      setFormData((prev) =>
        editingEventId
          ? prev
          : {
              ...prev,
              association_slug: selectedAssociation.association_slug,
              association_name: selectedAssociation.association_name,
            },
      );
    }
  }, [editingEventId, mode, selectedAssociation]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(""), 3500);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint =
        mode === "admin"
          ? "/api/events/admin?limit=250"
          : `/api/events/association/${association?.association_slug}?limit=200`;
      const response = await fetchApi(endpoint);
      const data = await response.json();
      if (!data.success) {
        setError(data.error || "Impossible de charger les événements.");
        return;
      }
      setEvents(data.events || []);
    } catch (loadError) {
      console.error(loadError);
      setError("Erreur réseau lors du chargement des événements.");
    } finally {
      setLoading(false);
    }
  }, [association?.association_slug, mode]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const aTime = new Date(
          `${a.event_date}T${a.event_time || "23:59"}:00`,
        ).getTime();
        const bTime = new Date(
          `${b.event_date}T${b.event_time || "23:59"}:00`,
        ).getTime();
        return aTime - bTime;
      }),
    [events],
  );

  const resetForm = () => {
    setFormData(emptyForm(selectedAssociation || association));
    setEditingEventId(null);
  };

  const startEdit = (event) => {
    setEditingEventId(event.id);
    setFormData({
      title: event.title || "",
      short_title: event.short_title || (event.title || "").slice(0, 15),
      event_emoji: event.event_emoji || getDefaultEventEmoji(event.event_type),
      event_link: event.event_link || "",
      description: event.description || "",
      event_date: event.event_date || "",
      event_time: normalizeTimeValue(event.event_time),
      location: event.location || "",
      event_type: event.event_type || TYPE_OPTIONS[0],
      photo: null,
      association_slug:
        event.association_slug || selectedAssociation?.association_slug || "",
      association_name:
        event.association_name || selectedAssociation?.association_name || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitEvent = async (event) => {
    event.preventDefault();

    const associationSlug =
      mode === "admin"
        ? formData.association_slug
        : association?.association_slug;
    const associationName =
      mode === "admin"
        ? formData.association_name
        : association?.association_name;

    if (!associationSlug || !associationName) {
      setFeedback("Choisissez une association avant de publier.");
      return;
    }

    if (
      !formData.title ||
      !formData.short_title ||
      !formData.event_date ||
      !normalizeTimeValue(formData.event_time) ||
      !formData.description ||
      !formData.location ||
      !formData.event_type ||
      !formData.event_emoji
    ) {
      setFeedback("Merci de remplir tous les champs requis.");
      return;
    }

    if (formData.short_title.length > 15) {
      setFeedback("Le nom raccourci doit faire 15 caractères maximum.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("short_title", formData.short_title);
      payload.append("event_emoji", formData.event_emoji);
      payload.append("event_link", formData.event_link);
      payload.append("description", formData.description);
      payload.append("event_date", formData.event_date);
      payload.append("event_time", normalizeTimeValue(formData.event_time));
      payload.append("location", formData.location);
      payload.append("event_type", formData.event_type);
      payload.append("association_slug", associationSlug);
      payload.append("association_name", associationName);
      if (formData.photo) {
        payload.append("photo", formData.photo);
      }

      const endpoint = editingEventId
        ? `${process.env.REACT_APP_URL_BACK}/api/events/${editingEventId}`
        : `${process.env.REACT_APP_URL_BACK}/api/events/association/${associationSlug}`;

      const response = await fetch(endpoint, {
        method: editingEventId ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
        body: payload,
      });

      const data = await response.json();
      if (!data.success) {
        setFeedback(data.error || "Action impossible.");
        return;
      }

      setFeedback(editingEventId ? "Événement modifié." : "Événement créé.");
      resetForm();
      await loadEvents();
    } catch (submitError) {
      console.error(submitError);
      setFeedback("Erreur réseau lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      const response = await fetchApi(`/api/events/${eventId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!data.success) {
        setFeedback(data.error || "Suppression impossible.");
        return;
      }
      setEvents((prev) => prev.filter((entry) => entry.id !== eventId));
      setFeedback("Événement supprimé.");
    } catch (deleteError) {
      console.error(deleteError);
      setFeedback("Erreur réseau lors de la suppression.");
    }
  };

  if (!canManage) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-secondary">Accès refusé</h2>
        <p className="mt-2 text-sm text-gray-600">
          Cette vue est réservée aux membres d'association et aux
          administrateurs.
        </p>
        <button
          type="button"
          onClick={() => navigate("/events")}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white font-semibold"
        >
          Retour
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-6 animate-fade-in-up">
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Événements
            </p>
            <h2 className="text-2xl font-bold text-secondary mt-1">{title}</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <X size={16} /> Fermer
          </button>
        </div>

        {mode === "admin" && associationOptions.length > 0 && (
          <div className="pt-2">
            <label className="block text-sm font-semibold text-secondary">
              Association ciblée pour la création
            </label>
            <select
              value={formData.association_slug}
              onChange={(event) => {
                const nextSlug = event.target.value;
                const nextAssociation = associationOptions.find(
                  (entry) => entry.association_slug === nextSlug,
                );
                setSelectedAssociationSlug(nextSlug);
                setFormData((prev) => ({
                  ...prev,
                  association_slug: nextSlug,
                  association_name: nextAssociation?.association_name || "",
                }));
              }}
              className="mt-1 w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Sélectionnez une association</option>
              {associationOptions.map((entry) => (
                <option
                  key={entry.association_slug}
                  value={entry.association_slug}
                >
                  {entry.association_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-secondary font-medium">
            Chargement des événements...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_1fr] gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-secondary flex items-center gap-2">
              <Plus className="text-primary" />
              {editingEventId ? "Modifier l'événement" : "Créer un événement"}
            </h3>
            {editingEventId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-semibold text-gray-500 hover:text-secondary"
              >
                Annuler l'édition
              </button>
            )}
          </div>

          {editingEventId &&
            formData.photo === null &&
            sortedEvents.find((event) => event.id === editingEventId)
              ?.photo_url && (
              <ZoomableImage
                src={
                  sortedEvents.find((event) => event.id === editingEventId)
                    .photo_url
                }
                alt={
                  sortedEvents.find((event) => event.id === editingEventId)
                    .title
                }
                className="h-48 rounded-xl"
                previewClassName="h-48 rounded-xl"
              />
            )}

          <form className="space-y-4" onSubmit={submitEvent}>
            <div className="grid grid-cols-1 gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Titre
                </span>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px] gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-secondary">
                    Nom raccourci
                  </span>
                  <input
                    type="text"
                    value={formData.short_title}
                    maxLength={15}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        short_title: event.target.value,
                      }))
                    }
                    placeholder="Max 15 caractères"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Utilisé dans l'aperçu du calendrier HP.
                  </p>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-secondary">
                    Emoji
                  </span>
                  <input
                    type="text"
                    value={formData.event_emoji}
                    maxLength={4}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        event_emoji: event.target.value,
                      }))
                    }
                    placeholder="🎉"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-xl"
                    required
                  />
                </label>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  Emoji rapides
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          event_emoji: emoji,
                        }))
                      }
                      className={`h-10 w-10 shrink-0 rounded-full border text-lg transition-colors ${
                        formData.event_emoji === emoji
                          ? "border-primary bg-primary/10"
                          : "border-gray-200 bg-gray-50 hover:border-primary/30"
                      }`}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Type
                </span>
                <select
                  value={formData.event_type}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      event_type: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Lien (optionnel)
                </span>
                <input
                  type="text"
                  value={formData.event_link}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      event_link: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-secondary">
                    Date
                  </span>
                  <input
                    type="date"
                    value={formData.event_date}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        event_date: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-secondary">
                    Heure
                  </span>
                  <input
                    type="time"
                    value={formData.event_time}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        event_time: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Lieu
                </span>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      location: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Description
                </span>
                <textarea
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-secondary flex items-center gap-1">
                <ImageIcon size={15} className="text-primary" /> Photo
                (optionnelle)
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    photo:
                      event.target.files && event.target.files[0]
                        ? event.target.files[0]
                        : null,
                  }))
                }
                className="mt-2 block w-full text-sm text-gray-600"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Réinitialiser
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                <Save size={16} />
                {isSubmitting
                  ? "Enregistrement..."
                  : editingEventId
                    ? "Modifier"
                    : "Créer"}
              </button>
            </div>

            {feedback && (
              <div className="bg-primary/10 border border-primary/20 text-primary rounded-lg px-4 py-3">
                {feedback}
              </div>
            )}
          </form>
        </div>

        <div className="space-y-4">
          {!loading && !error && sortedEvents.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <CalendarDays className="mx-auto text-primary" size={42} />
              <p className="mt-3 font-semibold text-secondary">
                Aucun événement à afficher
              </p>
            </div>
          )}

          {!loading && !error && sortedEvents.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {sortedEvents.map((event) => (
                <article
                  key={event.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  {event.photo_url && (
                    <ZoomableImage
                      src={event.photo_url}
                      alt={event.title}
                      className="h-48"
                      previewClassName="h-48"
                    />
                  )}

                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl">
                            {event.event_emoji ||
                              getDefaultEventEmoji(event.event_type)}
                          </span>
                          <h3 className="text-xl font-bold text-secondary">
                            {event.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {event.short_title && (
                            <p className="text-xs font-semibold text-primary">
                              {event.short_title}
                            </p>
                          )}
                          {event.association_name && (
                            <p className="text-xs text-gray-500">
                              {event.association_name}
                            </p>
                          )}
                        </div>
                        {mode === "admin" && event.created_by && (
                          <p className="text-xs text-gray-500 mt-1">
                            Créé par {event.created_by}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap">
                        {event.event_type}
                      </span>
                    </div>

                    <p className="text-gray-700 leading-relaxed">
                      {event.description}
                    </p>

                    {event.event_link && (
                      <div className="text-sm">
                        <a
                          href={event.event_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-2 hover:text-primary-dark inline-block max-w-full truncate align-middle"
                          title={event.event_link}
                          onClick={(evt) => evt.stopPropagation()}
                        >
                          {event.event_link}
                        </a>
                      </div>
                    )}

                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-primary" />
                        <span>
                          {formatEventDate(event.event_date, event.event_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-primary" />
                        <span>{event.location}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(event)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors text-sm font-semibold"
                      >
                        <Edit3 size={14} /> Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEvent(event.id)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors text-sm font-semibold"
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default EventManagementPage;
