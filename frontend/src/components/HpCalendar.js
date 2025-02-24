import ICAL from "ical.js";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  CircleChevronDown,
  DoorClosed,
  GraduationCap,
  MapPin,
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

  // Ajouter cette fonction juste avant le return du composant HpCalendar
  const renderModals = () => {
    if (!showModal && !showEvaluationModal) return null;

    return ReactDOM.createPortal(
      <>
        {showModal && selectedEvent && (
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

              {/* ... reste du code du modal ... */}
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
      </div>

      {renderModals()}
    </div>
  );
};

export default HpCalendar;
