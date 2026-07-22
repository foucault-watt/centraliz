import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, MapPin, Shield, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { fetchApi } from "../utils/api";
import { trackProductEvent } from "../utils/analytics";

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

const PAGE_SIZE = 12;

const getLinkPreview = (link) => {
  const text = String(link || "").trim();
  if (!text) return "";
  return text.length > 12 ? `${text.slice(0, 12)}...` : text;
};

const getEventSortValue = (event) => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(event?.event_date || ""),
  );

  if (!dateMatch) {
    return Number.POSITIVE_INFINITY;
  }

  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(String(event?.event_time || ""));

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hours = timeMatch ? Number(timeMatch[1]) : 23;
  const minutes = timeMatch ? Number(timeMatch[2]) : 59;

  return new Date(year, month, day, hours, minutes, 0, 0).getTime();
};

const modalOverlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
  },
};

const modalPanelVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.99,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
};

const parseIsoDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatEventDate = (eventDate, eventTime) => {
  const dateObj = parseIsoDate(eventDate);
  if (!dateObj) return "Date inconnue";

  let weekDay = dateObj.toLocaleDateString("fr-FR", { weekday: "short" });
  weekDay = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
  if (!weekDay.endsWith(".")) {
    weekDay = `${weekDay}.`;
  }

  const dayMonth = dateObj.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  });

  return `${weekDay} ${dayMonth}`;
};

