import ICAL from "ical.js";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronDown,
  CircleChevronDown,
  DoorClosed,
  GraduationCap,
  MapPin,
  Search,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import moment from "moment-timezone";
import "moment/locale/fr";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { fetchApi } from "../utils/api";
import { trackProductEvent } from "../utils/analytics";

moment.locale("fr");

// Hyperplanning décrit toujours des horaires de Centrale Lille en heure française,
// peu importe le fuseau horaire du navigateur qui affiche le planning.
const SCHOOL_TIMEZONE = "Europe/Paris";

// La grille n'affiche que 8h-18h en semaine (lun-ven) : tout ce qui tombe hors
// de cette plage (tôt le matin, en soirée, ou le week-end) n'apparaît nulle part.
const GRID_START_HOUR = 8;
const GRID_END_HOUR = 18;

// Fonction utilitaire pour formater l'heure
const formatHour = (hour) => {
  return `${hour.toString().padStart(2, "0")}h`;
};

// Déplacer parseICal en tant que fonction pure
const parseICalData = (icalData) => {
  if (!icalData) return [];

  try {
    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    return vevents.map((vevent) => {
      const summary = vevent.getFirstPropertyValue("summary") || "";
      const location = vevent.getFirstPropertyValue("location") || "";
      const dtstart = vevent.getFirstPropertyValue("dtstart").toJSDate();
      const dtend = vevent.getFirstPropertyValue("dtend").toJSDate();

      const parts = summary.split("-").map((part) => part.trim());
      const [courseName, professor = "", ...rest] = parts;
      const courseType = rest.join(" - ");

      const isTNE = summary.includes("TNE");
      const isCB = summary.includes("CB");
      const className = isTNE ? "tne-event" : isCB ? "cb-event" : "";

      return {
        title: courseName,
        professor,
        courseType,
        location,
        start: dtstart,
        end: dtend,
        className,
      };
    });
  } catch (error) {
    console.error("Erreur lors du parsing des données iCal:", error);
    return [];
  }
};

