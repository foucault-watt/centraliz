import ICAL from "ical.js";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  CircleChevronDown,
  Clock,
  DoorClosed,
  GraduationCap,
  MapPin,
  Music,
  Star,
  Users,
  X,
} from "lucide-react";
import moment from "moment";
import "moment/locale/fr";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { UserContext } from "../App";
import { admin } from "../data/admin";
import { events as specialEvents } from "../data/events";

moment.locale("fr");

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

const HpCalendar = () => {
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
  const { userName } = useContext(UserContext);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [evaluationConfig, setEvaluationConfig] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [users, setUsers] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUsersList, setShowUsersList] = useState(false);
  const [selectedType, setSelectedType] = useState("students"); // 'students', 'professors', 'rooms'
  const [sharedEvents, setSharedEvents] = useState([]);
  const [showCategoryMenu, setShowCategoryMenu] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [slideDirection, setSlideDirection] = useState(""); // 'left' ou 'right'
  const [isSelectorFocused, setIsSelectorFocused] = useState(false);
  const [externalCalendarUrl, setExternalCalendarUrl] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState(null);

  const closeModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
    setShowEvaluationModal(false);
    setAnswers({});
    setErrorMessage("");
    setSubmitSuccess(false);
  };

  const fetchCalendarData = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/hp-data?userId=${userName}`
      );
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
          }
        );
        const data = await response.json();

        if (data.exists) {
          fetchCalendarData();
        }
      } catch (error) {
        console.error(
          "Erreur lors de la vérification de l'utilisateur:",
          error
        );
      }
    };

    if (userName) {
      checkExistingCalendar();
    }
  }, [userName, fetchCalendarData]);

  useEffect(() => {
    const fetchEvaluationConfig = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/eva/config`,
          {
            method: "GET",
            credentials: "include", // Indispensable pour que le cookie de session soit envoyé
          }
        );
        if (!response.ok) {
          throw new Error("Configuration non disponible");
        }
        const data = await response.json();
        setEvaluationConfig(data);
      } catch (error) {
        console.error(
          "Erreur lors de la récupération de la configuration:",
          error
        );
        setErrorMessage("Configuration d'évaluation non disponible");
      }
    };

    if (userName) {
      fetchEvaluationConfig();
    }
  }, [userName]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  // Ajouter un effet pour scroller au bouton quand l'évaluation est ouverte
  useEffect(() => {
    if (showEvaluationModal) {
      setTimeout(() => {
        document
          .getElementById("submitButton")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100); // Petit délai pour laisser le modal s'afficher
    }
  }, [showEvaluationModal]);

  // Utiliser useMemo pour le parsing des événements
  const events = useMemo(() => {
    return parseICalData(icalData);
  }, [icalData]);

  const handleSelectEvent = async (event) => {
    // Si c'est un événement spécial (déterminé par le fait qu'il n'a pas de propriété 'start'),
    // ne pas ouvrir le modal
    if (!event.start) {
      return;
    }

    setAnswers({});
    setErrorMessage("");
    setSubmitSuccess(false);

    setSelectedEvent(event);

    // Si c'est un événement partagé, ne pas permettre l'évaluation
    if (event.className?.includes("shared")) {
      setHasEvaluated(true); // Utiliser hasEvaluated pour masquer le bouton d'évaluation
      setShowModal(true);
      return;
    }

    try {
      const cleanTitle = event.title.split("\n")[0];
      const response = await fetch(
        `${
          process.env.REACT_APP_URL_BACK
        }/api/eva/check?eventTitle=${encodeURIComponent(cleanTitle)}`,
        {
          method: "GET",
          credentials: "include", // Indispensable pour que le cookie de session soit envoyé
        }
      );
      const data = await response.json();
      setHasEvaluated(data.hasEvaluated);
    } catch (error) {
      console.error("Erreur lors de la vérification:", error);
    }
    setShowModal(true);
  };

  const handleEvaluate = () => {
    if (!hasEvaluated) {
      // Vérifier si l'événement est passé
      const eventEndTime = moment(selectedEvent.end);
      const now = moment();

      if (eventEndTime.isAfter(now)) {
        setErrorMessage(
          "Vous ne pouvez évaluer que les enseignements terminés"
        );
        return;
      }

      // Vérifier d'abord si une configuration existe pour le groupe
      fetch(`${process.env.REACT_APP_URL_BACK}/api/eva/config`, {
        method: "GET",
        credentials: "include", // Indispensable pour que le cookie de session soit envoyé
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              "Pas de configuration disponible pour votre groupe"
            );
          }
          return response.json();
        })
        .then((config) => {
          if (config && config.questions && config.questions.length > 0) {
            setAnswers({});
            setErrorMessage("");
            setSubmitSuccess(false);
            setShowEvaluationModal(true);
            setShowModal(false);
          } else {
            setErrorMessage(
              "L'évaluation n'est pas disponible pour votre groupe"
            );
          }
        })
        .catch((error) => {
          setErrorMessage(error.message);
        });
    }
  };

  const handleAnswerChange = (questionId, value, maxLength) => {
    if (typeof value === "string" && maxLength) {
      value = value.substring(0, maxLength);
    }

    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const submitEvaluation = async () => {
    const missingRequired = evaluationConfig.questions
      .filter((q) => q.required)
      .some((q) => !answers[q.id]);

    if (missingRequired) {
      setErrorMessage("Les questions marquées d'un * sont obligatoires");
      // Scroll jusqu'au message d'erreur
      document
        .querySelector(".error-message")
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const cleanTitle = selectedEvent.title.split("\n")[0];

    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/eva`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventTitle: cleanTitle,
            answers,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi");
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setShowEvaluationModal(false);
        setErrorMessage("");
        setAnswers({});
        setSubmitSuccess(false);
      }, 1500);
    } catch (error) {
      setErrorMessage(
        error.message || "Une erreur est survenue. Veuillez réessayer."
      );
    }
  };

  // Mémoisation des heures et jours
  const hours = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 8), []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) =>
      moment(currentDate).startOf("week").add(i, "days")
    );
  }, [currentDate]);

  // Optimisation du calcul des événements par cellule
  const getEventsForCell = useCallback(
    (day, hour) => {
      const allEvents = [...(events || []), ...sharedEvents];
      if (!allEvents?.length) return [];

      const cellStart = moment(day).hour(hour).minute(0);
      const cellEnd = moment(day)
        .hour(hour + 1)
        .minute(0);

      // Filtrer d'abord tous les événements de cette cellule
      const cellEvents = allEvents
        .filter((event) => {
          const eventStart = moment(event.start);
          const eventEnd = moment(event.end);
          return eventStart.isBefore(cellEnd) && eventEnd.isAfter(cellStart);
        })
        .map((event) => {
          const eventStart = moment(event.start);
          const startHour = eventStart.hour() + eventStart.minute() / 60;
          const endHour =
            moment(event.end).hour() + moment(event.end).minute() / 60;

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
    [events, sharedEvents]
  );

  // Mémoisation des colonnes du calendrier
  const DayColumn = React.memo(
    ({ day, hours, getEventsForCell, handleSelectEvent, isMobile }) => {
      return (
        <div className="day-column">
          <div className="day-header">
            {isMobile ? day.format("dddd DD/MM") : day.format("ddd DD/MM")}
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
    }
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
              )
          )}
        </div>
      );
    }
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

    return (
      <div
        className={`calendar-event ${event.className}`}
        onClick={() => handleSelectEvent(event)}
        style={style}
        title={event.sharedBy ? `Partagé par ${event.sharedBy}` : undefined}
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
      </div>
    );
  });

  const navigateWeek = (direction) => {
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
          : moment(prev).subtract(1, "week")
      );
    }
  };

  const getCurrentAcademicYear = (date) => {
    const month = date.month();
    const year = date.year();
    // Si on est entre août et décembre, on est dans l'année académique qui commence
    // Si on est entre janvier et juillet, on est dans l'année académique qui a commencé l'année précédente
    return month >= 7 ? year : year - 1;
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

  const handleMonthSelect = (monthOffset) => {
    setCurrentDate((prev) => moment(prev).add(monthOffset, "months"));
    setShowMonthPicker(false);
  };

  const goToToday = () => {
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
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/users`
        );
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
          fetch(`${process.env.REACT_APP_URL_BACK}/api/professors`),
          fetch(`${process.env.REACT_APP_URL_BACK}/api/rooms`),
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
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/hp-data?userId=${userId}`
      );
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

  const fetchExternalCalendar = async (icalLink, displayName) => {
    try {
      const response = await fetch(
        `${
          process.env.REACT_APP_URL_BACK
        }/api/external-calendar?icalLink=${encodeURIComponent(icalLink)}`
      );
      if (!response.ok)
        throw new Error("Erreur lors de la récupération du calendrier");
      const data = await response.text();
      const parsedEvents = parseICalData(data).map((event) => ({
        ...event,
        className: `${event.className} shared`,
        sharedBy: displayName,
      }));
      setSharedEvents(parsedEvents);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const fetchCalendarByName = async (name, type) => {
    try {
      const response = await fetch(
        `${
          process.env.REACT_APP_URL_BACK
        }/api/calendar/${type}/${encodeURIComponent(name)}`
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
      matchesSearch(u.group ?? "", searchQuery)
  );

  const filteredProfessors = professors.filter((p) =>
    matchesSearch(p.prof, searchQuery)
  );

  const filteredRooms = rooms.filter((r) => {
    // Si aucune recherche, on renvoie toutes les salles
    if (!searchQuery) return true;
    return r.salle && matchesSearch(r.salle, searchQuery);
  });

  // Vérifier si l'utilisateur est admin
  useEffect(() => {
    if (userName && admin.includes(userName)) {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }, [userName]);

  // Méthode pour formater les événements spéciaux
  const formattedSpecialEvents = useMemo(() => {
    if (!isAdmin) return [];

    let result = [];
    specialEvents.forEach((event, index) => {
      if (event.events) {
        // Format avec sous-événements
        event.events.forEach((subEvent, subIndex) => {
          const eventId = `event-${index}-${subIndex}`;

          // Extraire l'heure du début si disponible
          let hour = 12; // Valeur par défaut à midi
          let minute = 0;

          if (subEvent.time) {
            const timeMatch = subEvent.time.match(/^(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              hour = parseInt(timeMatch[1]);
              minute = parseInt(timeMatch[2]);
            } else {
              // Si le format est "HH:MM-HH:MM"
              const timeRangeMatch = subEvent.time.match(
                /^(\d{1,2}):?(\d{2})?-/
              );
              if (timeRangeMatch) {
                hour = parseInt(timeRangeMatch[1]);
                minute = timeRangeMatch[2] ? parseInt(timeRangeMatch[2]) : 0;
              }
            }
          }

          result.push({
            id: eventId,
            name: subEvent.name,
            subname: subEvent.subname || null,
            date: moment(event.date),
            time: subEvent.time || null,
            location: subEvent.location || null,
            theme: subEvent.theme || null,
            hour,
            minute,
          });
        });
      } else {
        // Format événement simple
        const eventId = `event-${index}`;

        // Extraire l'heure du début si disponible
        let hour = 12; // Valeur par défaut à midi
        let minute = 0;

        if (event.time) {
          const timeMatch = event.time.match(/^(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            hour = parseInt(timeMatch[1]);
            minute = parseInt(timeMatch[2]);
          } else {
            // Si le format est "HH:MM-HH:MM"
            const timeRangeMatch = event.time.match(/^(\d{1,2}):?(\d{2})?-/);
            if (timeRangeMatch) {
              hour = parseInt(timeRangeMatch[1]);
              minute = timeRangeMatch[2] ? parseInt(timeRangeMatch[2]) : 0;
            }
          }
        }

        result.push({
          id: eventId,
          name: event.name,
          date: moment(event.date),
          time: event.time || null,
          location: event.location || null,
          hour,
          minute,
        });
      }
    });

    return result;
  }, [isAdmin]);

  // Filtrer les événements visibles pour la semaine courante
  const visibleSpecialEvents = useMemo(() => {
    if (!formattedSpecialEvents.length) return [];

    // Obtenir les jours actuellement visibles
    const visibleDays = isMobile
      ? [currentDate.format("YYYY-MM-DD")] // Sur mobile, seulement le jour actuel
      : weekDays.map((day) => day.format("YYYY-MM-DD")); // Sur desktop, les 5 jours de la semaine

    // Inclure les weekends qui touchent à la semaine visible
    // (pour afficher les bulles qui doivent apparaître sur les bords)
    const startOfVisibleWeek = moment(visibleDays[0])
      .subtract(1, "day")
      .format("YYYY-MM-DD");
    const endOfVisibleWeek = moment(visibleDays[visibleDays.length - 1])
      .add(1, "day")
      .format("YYYY-MM-DD");

    return formattedSpecialEvents.filter((event) => {
      const eventDate = event.date.format("YYYY-MM-DD");
      // Garder les événements du jour visible ou weekend adjacent
      const isVisible = visibleDays.includes(eventDate);
      const isAdjacentWeekend =
        (event.date.day() === 0 || event.date.day() === 6) &&
        (eventDate === startOfVisibleWeek || eventDate === endOfVisibleWeek);

      return isVisible || isAdjacentWeekend;
    });
  }, [formattedSpecialEvents, currentDate, isMobile, weekDays]);

  // Calculer la position des pastilles d'événements
  const getEventBubblePosition = useCallback(
    (event) => {
      const dayOfWeek = event.date.day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayIndex = isWeekend
        ? dayOfWeek === 0
          ? 0
          : 4 // Dimanche à gauche, Samedi à droite
        : dayOfWeek - 1; // Lundi=0, Mardi=1, etc.

      // Position initiale basée sur le jour
      let position = {
        top: "0px",
        left: "0px",
      };

      // Ajuster l'heure pour les événements trop tôt ou trop tard
      let adjustedHour = event.hour;
      let adjustedMinute = event.minute;

      // Avant 8h, positionner un peu plus bas que le haut
      if (adjustedHour < 8) {
        adjustedHour = 8;
        adjustedMinute = 5; // Un peu après le début de 8h
      }

      // Après 18h (fin du calendrier), positionner un peu plus haut que la fin
      if (adjustedHour >= 18) {
        adjustedHour = 17;
        adjustedMinute = 45; // Un peu avant la fin de 17h
      }

      // Sur mobile, on positionne différemment
      if (isMobile) {
        // Vérifier si l'événement est aujourd'hui
        if (event.date.isSame(currentDate, "day")) {
          const hourOffset = adjustedHour - 8; // 8h est l'heure de début
          const minutePercent = adjustedMinute / 60;
          const topPosition = hourOffset + minutePercent;

          position = {
            top: `${topPosition * 45 + 30}px`, // 45px par heure + 30px pour le header
            right: "12px",
            left: "auto",
          };
        } else {
          // Si pas aujourd'hui, positionner au bord
          const isBefore = event.date.isBefore(currentDate, "day");
          position = isBefore
            ? { top: "50px", left: "12px" }
            : { bottom: "50px", right: "12px", top: "auto", left: "auto" };
        }
        return position;
      }

      // Pour desktop
      if (isWeekend) {
        // Positionner les événements du weekend près des jours ouvrable proches
        // (vendredi ou lundi)
        const hourOffset = adjustedHour - 8; // 8h est l'heure de début
        const minutePercent = adjustedMinute / 60;
        const topPosition = hourOffset + minutePercent;

        position = {
          top: `${30 + topPosition * 45}px`,
          // Dimanche à gauche du calendrier, samedi à droite
          left: dayOfWeek === 0 ? "-16px" : "calc(100% + 8px)",
        };
      } else {
        // Pour les jours visibles, positionner dans la cellule correspondante
        const columnIndex = dayOfWeek - 1; // Lundi=0, Mardi=1, etc
        const cellWidth = 100 / 5; // 5 jours visibles

        const hourOffset = adjustedHour - 8; // 8h est l'heure de début
        const minutePercent = adjustedMinute / 60;
        const topPosition = hourOffset + minutePercent;

        position = {
          top: `${30 + topPosition * 45}px`,
          left: `${60 + columnIndex * cellWidth}%`, // 60px pour la colonne des heures
        };
      }

      return position;
    },
    [currentDate, isMobile]
  );

  // Composant pour les pastilles d'événements
  const EventBubble = ({ event }) => {
    const position = getEventBubblePosition(event);
    const isHovered = hoveredEventId === event.id;

    // Déterminer si l'événement est en dehors des heures normales
    const isOutOfHours = event.hour < 8 || event.hour >= 18;

    const handleClick = () => {
      setSelectedEvent({
        title: event.name,
        subname: event.subname,
        date: event.date,
        time: event.time,
        location: event.location,
        theme: event.theme,
        isSpecialEvent: true,
        outOfHours: isOutOfHours,
      });
      setShowModal(true);
    };

    return (
      <div
        className={`event-bubble ${isHovered ? "hovered" : ""} ${
          event.date.day() === 0 || event.date.day() === 6 ? "weekend" : ""
        } ${isOutOfHours ? "out-of-hours" : ""}`}
        style={position}
        onMouseEnter={() => setHoveredEventId(event.id)}
        onMouseLeave={() => setHoveredEventId(null)}
        onClick={handleClick}
      >
        {isHovered ? (
          <div className="event-bubble-hover">
            <div className="event-bubble-title">{event.name}</div>
            {event.subname && (
              <div className="event-bubble-subtitle">{event.subname}</div>
            )}
            {event.time && (
              <div className="event-bubble-time">
                <Clock size={12} /> {event.time}
                {isOutOfHours && <span className="time-note">*</span>}
              </div>
            )}
            {event.location && (
              <div className="event-bubble-location">
                <MapPin size={12} /> {event.location}
              </div>
            )}
            {event.theme && (
              <div className="event-bubble-theme">
                <Music size={12} /> {event.theme}
              </div>
            )}
          </div>
        ) : (
          <div className="event-bubble-icon">
            <Star size={12} />
          </div>
        )}
      </div>
    );
  };

  // Add search debouncing
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      const results = filterSearchResults();
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add helper function for search
  const filterSearchResults = () => {
    switch (selectedCategory) {
      case "students":
        return filteredUsers;
      case "professors":
        return filteredProfessors;
      case "rooms":
        return filteredRooms;
      default:
        return [];
    }
  };

  // Modifier le renderModals pour gérer les événements spéciaux
  const renderModals = () => {
    if (!showModal && !showEvaluationModal) return null;

    return ReactDOM.createPortal(
      <>
        {showModal && selectedEvent && !selectedEvent.isSpecialEvent && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Détails de l'événement</h2>

              <div className="event-details">
                <div className="event-main-title">{selectedEvent.title}</div>

                <div className="detail-row type-detail">
                  <div className="icon-container">
                    <BookOpen />
                  </div>
                  <div className="detail-content">
                    <div className="label">Type de cours</div>
                    <div className="value">{selectedEvent.courseType}</div>
                  </div>
                </div>

                {selectedEvent.professor && (
                  <div className="detail-row professor-detail">
                    <div className="icon-container">
                      <GraduationCap />
                    </div>
                    <div className="detail-content">
                      <div className="label">Professeur</div>
                      <div className="value">{selectedEvent.professor}</div>
                    </div>
                  </div>
                )}

                {selectedEvent.location && (
                  <div className="detail-row location-detail">
                    <div className="icon-container">
                      <MapPin />
                    </div>
                    <div className="detail-content">
                      <div className="label">Salle</div>
                      <div className="value">{selectedEvent.location}</div>
                    </div>
                  </div>
                )}
              </div>

              {selectedEvent.className?.includes("shared") ? (
                <div className="evaluation-notice">
                  Vous ne pouvez pas évaluer les cours de quelqu'un d'autre
                </div>
              ) : (
                <>
                  {errorMessage ? (
                    <div className="error-message">{errorMessage}</div>
                  ) : hasEvaluated ? (
                    <div className="evaluation-notice">
                      Vous avez déjà évalué cet enseignement
                    </div>
                  ) : (
                    <button onClick={handleEvaluate}>Évaluer</button>
                  )}
                </>
              )}
              <button onClick={closeModal}>Fermer</button>
            </div>
          </div>
        )}

        {/* Code existant pour le modal d'évaluation */}
        {showEvaluationModal && evaluationConfig && (
          <div className="modal-overlay" onClick={closeModal}>
            <div
              className="modal-content evaluation"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Évaluation de l'enseignement</h2>
              <div className="required-notice">* Questions obligatoires</div>
              {evaluationConfig.questions.map((question) => (
                <div key={question.id} className="question">
                  <label className={question.required ? "required" : ""}>
                    {question.text}
                    {question.required && " *"}
                  </label>
                  {question.type === "likert" ? (
                    <div className="likert-scale horizontal">
                      {question.options.map((option, index) => (
                        <label key={index}>
                          <input
                            type="radio"
                            name={`question_${question.id}`}
                            value={index}
                            onChange={() =>
                              handleAnswerChange(question.id, index)
                            }
                            checked={answers[question.id] === index}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      maxLength={question.maxLength}
                      value={answers[question.id] || ""}
                      onChange={(e) =>
                        handleAnswerChange(
                          question.id,
                          e.target.value,
                          question.maxLength
                        )
                      }
                      placeholder={`Votre réponse... ${
                        question.required ? "(obligatoire)" : "(optionnel)"
                      } (${question.maxLength} caractères max)`}
                    />
                  )}
                </div>
              ))}
              {errorMessage && (
                <div className="error-message">{errorMessage}</div>
              )}
              {submitSuccess && (
                <div className="success-message">
                  ✓ Évaluation enregistrée avec succès !
                </div>
              )}
              <button
                id="submitButton"
                onClick={submitEvaluation}
                className={submitSuccess ? "success" : ""}
              >
                {submitSuccess ? "✓ Envoyé" : "Envoyer"}
              </button>
            </div>
          </div>
        )}
      </>,
      document.body
    );
  };

  return (
    <div className="hp-calendar">
      <div className="calendar-header">
        <div className="navigation-controls">
          <button
            onClick={() => navigateWeek("prev")}
            title="Semaine précédente"
          >
            <ArrowLeft />
          </button>
          <button onClick={goToToday} className="today-btn" title="Aujourd'hui">
            Aujourd'hui
          </button>
          <div
            className="month-selector"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
          >
            <h2>
              {currentDate.format("MMMM")} <CircleChevronDown size={18} />
            </h2>
            {showMonthPicker && (
              <div
                className={`month-picker ${showMonthPicker ? "" : "hiding"}`}
              >
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
          </div>
          <button onClick={() => navigateWeek("next")} title="Semaine suivante">
            <ArrowRight />
          </button>
        </div>
        <div className="user-selector">
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              className="search-input"
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
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUser(null);
                  setSharedEvents([]);
                  setSearchQuery("");
                }}
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "none",
                  border: "none",
                  padding: "4px",
                  cursor: "pointer",
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
      </div>
      <div className="calendar-grid">
        <div className="time-column">
          <div className="corner-header"></div>
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
            />
          ))
        )}

        {/* Ajouter les événements spéciaux sous forme de pastilles */}
        {isAdmin &&
          visibleSpecialEvents.map((event) => (
            <EventBubble key={event.id} event={event} />
          ))}
      </div>

      {renderModals()}
    </div>
  );
};

export default HpCalendar;