const EventCalendar = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aTime = getEventSortValue(a);
      const bTime = getEventSortValue(b);

      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return String(a.title || "").localeCompare(String(b.title || ""), "fr");
    });
  }, [events]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(""), 3500);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchApi("/api/events?limit=40");
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
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    return sortedEvents.filter(
      (event) => selectedType === "all" || event.event_type === selectedType,
    );
  }, [selectedType, sortedEvents]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedType]);

  useEffect(() => {
    if (!selectedEvent) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedEvent(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedEvent]);

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount],
  );

  const hasMore = visibleCount < filteredEvents.length;

  const renderEventDetailsModal = () => {
    if (!selectedEvent) return null;

    return ReactDOM.createPortal(
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 md:p-5"
          variants={modalOverlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={() => setSelectedEvent(null)}
        >
          <motion.div
            className="relative w-full max-w-4xl max-h-[86vh] overflow-hidden rounded-3xl bg-white shadow-2xl"
            variants={modalPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-4 md:p-5 border-b border-gray-200 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-secondary leading-tight">
                  Détails de l'événement
                </h3>
                <p className="text-xs md:text-sm text-gray-500 mt-1 truncate">
                  {selectedEvent.event_type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="shrink-0 rounded-full p-3 text-gray-600 hover:bg-gray-100 hover:text-secondary transition-colors"
                aria-label="Fermer"
              >
                <X size={22} />
              </button>
            </div>

            <div className="max-h-[calc(86vh-152px)] overflow-auto p-4 md:p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-5 items-start">
                {selectedEvent.photo_url ? (
                  <img
                    src={selectedEvent.photo_url}
                    alt={selectedEvent.title}
                    className="w-full rounded-2xl border border-gray-100 shadow-sm object-contain bg-transparent"
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                    Aucune photo
                  </div>
                )}

                <div className="space-y-4 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-xl md:text-2xl font-bold text-secondary leading-snug min-w-0 flex-1">
                      {selectedEvent.title}
                    </h4>
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap">
                      {selectedEvent.event_type}
                    </span>
                  </div>

                  <div className="space-y-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-primary" />
                      <span>
                        {formatEventDate(
                          selectedEvent.event_date,
                          selectedEvent.event_time,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-primary" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                      {selectedEvent.description}
                    </p>
                    {selectedEvent.event_link && (
                      <a
                        href={selectedEvent.event_link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() =>
                          trackProductEvent("event_link_clicked", "events", {
                            event_type: selectedEvent.event_type,
                            has_association: Boolean(selectedEvent.association_slug),
                          })
                        }
                        className="mt-3 inline-block max-w-full truncate text-sm text-primary underline underline-offset-2"
                        title={selectedEvent.event_link}
                      >
                        {selectedEvent.event_link}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-secondary/90 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>,
      document.body,
    );
  };

  return (
    <section className="space-y-4 animate-fade-in-up event-calendar-shell">
      <style>{`
        .event-calendar-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: var(--color-primary) transparent;
        }

        .event-calendar-scrollbar::-webkit-scrollbar {
          width: 10px;
        }

        .event-calendar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .event-calendar-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-primary);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .event-calendar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--color-primary-dark, var(--color-primary));
          background-clip: padding-box;
        }
      `}</style>
      <motion.div
        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200/80"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold text-secondary flex items-center gap-2">
              <CalendarDays className="text-primary" />
              Prochains événements
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              {filteredEvents.length} événement(s) affiché(s)
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/events")}
              className="text-xs text-primary hover:text-primary-dark underline underline-offset-2"
            >
              Voulez-vous créer votre propre événement ?
            </button>

            {user?.is_admin && (
              <button
                type="button"
                onClick={() => navigate("/events/admin")}
                className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary/5 px-2.5 py-1 text-xs font-semibold text-secondary hover:bg-secondary/10"
              >
                <Shield size={13} /> Espace admin events
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">Tous les types</option>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {feedback && (
        <div className="bg-primary/10 border border-primary/20 text-primary rounded-lg px-4 py-3">
          {feedback}
        </div>
      )}

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

      {!loading && !error && filteredEvents.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <CalendarDays className="mx-auto text-primary" size={42} />
          <p className="mt-3 font-semibold text-secondary">
            Aucun événement trouvé
          </p>
          <p className="text-sm text-gray-500">
            Ajuste tes filtres ou reviens plus tard.
          </p>
        </div>
      )}

      {!loading && !error && filteredEvents.length > 0 && (
        <div className="space-y-3">
          <div className="event-calendar-scrollbar xl:max-h-[65vh] xl:overflow-y-auto xl:pr-2 space-y-3">
            {visibleEvents.map((event, index) => (
              <motion.button
                key={event.id}
                type="button"
                onClick={() => {
                  setSelectedEvent(event);
                  trackProductEvent("event_opened", "events", {
                    event_type: event.event_type,
                    has_link: Boolean(event.event_link),
                    has_association: Boolean(event.association_slug),
                  });
                }}
                className="w-full text-left bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden hover:shadow-md hover:border-primary/30 transition-colors"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(index, 4) * 0.025 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.992 }}
              >
                <div className="relative p-3">
                  <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
                    {event.photo_url && (
                      <div className="w-full md:w-28 lg:w-32 shrink-0 aspect-[4/5] md:aspect-[2/3] overflow-hidden rounded-lg bg-gray-50 border border-gray-100">
                        <img
                          src={event.photo_url}
                          alt={event.title}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 flex flex-col pb-9">
                      <h3 className="text-base md:text-lg font-bold text-secondary leading-snug pr-2 line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2 md:line-clamp-3">
                        {event.description}
                      </p>

                      <div className="mt-3 grid gap-1.5 text-xs text-gray-700 pr-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-primary" />
                          <span>
                            {formatEventDate(
                              event.event_date,
                              event.event_time,
                            )}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className="text-primary mt-0.5" />
                          <span className="break-words">{event.location}</span>
                        </div>
                        {event.event_link && (
                          <button
                            type="button"
                            onClick={(evt) => {
                              evt.stopPropagation();
                              setSelectedEvent(event);
                              trackProductEvent("event_opened", "events", {
                                event_type: event.event_type,
                                has_link: Boolean(event.event_link),
                                has_association: Boolean(event.association_slug),
                                source: "link_preview",
                              });
                            }}
                            className="block max-w-full text-left text-primary underline underline-offset-2 truncate"
                            title={event.event_link}
                          >
                            {getLinkPreview(event.event_link)}
                          </button>
                        )}
                      </div>
                    </div>

                    <span className="absolute bottom-3 right-3 text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap max-w-[7rem] truncate">
                      {event.event_type}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-secondary hover:bg-gray-50 transition-colors"
            >
              Charger plus ({filteredEvents.length - visibleCount} restant)
            </button>
          )}
        </div>
      )}

      {renderEventDetailsModal()}
    </section>
  );
};

export default EventCalendar;