const monthsOrder = [
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
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

const getDefaultShortTitle = (event) => {
  if (event.short_title) return event.short_title;
  return String(event.title || "")
    .trim()
    .slice(0, 15);
};

const HpCalendar = ({ user }) => {
  // Accepte user comme prop
  const [icalData, setIcalData] = useState("");
  const [currentDate, setCurrentDate] = useState(() => {
    const today = moment();
    // Sur mobile, on commence par le jour actuel
    if (window.innerWidth < 768) {
      // Si c'est un weekend, on va au prochain jour ouvré
      while (today.day() === 0 || today.day() === 6) {
        today.add(1, "day");
      }
      return today;
    }
    // Sur desktop
    if (today.day() === 0 || today.day() === 6) {
      // Si on est samedi ou dimanche, on va à la semaine prochaine
      return moment().add(1, "week").startOf("week").add(1, "day");
    }
    // Sinon on reste sur la semaine courante
    return moment().startOf("week").add(1, "day");
  });
  const { userName } = user || {}; // Récupère userName directement de la prop user
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [users, setUsers] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUsersList, setShowUsersList] = useState(false);
  const [sharedEvents, setSharedEvents] = useState([]);
  const [showCategoryMenu, setShowCategoryMenu] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [slideDirection, setSlideDirection] = useState(""); // 'left' ou 'right'
  const [isSelectorFocused, setIsSelectorFocused] = useState(false);
  const [associationEvents, setAssociationEvents] = useState([]);
  const [showHiddenEventsList, setShowHiddenEventsList] = useState(false);

  const closeModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
  };

  const fetchCalendarData = useCallback(async () => {
    try {
      const response = await fetchApi(`/api/hp-data?userId=${userName}`);
      if (!response.ok) {
        throw new Error("Erreur lors de la récupération des données");
      }
      const data = await response.text();
      setIcalData(data);
    } catch (error) {
      console.error("Erreur lors de la récupération du fichier iCal :", error);
    }
  }, [userName]);

  useEffect(() => {
    const checkExistingCalendar = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/check-user/`,
          {
            method: "GET",
            credentials: "include", // Indispensable pour que le cookie de session soit envoyé
          },
        );
        const data = await response.json();

        if (data.exists) {
          fetchCalendarData();
        }
      } catch (error) {
        console.error(
          "Erreur lors de la vérification de l'utilisateur:",
          error,
        );
      }
    };

    if (userName) {
      checkExistingCalendar();
    }
  }, [userName, fetchCalendarData]);

  // Replier le détail du bandeau d'événements masqués quand on change de semaine/jour
  useEffect(() => {
    setShowHiddenEventsList(false);
  }, [currentDate]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchAssociationEvents = async () => {
      try {
        const response = await fetchApi("/api/events?limit=120");
        const data = await response.json();
        if (!data.success) {
          setAssociationEvents([]);
          return;
        }
        setAssociationEvents(Array.isArray(data.events) ? data.events : []);
      } catch (error) {
        console.error("Erreur chargement events assos du jour:", error);
        setAssociationEvents([]);
      }
    };

    fetchAssociationEvents();
  }, []);

  // Ajouter un useEffect pour gérer le clic en dehors du sélecteur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMonthPicker && !event.target.closest(".month-selector")) {
        setShowMonthPicker(false);
      }
      if (showUsersList && !event.target.closest(".user-selector")) {
        setShowUsersList(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showMonthPicker, showUsersList]);

  // Utiliser useMemo pour le parsing des événements
  const events = useMemo(() => {
    return parseICalData(icalData);
  }, [icalData]);

  // Événements présents dans l'iCal mais que la grille (8h-18h, lun-ven)
  // ne peut pas afficher : trop tôt/tard dans la journée, ou le week-end.
  const hiddenEventsThisWeek = useMemo(() => {
    const weekStart = moment(currentDate).startOf("week");
    const weekEnd = moment(weekStart).add(6, "days").endOf("day");

    return (events || [])
      .filter((event) => {
        const start = moment.tz(event.start, SCHOOL_TIMEZONE);
        if (!start.isBetween(weekStart, weekEnd, null, "[]")) return false;

        const dayOfWeek = start.day(); // 0 = dimanche, 6 = samedi
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const startHour = start.hour() + start.minute() / 60;
        const isOutsideHours =
          startHour < GRID_START_HOUR || startHour >= GRID_END_HOUR;

        return isWeekend || isOutsideHours;
      })
      .sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf());
  }, [events, currentDate]);

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
    trackProductEvent(
      event?.associationEvent ? "calendar_event_opened" : "calendar_course_opened",
      "calendars",
      {
        type: event?.associationEvent ? "association_event" : "course",
        course_type: event?.courseType || event?.event_type,
        has_location: Boolean(event?.location),
      },
    );
  };

  // Mémoisation des heures et jours
  const hours = useMemo(
    () =>
      Array.from(
        { length: GRID_END_HOUR - GRID_START_HOUR },
        (_, i) => i + GRID_START_HOUR,
      ),
    [],
  );

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) =>
      moment(currentDate).startOf("week").add(i, "days"),
    );
  }, [currentDate]);

  const getAssociationEventsForDay = useCallback(
    (day) => {
      const dayIso = moment(day).format("YYYY-MM-DD");

      return associationEvents
        .filter((event) => event.event_date === dayIso)
        .sort((a, b) => {
          const aTime = a.event_time || "23:59";
          const bTime = b.event_time || "23:59";
          return aTime.localeCompare(bTime);
        });
    },
    [associationEvents],
  );

  // Optimisation du calcul des événements par cellule
  const getEventsForCell = useCallback(
    (day, hour) => {
      const allEvents = [...(events || []), ...sharedEvents];
      if (!allEvents?.length) return [];

      const dayKey = moment(day).format("YYYY-MM-DD");
      const cellStart = moment.tz(dayKey, "YYYY-MM-DD", SCHOOL_TIMEZONE).hour(
        hour,
      );
      const cellEnd = moment.tz(dayKey, "YYYY-MM-DD", SCHOOL_TIMEZONE).hour(
        hour + 1,
      );

      // Filtrer d'abord tous les événements de cette cellule
      const cellEvents = allEvents
        .filter((event) => {
          const eventStart = moment(event.start);
          const eventEnd = moment(event.end);
          return eventStart.isBefore(cellEnd) && eventEnd.isAfter(cellStart);
        })
        .map((event) => {
          const eventStart = moment.tz(event.start, SCHOOL_TIMEZONE);
          const eventEnd = moment.tz(event.end, SCHOOL_TIMEZONE);
          const startHour = eventStart.hour() + eventStart.minute() / 60;
          const endHour = eventEnd.hour() + eventEnd.minute() / 60;

          return {
            ...event,
            duration: endHour - startHour,
            topOffset: (startHour - hour) * 100,
            isStart: Math.floor(startHour) === hour,
            isShared: event.className?.includes("shared") || false,
          };
        });

      // Détecter et marquer les chevauchements
      return cellEvents.map((event) => {
        const overlappingEvents = cellEvents.filter((otherEvent) => {
          if (event === otherEvent) return false;

          const eventStart = moment(event.start);
          const eventEnd = moment(event.end);
          const otherStart = moment(otherEvent.start);
          const otherEnd = moment(otherEvent.end);

          return eventStart.isBefore(otherEnd) && eventEnd.isAfter(otherStart);
        });

        if (overlappingEvents.length > 0) {
          return {
            ...event,
            className: `${event.className} ${
              event.isShared ? "overlap-right" : "overlap-left"
            }`,
          };
        }

        return event;
      });
    },
    [events, sharedEvents],
  );

  // Mémoisation des colonnes du calendrier
  const DayColumn = React.memo(
    ({
      day,
      hours,
      getEventsForCell,
      handleSelectEvent,
      isMobile,
      getAssociationEventsForDay,
      associationPreviewRows,
    }) => {
      const dayAssociationEvents = getAssociationEventsForDay(day);
      const previewCount = Math.min(
        dayAssociationEvents.length,
        associationPreviewRows,
      );

      return (
        <div className="day-column">
          <div className="day-header">
            <span className="day-label">
              {isMobile ? day.format("dddd DD/MM") : day.format("ddd DD/MM")}
            </span>
          </div>
          <div
            className={`day-association-preview rows-${associationPreviewRows} ${
              dayAssociationEvents.length === 0 ? "is-empty" : ""
            }`}
          >
            {dayAssociationEvents.length > 0 && (
              <div className="day-association-preview-list">
                {dayAssociationEvents.slice(0, previewCount).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="day-association-preview-chip"
                    onClick={() =>
                      handleSelectEvent({
                        title: event.title,
                        description: event.description || "",
                        event_type: event.event_type || "Autre",
                        event_date: event.event_date,
                        event_time: event.event_time,
                        event_link: event.event_link || "",
                        photo_url: event.photo_url || "",
                        courseType: event.event_type || "Event associatif",
                        location: event.location || "",
                        professor: event.association_name || "",
                        event_emoji:
                          event.event_emoji ||
                          getDefaultEventEmoji(event.event_type),
                        short_title: getDefaultShortTitle(event),
                        start: event.event_time
                          ? moment(
                              `${event.event_date} ${event.event_time}`,
                              "YYYY-MM-DD HH:mm",
                            ).toDate()
                          : null,
                        end: event.event_time
                          ? moment(
                              `${event.event_date} ${event.event_time}`,
                              "YYYY-MM-DD HH:mm",
                            )
                              .add(1, "hour")
                              .toDate()
                          : null,
                        associationEvent: event,
                      })
                    }
                    title={event.title}
                  >
                    <span className="chip-emoji">
                      {event.event_emoji ||
                        getDefaultEventEmoji(event.event_type)}
                    </span>
                    <span className="chip-title">
                      {getDefaultShortTitle(event) || "Event"}
                    </span>
                  </button>
                ))}
                {dayAssociationEvents.length > previewCount && (
                  <div className="day-association-preview-more">
                    +{dayAssociationEvents.length - previewCount}
                  </div>
                )}
              </div>
            )}
          </div>
          {hours.map((hour) => (
            <TimeCell
              key={`${day.format("YYYY-MM-DD")}-${hour}`}
              day={day}
              hour={hour}
              getEventsForCell={getEventsForCell}
              handleSelectEvent={handleSelectEvent}
            />
          ))}

        </div>
      );
    },
  );

  const visibleDays = isMobile ? [currentDate] : weekDays;
  const associationPreviewRows = Math.max(
    1,
    ...visibleDays.map((day) =>
      Math.min(getAssociationEventsForDay(day).length, 3),
    ),
  );

  // Composant optimisé pour les cellules de temps
  const TimeCell = React.memo(
    ({ day, hour, getEventsForCell, handleSelectEvent }) => {
      const events = getEventsForCell(day, hour);

      return (
        <div className="time-cell">
          {events.map(
            (event, index) =>
              event.isStart && (
                <Event
                  key={index}
                  event={event}
                  handleSelectEvent={handleSelectEvent}
                />
              ),
          )}
        </div>
      );
    },
  );

  // Modifier le composant Event
  const Event = React.memo(({ event, handleSelectEvent }) => {
    const style = {
      height: `calc(${event.duration * 100}% - 2px)`,
      top: `${event.topOffset}%`,
      zIndex: event.className?.includes("shared") ? 2 : 1,
    };

    // Vérifier si on est en mode "partagé" (si sharedEvents existe et n'est pas vide)
    const isInSharedMode = sharedEvents && sharedEvents.length > 0;
    const densityClass =
      event.duration <= 1
        ? "compact"
        : event.duration <= 2
          ? "comfortable"
          : "roomy";

    return (
      <motion.div
        className={`calendar-event ${densityClass} ${event.className}`}
        onClick={() => handleSelectEvent(event)}
        style={style}
        title={event.sharedBy ? `Partagé par ${event.sharedBy}` : undefined}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
      >
        <div className="event-title">{event.title}</div>
        {/* N'afficher les détails supplémentaires que si on n'est pas en mode partagé */}
        {!isInSharedMode && (
          <>
            {event.location && (
              <div className="event-location">{event.location}</div>
            )}
            {event.courseType && (
              <div className="event-type">{event.courseType}</div>
            )}
            {event.professor && (
              <div className="event-professor">{event.professor}</div>
            )}
          </>
        )}
      </motion.div>
    );
  });

  const navigateWeek = (direction) => {
    trackProductEvent("calendar_period_changed", "calendars", {
      direction,
      mode: isMobile ? "day" : "week",
    });
    if (isMobile) {
      // Navigation quotidienne sur mobile (sans weekends)
      setCurrentDate((prev) => {
        let newDate =
          direction === "next"
            ? moment(prev).add(1, "day")
            : moment(prev).subtract(1, "day");

        // Si le nouveau jour est un weekend, on continue jusqu'au prochain jour ouvré
        while (newDate.day() === 0 || newDate.day() === 6) {
          newDate =
            direction === "next"
              ? newDate.add(1, "day")
              : newDate.subtract(1, "day");
        }

        return newDate;
      });
    } else {
      // Navigation hebdomadaire sur desktop (comportement existant)
      setCurrentDate((prev) =>
        direction === "next"
          ? moment(prev).add(1, "week")
          : moment(prev).subtract(1, "week"),
      );
    }
  };

  const getMonthsList = () => {
    const currentMonth = currentDate.month();
    const currentYear = currentDate.year();

    // Déterminer l'année académique de base
    const baseAcademicYear = currentMonth >= 7 ? currentYear : currentYear - 1;

    return monthsOrder.map((monthName) => {
      const monthIndex = monthsOrder.findIndex((m) => m === monthName);
      const isFirstHalf = monthIndex >= 5; // janvier à juillet
      const year = isFirstHalf ? baseAcademicYear + 1 : baseAcademicYear;

      return {
        month: monthName,
        year,
        display: `${
          monthName.charAt(0).toUpperCase() + monthName.slice(1)
        } ${year}`,
        monthIndex: monthIndex >= 5 ? monthIndex - 5 : monthIndex + 7, // Convertir l'index pour moment.js
      };
    });
  };

  const goToToday = () => {
    trackProductEvent("calendar_today_clicked", "calendars", {
      mode: isMobile ? "day" : "week",
    });
    let today = moment();

    // Si on est sur mobile et que c'est un weekend
    if (isMobile && (today.day() === 0 || today.day() === 6)) {
      // On va au prochain lundi
      while (today.day() === 0 || today.day() === 6) {
        today.add(1, "day");
      }
    } else if (!isMobile) {
      // Sur desktop, on reste sur le comportement existant
      today = today.startOf("week").add(1, "day");
    }

    setCurrentDate(today);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetchApi(`/api/users`);
        if (!response.ok)
          throw new Error("Erreur lors de la récupération des utilisateurs");
        const data = await response.json();
        setUsers(data.filter((user) => user.userName !== userName));
      } catch (error) {
        console.error("Erreur:", error);
      }
    };
    fetchUsers();
  }, [userName]);

  useEffect(() => {
    const fetchProfessorsAndRooms = async () => {
      try {
        const [profResponse, roomResponse] = await Promise.all([
          fetchApi(`/api/professors`),
          fetchApi(`/api/rooms`),
        ]);

        if (!profResponse.ok || !roomResponse.ok)
          throw new Error("Erreur de chargement");

        const profData = await profResponse.json();
        const roomData = await roomResponse.json();

        setProfessors(profData);
        setRooms(roomData);
      } catch (error) {
        console.error("Erreur:", error);
      }
    };

    fetchProfessorsAndRooms();
  }, []);

  const fetchUserCalendar = async (userId) => {
    try {
      trackProductEvent("calendar_user_searched", "calendars", {
        scope: "student",
      });
      const response = await fetchApi(`/api/hp-data?userId=${userId}`);
      if (!response.ok)
        throw new Error("Erreur lors de la récupération du calendrier");
      const data = await response.text();
      const parsedEvents = parseICalData(data).map((event) => ({
        ...event,
        className: `${event.className} shared`,
        sharedBy: users.find((u) => u.userName === userId)?.displayName,
      }));
      setSharedEvents(parsedEvents); // Remplacer au lieu d'ajouter
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const fetchCalendarByName = async (name, type) => {
    try {
      trackProductEvent("calendar_resource_searched", "calendars", {
        scope: type === "prof" ? "prof" : "room",
      });
      const response = await fetch(
        `${
          process.env.REACT_APP_URL_BACK
        }/api/calendar/${type}/${encodeURIComponent(name)}`,
      );
      if (!response.ok)
        throw new Error("Erreur lors de la récupération du calendrier");
      const data = await response.text();
      const parsedEvents = parseICalData(data).map((event) => ({
        ...event,
        className: `${event.className} shared`,
        sharedBy: name,
      }));
      setSharedEvents(parsedEvents);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  // Ajouter cette fonction pour gérer le clic sur une catégorie
  const handleCategorySelect = (category) => {
    trackProductEvent("calendar_search_category_opened", "calendars", {
      category,
    });
    setSlideDirection("left");
    setSelectedCategory(category);
    setShowCategoryMenu(false);
    setSearchQuery("");
    // Focus automatique sur la barre de recherche
    setTimeout(() => {
      document.querySelector(".search-input")?.focus();
    }, 100);
  };

  const handleBackToCategories = () => {
    setSlideDirection("right");
    setTimeout(() => {
      setShowCategoryMenu(true);
      setSelectedCategory(null);
    }, 10); // Petit délai pour l'animation
  };

  // Nouvelle fonction utilitaire de recherche
  function normalize(str = "") {
    return str
      .normalize("NFD") // Enlever les accents
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  }

  function matchesSearch(itemString, search) {
    return normalize(itemString).includes(normalize(search));
  }

  const filteredUsers = users.filter(
    (u) =>
      matchesSearch(u.displayName ?? "", searchQuery) ||
      matchesSearch(u.group ?? "", searchQuery),
  );

  const filteredProfessors = professors.filter((p) =>
    matchesSearch(p.prof, searchQuery),
  );

  const filteredRooms = rooms.filter((r) => {
    // Si aucune recherche, on renvoie toutes les salles
    if (!searchQuery) return true;
    return r.salle && matchesSearch(r.salle, searchQuery);
  });

  // Rendu du modal des détails d'événement
  const renderModals = () => {
    if (!showModal) return null;

    if (selectedEvent?.associationEvent) {
      return ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 md:p-5"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-4xl max-h-[86vh] overflow-hidden rounded-3xl bg-white shadow-2xl"
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
                onClick={closeModal}
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
                    {selectedEvent.event_date && (
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-primary" />
                        <span>
                          {moment(selectedEvent.event_date).format(
                            "ddd DD MMMM",
                          )}{" "}
                          {selectedEvent.event_time
                            ? `- ${selectedEvent.event_time}`
                            : ""}
                        </span>
                      </div>
                    )}
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-primary" />
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                      {selectedEvent.description || "Pas de description."}
                    </p>
                    {selectedEvent.event_link && (
                      <a
                        href={selectedEvent.event_link}
                        target="_blank"
                        rel="noreferrer"
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
                  onClick={closeModal}
                  className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-secondary/90 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      );
    }

    const accentVar =
      selectedEvent?.className === "tne-event"
        ? "var(--color-green)"
        : selectedEvent?.className === "cb-event"
          ? "var(--color-red)"
          : "var(--color-primary)";
    const accentLabel =
      selectedEvent?.className === "tne-event"
        ? "TNE"
        : selectedEvent?.className === "cb-event"
          ? "DS"
          : "Cours";

    return ReactDOM.createPortal(
      <AnimatePresence>
        {showModal && selectedEvent && (
          <motion.div
            className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 md:p-5"
            onClick={closeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
            <div
              className="p-4 md:p-5 flex items-start justify-between gap-4 text-white"
              style={{ background: accentVar }}
            >
              <div className="min-w-0">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full mb-1.5">
                  {accentLabel}
                </span>
                <h3 className="text-lg md:text-xl font-bold leading-tight break-words">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-full p-2.5 text-white/90 hover:bg-white/20 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 md:p-5 space-y-3">
              {selectedEvent.start && selectedEvent.end && (
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-secondary bg-gray-100 px-3 py-1.5 rounded-full">
                  {moment
                    .tz(selectedEvent.start, SCHOOL_TIMEZONE)
                    .format("HH[h]mm")}{" "}
                  –{" "}
                  {moment
                    .tz(selectedEvent.end, SCHOOL_TIMEZONE)
                    .format("HH[h]mm")}
                </div>
              )}

              <div className="space-y-2">
                {selectedEvent.courseType && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${accentVar} 15%, white)`,
                        color: accentVar,
                      }}
                    >
                      <BookOpen size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">
                        Type de cours
                      </div>
                      <div className="text-sm font-medium text-secondary truncate">
                        {selectedEvent.courseType}
                      </div>
                    </div>
                  </div>
                )}

                {selectedEvent.professor && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${accentVar} 15%, white)`,
                        color: accentVar,
                      }}
                    >
                      <GraduationCap size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">
                        Professeur
                      </div>
                      <div className="text-sm font-medium text-secondary truncate">
                        {selectedEvent.professor}
                      </div>
                    </div>
                  </div>
                )}

                {selectedEvent.location && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${accentVar} 15%, white)`,
                        color: accentVar,
                      }}
                    >
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">
                        Salle
                      </div>
                      <div className="text-sm font-medium text-secondary truncate">
                        {selectedEvent.location}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-secondary/90 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    );
  };

  return (
    <div className="hp-calendar">
      <motion.div
        className="calendar-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <div className="calendar-top-row">
          <div className="navigation-controls">
            <motion.button
              type="button"
              className="calendar-icon-btn"
              onClick={() => navigateWeek("prev")}
              title="Semaine précédente"
              whileTap={{ scale: 0.94 }}
            >
              <ArrowLeft />
            </motion.button>
            <motion.button
              type="button"
              onClick={goToToday}
              className="today-btn"
              title="Aujourd'hui"
              whileTap={{ scale: 0.97 }}
            >
              Aujourd'hui
            </motion.button>
            <motion.button
              type="button"
              className="calendar-icon-btn"
              onClick={() => navigateWeek("next")}
              title="Semaine suivante"
              whileTap={{ scale: 0.94 }}
            >
              <ArrowRight />
            </motion.button>
          </div>
          <motion.div
            className="month-selector"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowMonthPicker(!showMonthPicker);
              }
            }}
          >
            <CalendarDays size={18} />
            <h2>
              {currentDate.format("MMMM")} <CircleChevronDown size={18} />
            </h2>
            {showMonthPicker && (
              <div className={`month-picker ${showMonthPicker ? "" : "hiding"}`}>
                {getMonthsList().map(({ month, year, display, monthIndex }) => (
                  <div
                    key={`${month}-${year}`}
                    onClick={() => {
                      const newDate = moment(currentDate)
                        .year(year)
                        .month(monthIndex);
                      setCurrentDate(newDate);
                      setShowMonthPicker(false);
                    }}
                    className={
                      currentDate.format("MMMM YYYY").toLowerCase() ===
                      `${month} ${year}`
                        ? "current"
                        : ""
                    }
                  >
                    {display}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
        <div className="user-selector">
          <div
            className="search-shell"
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search className="search-icon" size={17} />
            <input
              type="text"
              className={`search-input ${isSelectorFocused ? "is-focused" : ""}`}
              placeholder={
                selectedUser
                  ? selectedCategory === "students"
                    ? users.find((u) => u.userName === selectedUser)
                        ?.displayName
                    : selectedCategory === "professors"
                      ? professors.find((p) => p.prof === selectedUser)?.prof
                      : rooms.find((r) => r.salle === selectedUser)?.salle
                  : selectedCategory
                    ? `Rechercher un${selectedCategory === "rooms" ? "e" : ""} ${
                        selectedCategory === "students"
                          ? "étudiant"
                          : selectedCategory === "professors"
                            ? "prof"
                            : "salle"
                      }...`
                    : "Choisir une catégorie..."
              }
              value={searchQuery}
              onChange={(e) => {
                e.stopPropagation();
                setSearchQuery(e.target.value);
                if (!showUsersList) setShowUsersList(true);
              }}
              onFocus={(e) => {
                e.stopPropagation();
                setShowUsersList(true);
                setIsSelectorFocused(true);
              }}
              onBlur={() => {
                // Petit délai pour permettre les clics sur la liste
                setTimeout(() => {
                  if (!document.activeElement?.closest(".users-list")) {
                    setIsSelectorFocused(false);
                  }
                }, 200);
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                // Empêcher la navigation avec les flèches quand le sélecteur est actif
                if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                  e.preventDefault();
                }
              }}
            />
            {selectedUser && (
              <button
                className="clear-user-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUser(null);
                  setSharedEvents([]);
                  setSearchQuery("");
                }}
                title="Désélectionner l'utilisateur"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {showUsersList && (
            <div
              className="users-list"
              onMouseDown={(e) => {
                // Empêcher la perte de focus de l'input lors du clic
                e.preventDefault();
              }}
            >
              <div className={`sliding-container ${slideDirection}`}>
                {showCategoryMenu ? (
                  <div className="category-menu">
                    <div
                      className="category-item"
                      onClick={() => handleCategorySelect("students")}
                    >
                      <div className="category-name">
                        <Users size={18} /> Étudiants
                      </div>
                      <span className="category-count">{users.length}</span>
                    </div>
                    <div
                      className="category-item"
                      onClick={() => handleCategorySelect("professors")}
                    >
                      <div className="category-name">
                        <Briefcase size={18} /> Profs
                      </div>
                      <span className="category-count">
                        {professors.length}
                      </span>
                    </div>
                    <div
                      className="category-item"
                      onClick={() => handleCategorySelect("rooms")}
                    >
                      <div className="category-name">
                        <DoorClosed size={18} /> Salles
                      </div>
                      <span className="category-count">{rooms.length}</span>
                    </div>
                  </div>
                ) : (
                  <div className="list-content">
                    <div
                      className="back-button"
                      onClick={handleBackToCategories}
                    >
                      <ArrowLeft /> Retour aux catégories
                    </div>
                    {selectedCategory === "students" &&
                      filteredUsers.map((user) => (
                        <div
                          key={user.userName}
                          className={`user-item ${
                            selectedUser === user.userName ? "selected" : ""
                          }`}
                          onClick={() => {
                            if (selectedUser === user.userName) {
                              setSelectedUser(null);
                              setSharedEvents([]);
                            } else {
                              setSelectedUser(user.userName);
                              fetchUserCalendar(user.userName);
                            }
                            setShowUsersList(false);
                            setSearchQuery("");
                          }}
                        >
                          <div className="user-info">
                            <div className="name">{user.displayName}</div>
                            {user.group && (
                              <div className="group">{user.group}</div>
                            )}
                          </div>
                        </div>
                      ))}

                    {selectedCategory === "professors" &&
                      filteredProfessors.map((prof) => (
                        <div
                          key={prof.position}
                          className={`user-item ${
                            selectedUser === prof.prof ? "selected" : ""
                          }`}
                          onClick={() => {
                            if (selectedUser === prof.prof) {
                              setSelectedUser(null);
                              setSharedEvents([]);
                            } else {
                              setSelectedUser(prof.prof);
                              fetchCalendarByName(prof.prof, "prof");
                            }
                            setShowUsersList(false);
                            setSearchQuery("");
                          }}
                        >
                          <div className="user-info">
                            <div className="name">{prof.prof}</div>
                            <div className="group">Professeur</div>
                          </div>
                        </div>
                      ))}

                    {selectedCategory === "rooms" &&
                      filteredRooms.map((room) => (
                        <div
                          key={room.position}
                          className={`user-item ${
                            selectedUser === room.salle ? "selected" : ""
                          }`}
                          onClick={() => {
                            if (selectedUser === room.salle) {
                              setSelectedUser(null);
                              setSharedEvents([]);
                            } else {
                              setSelectedUser(room.salle);
                              fetchCalendarByName(room.salle, "salle");
                            }
                            setShowUsersList(false);
                            setSearchQuery("");
                          }}
                        >
                          <div className="user-info">
                            <div className="name">
                              {room.salle || "Salle non définie"}
                            </div>
                            <div className="group">Salle</div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {hiddenEventsThisWeek.length > 0 && (
        <motion.div
          className="hidden-events-banner"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <button
            type="button"
            className="hidden-events-banner-summary"
            onClick={() => setShowHiddenEventsList((prev) => !prev)}
            aria-expanded={showHiddenEventsList}
          >
            <TriangleAlert size={18} className="hidden-events-icon" />
            <span className="hidden-events-text">
              {hiddenEventsThisWeek.length === 1
                ? "1 événement de cette semaine ne s'affiche pas ci-dessous"
                : `${hiddenEventsThisWeek.length} événements de cette semaine ne s'affichent pas ci-dessous`}{" "}
              <span className="hidden-events-reason">
                (avant 8h, après 18h, ou le week-end)
              </span>
            </span>
            <ChevronDown
              size={18}
              className={`hidden-events-chevron ${
                showHiddenEventsList ? "is-open" : ""
              }`}
            />
          </button>

          <AnimatePresence>
            {showHiddenEventsList && (
              <motion.ul
                className="hidden-events-list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {hiddenEventsThisWeek.map((event, index) => {
                  const start = moment.tz(event.start, SCHOOL_TIMEZONE);
                  const end = moment.tz(event.end, SCHOOL_TIMEZONE);
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        className="hidden-event-item"
                        onClick={() => handleSelectEvent(event)}
                      >
                        <span className="hidden-event-day">
                          {start.format("ddd DD/MM")}
                        </span>
                        <span className="hidden-event-time">
                          {start.format("HH[h]mm")}–{end.format("HH[h]mm")}
                        </span>
                        <span className="hidden-event-title">
                          {event.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <div className="calendar-grid">
        <div className="time-column">
          <div className="corner-header"></div>
          <div
            className={`association-row-spacer rows-${associationPreviewRows}`}
          ></div>
          {hours.map((hour) => (
            <div key={hour} className="time-slot">
              {formatHour(hour)}
            </div>
          ))}
        </div>
        {isMobile ? (
          <DayColumn
            day={currentDate}
            hours={hours}
            getEventsForCell={getEventsForCell}
            handleSelectEvent={handleSelectEvent}
            isMobile={isMobile}
            getAssociationEventsForDay={getAssociationEventsForDay}
            associationPreviewRows={associationPreviewRows}
          />
        ) : (
          weekDays.map((day) => (
            <DayColumn
              key={day.format("YYYY-MM-DD")}
              day={day}
              hours={hours}
              getEventsForCell={getEventsForCell}
              handleSelectEvent={handleSelectEvent}
              isMobile={isMobile}
              getAssociationEventsForDay={getAssociationEventsForDay}
              associationPreviewRows={associationPreviewRows}
            />
          ))
        )}
      </div>

      {renderModals()}
    </div>
  );
};

export default HpCalendar;
