import ICAL from "ical.js";
import moment from "moment";
import "moment/locale/fr";
import React, { useEffect, useState, useContext } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import { UserContext } from "../App";
import "react-big-calendar/lib/css/react-big-calendar.css";

moment.locale("fr");
const localizer = momentLocalizer(moment);

const messages = {
  next: "Suivant",
  previous: "Précédent",
  today: "Aujourd'hui",
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
    return today.add(2, 'days').toDate();
  } else if (dayOfWeek === 0) {
    return today.add(1, 'days').toDate();
  }
  
  return today.toDate();
};

const HpCalendar = () => {
  const [events, setEvents] = useState([]);
  const [icalData, setIcalData] = useState("");
  const [icalLink, setIcalLink] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [currentDate, setCurrentDate] = useState(getInitialDate());
  const { userName } = useContext(UserContext);

  useEffect(() => {
    if (userName) {
      checkExistingCalendar();
    }
  }, [userName]);

  useEffect(() => {
    if (icalData) {
      try {
        const parsedEvents = parseICal(icalData);
        setEvents(parsedEvents);
      } catch (error) {
        console.error("Erreur lors du parsing des données iCal:", error);
        setEvents([]);
      }
    }
  }, [icalData]);

  const checkExistingCalendar = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/check-user/${userName}`);
      const data = await response.json();

      if (data.exists) {
        // User has already registered their calendar, fetch iCal data
        setIsAuthenticated(true);
        fetchCalendarData(userName);
      } else {
        // First-time user, show the input form for iCal link
        setShowLinkInput(true);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de l'utilisateur:", error);
    }
  };

  const fetchCalendarData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/hp-data?userId=${userName}`);
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données');
      }
      const data = await response.text();
      setIcalData(data);
    } catch (error) {
      console.error("Erreur lors de la récupération du fichier iCal :", error);
      setIsAuthenticated(false);
      setShowLinkInput(true);
    }
  };

  const handleSubmitLink = async (e) => {
    e.preventDefault();
    setLinkError("");

    try {
      const validationResponse = await fetch(`${process.env.REACT_APP_URL_BACK}/api/validate-ical`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ icalLink }),
      });

      const validationData = await validationResponse.json();

      if (!validationData.isValid) {
        setLinkError("Le lien fourni n'est pas un calendrier iCal valide. Veuillez réessayer.");
        return;
      }

      // Save the user's iCal link
      await fetch(`${process.env.REACT_APP_URL_BACK}/api/save-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userName, icalLink }),
      });

      setIsAuthenticated(true);
      fetchCalendarData();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du lien:", error);
      setLinkError("Une erreur est survenue. Veuillez réessayer.");
    }
  };

  const parseICal = (icalData) => {
    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    return vevents.map((vevent) => {
      const summary = vevent.getFirstPropertyValue("summary");
      const location = vevent.getFirstPropertyValue("location");
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

      return {
        title: <span data-content={eventTitle}>{eventTitle}</span>,
        start: dtstart,
        end: dtend,
        className: className,
      };
    });
  };

  const getNextWorkday = (date) => {
    const nextDay = moment(date).add(1, 'days');
    if (nextDay.day() === 6) { // Si c'est samedi
      return nextDay.add(2, 'days'); // Aller à lundi
    } else if (nextDay.day() === 0) { // Si c'est dimanche
      return nextDay.add(1, 'days'); // Aller à lundi
    }
    return nextDay;
  };

  const getPreviousWorkday = (date) => {
    const prevDay = moment(date).subtract(1, 'days');
    if (prevDay.day() === 6) { // Si c'est samedi
      return prevDay.subtract(1, 'days'); // Aller à vendredi
    } else if (prevDay.day() === 0) { // Si c'est dimanche
      return prevDay.subtract(2, 'days'); // Aller à vendredi
    }
    return prevDay;
  };

  const handleNavigate = (newDate, view, action) => {
    if (window.innerWidth < 768 && view === 'day') {
      let adjustedDate = moment(newDate);

      switch(action) {
        case 'NEXT':
          adjustedDate = getNextWorkday(currentDate);
          break;
        case 'PREV':
          adjustedDate = getPreviousWorkday(currentDate);
          break;
        case 'TODAY':
          // Si aujourd'hui est un weekend, aller au prochain jour ouvré
          if (adjustedDate.day() === 0) { // Dimanche
            adjustedDate.add(1, 'days');
          } else if (adjustedDate.day() === 6) { // Samedi
            adjustedDate.add(2, 'days');
          }
          break;
        default:
          // Vérifier que le jour est un jour ouvré
          if (adjustedDate.day() === 0) { // Dimanche
            adjustedDate.add(1, 'days');
          } else if (adjustedDate.day() === 6) { // Samedi
            adjustedDate.subtract(1, 'days');
          }
      }

      setCurrentDate(adjustedDate.toDate());
    } else {
      setCurrentDate(newDate);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        {showLinkInput ? (
          <form onSubmit={handleSubmitLink} className="auth-form">
            <h2>C'est votre première visite !</h2>
            <h3>Sur votre Hypperplanning, veuillez exporter le lien de votre calendrier</h3>
            <img
              src={process.env.PUBLIC_URL + "/ical-destock.jpg"}
              className="ical-destock"
              alt="Lien de votre calendrier"
            />
            <div className="input-group">
              <input
                type="text"
                value={icalLink}
                onChange={(e) => setIcalLink(e.target.value)}
                placeholder="Entrez le lien de votre calendrier"
                required
              />
              {linkError && <div className="error-message">{linkError}</div>}
            </div>
            <button type="submit">Enregistrer</button>
          </form>
        ) : (
          <div>Chargement...</div>
        )}
      </div>
    );
  }

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
        onSelectEvent={(event) => window.alert(event.title.props.children)}
        eventPropGetter={(event) => ({
          className: event.className,
        })}
        date={currentDate}
        onNavigate={handleNavigate}
      />
    </div>
  );
};

export default HpCalendar;