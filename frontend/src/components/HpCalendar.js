import ICAL from "ical.js";
import { ArrowLeft, ArrowRight, Undo2, Star } from "lucide-react";
import moment from "moment";
import "moment/locale/fr";
import React, { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { UserContext } from "../App";

moment.locale("fr");
const localizer = momentLocalizer(moment);

const messages = {
  next: <ArrowRight />,
  previous: <ArrowLeft />,
  today: <Undo2 />,
  month: "Mois",
  week: "Semaine",
  day: "Jour",
  agenda: "Agenda",
  date: "Date",
  time: "Heure",
  event: "Événement",
  noEventsInRange: "Aucun événement dans cette plage biloute",
  showMore: (total) => `+ ${total} plus`,
};

const getInitialDate = () => {
  const today = moment();
  const dayOfWeek = today.day();

  // Si c'est samedi (6) ou dimanche (0), aller au lundi suivant
  if (dayOfWeek === 6) {
    return today.add(2, "days").toDate();
  } else if (dayOfWeek === 0) {
    return today.add(1, "days").toDate();
  }

  return today.toDate();
};

const parseICal = (icalData) => {
  const jcalData = ICAL.parse(icalData);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");

  return vevents.map((vevent) => {
    const summary = vevent.getFirstPropertyValue("summary") || "";
    const location = vevent.getFirstPropertyValue("location") || "";
    const dtstart = vevent.getFirstPropertyValue("dtstart").toJSDate();
    const dtend = vevent.getFirstPropertyValue("dtend").toJSDate();

    const eventDetails = [summary, location].filter(Boolean);

    const eventTitle = eventDetails
      .join(" ")
      .replace(/\s*-\s*/g, (match, offset, string) => {
        const occurrences = string.slice(0, offset).match(/\s*-\s*/g) || [];
        return occurrences.length < 2 ? "\n" : match;
      })
      .replace(/(TD|Séminaire|CB|sem.|TP)/g, "$1\n");
      
    const isTNE = eventTitle.includes("TNE");
    const isCB = eventTitle.includes("CB");

    let className = "";
    if (isTNE) className = "tne-event";
    else if (isCB) className = "cb-event";

    const processedSummary = summary.replace(/-/g, '\n');

    return {
      title: processedSummary,
      location: location,
      start: dtstart,
      end: dtend,
      className: className,
    };
  });
};

const CustomEvent = ({ event }) => (
  <div>
    {event.title.split('\n').map((line, index) => (
      <div key={index}>{line}</div>
    ))}
    {event.location && (
      <div>
        <b>{event.location}</b>
      </div>
    )}
  </div>
);

const HpCalendar = () => {
  const [icalData, setIcalData] = useState("");
  const [currentDate, setCurrentDate] = useState(getInitialDate());
  const { userName, displayName } = useContext(UserContext);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
          `${process.env.REACT_APP_URL_BACK}/api/check-user/${userName}`
        );
        const data = await response.json();

        if (data.exists) {
          fetchCalendarData();
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de l'utilisateur:", error);
      }
    };

    if (userName) {
      checkExistingCalendar();
    }
  }, [userName, fetchCalendarData]);

  const events = useMemo(() => {
    if (icalData) {
      try {
        return parseICal(icalData);
      } catch (error) {
        console.error("Erreur lors du parsing des données iCal:", error);
        return [];
      }
    }
    return [];
  }, [icalData]);

  const getNextWorkday = (date) => {
    const nextDay = moment(date).add(1, "days");
    if (nextDay.day() === 6) {
      // Si c'est samedi
      return nextDay.add(2, "days"); // Aller à lundi
    } else if (nextDay.day() === 0) {
      // Si c'est dimanche
      return nextDay.add(1, "days"); // Aller à lundi
    }
    return nextDay;
  };

  const getPreviousWorkday = (date) => {
    const prevDay = moment(date).subtract(1, "days");
    if (prevDay.day() === 6) {
      // Si c'est samedi
      return prevDay.subtract(1, "days"); // Aller à vendredi
    } else if (prevDay.day() === 0) {
      // Si c'est dimanche
      return prevDay.subtract(2, "days"); // Aller à vendredi
    }
    return prevDay;
  };

  const handleNavigate = (newDate, view, action) => {
    if (window.innerWidth < 768 && view === "day") {
      let adjustedDate = moment(newDate);

      switch (action) {
        case "NEXT":
          adjustedDate = getNextWorkday(currentDate);
          break;
        case "PREV":
          adjustedDate = getPreviousWorkday(currentDate);
          break;
        case "TODAY":
          // Si aujourd'hui est un weekend, aller au prochain jour ouvré
          if (adjustedDate.day() === 0) {
            // Dimanche
            adjustedDate.add(1, "days");
          } else if (adjustedDate.day() === 6) {
            // Samedi
            adjustedDate.add(2, "days");
          }
          break;
        default:
          // Vérifier que le jour est un jour ouvré
          if (adjustedDate.day() === 0) {
            // Dimanche
            adjustedDate.add(1, "days");
          } else if (adjustedDate.day() === 6) {
            // Samedi
            adjustedDate.subtract(1, "days");
          }
      }

      setCurrentDate(adjustedDate.toDate());
    } else {
      setCurrentDate(newDate);
    }
  };

  const handleSelectEvent = async (event) => {
    setSelectedEvent(event);
    // Supprimer la condition pour tous les événements
    try {
      const cleanTitle = event.title.split('\n')[0];  // Prendre uniquement la première partie
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/eva/check?userName=${displayName}&eventTitle=${encodeURIComponent(
          cleanTitle
        )}`
      );
      const data = await response.json();
      setHasEvaluated(data.hasEvaluated);
    } catch (error) {
      console.error("Erreur lors de la vérification:", error);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
  };

  const handleEvaluate = async () => {
    if (hasEvaluated) {
      try {
        const cleanTitle = selectedEvent.title.split('\n')[0];
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/eva/get?userName=${displayName}&eventTitle=${encodeURIComponent(
            cleanTitle
          )}`
        );
        const data = await response.json();
        setRating(data.rating);
        setComment(data.comment);
      } catch (error) {
        console.error("Erreur lors de la récupération:", error);
      }
    } else {
      setRating(0);
      setComment("");
    }
    setShowEvaluationModal(true);
    setShowModal(false);
  };

  const submitEvaluation = async () => {
    if (rating === 0) {
      setErrorMessage("Veuillez sélectionner au moins une étoile.");
      return;
    }

    const cleanTitle = selectedEvent.title.split('\n')[0];
  
    try {
      await fetch(`${process.env.REACT_APP_URL_BACK}/api/eva`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userName: displayName,
          eventTitle: cleanTitle,
          rating,
          comment,
        }),
      });
      setShowEvaluationModal(false);
      setErrorMessage("");
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'évaluation:", error);
      setErrorMessage("Une erreur est survenue. Veuillez réessayer.");
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          onClick={() => setRating(i)}
          className={i <= rating ? 'active' : ''}
          fill={i <= rating ? "#FFD700" : "none"}
          stroke={i <= rating ? "#FFD700" : "#000"}
          style={{ cursor: "pointer" }}
        />
      );
    }
    return stars;
  };

  return (
    <div className="hp-calendar">
      <Calendar
        localizer={localizer}
        events={events}
        style={{ height: 500 }}
        messages={messages}
        min={new Date(1970, 1, 1, 8, 0)}
        max={new Date(1970, 1, 1, 17, 45)}
        defaultView={window.innerWidth < 768 ? "day" : "work_week"}
        views={[window.innerWidth < 768 ? "day" : "work_week"]}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={(event) => ({
          className: event.className,
        })}
        date={currentDate}
        onNavigate={handleNavigate}
        components={{
          event: CustomEvent,
        }}
      />
      {showModal && selectedEvent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Détails de l'événement</h2>
            {selectedEvent.title.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
            {selectedEvent.location && (
              <div>
                <b>{selectedEvent.location}</b>
              </div>
            )}
            {hasEvaluated && (
              <div>Vous avez déjà évalué cet enseignement.</div>
            )}
            <button onClick={handleEvaluate}>
              {hasEvaluated ? "Modifier votre évaluation" : "Évaluer"}
            </button>
            <button onClick={closeModal}>Fermer</button>
          </div>
        </div>
      )}
      {showEvaluationModal && (
        <div className="modal-overlay" onClick={() => setShowEvaluationModal(false)}>
          <div className="modal-content evaluation" onClick={(e) => e.stopPropagation()}>
            <h2>Noter l'enseignement</h2>
            <div className="rating">
              {renderStars()}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Laisser un commentaire"
            />
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            <button onClick={submitEvaluation}>Envoyer</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HpCalendar;