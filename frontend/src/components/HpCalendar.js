import ICAL from "ical.js";
import moment from "moment";
import "moment/locale/fr";
import React, { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
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

const HpCalendar = () => {
  const [events, setEvents] = useState([]);
  const [icalData, setIcalData] = useState("");
  const [userId, setUserId] = useState("");
  const [icalLink, setIcalLink] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetchCalendarData();
    }
  }, [isAuthenticated, userId]);

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

  const fetchCalendarData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/hp-data?userId=${userId}`);
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

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/check-user/${userId}`);
      const data = await response.json();
      
      if (data.exists) {
        setIsAuthenticated(true);
      } else {
        setShowLinkInput(true);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de l'utilisateur:", error);
    }
  };

  const handleSubmitLink = async (e) => {
    e.preventDefault();
    setLinkError("");

    try {
      // Vérifie d'abord si le lien est valide
      const validationResponse = await fetch(`${process.env.REACT_APP_URL_BACK}/api/validate-ical`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ icalLink }),
      });

      const validationData = await validationResponse.json();

      if (!validationData.isValid) {
        setLinkError("Le lien fourni n'est pas un calendrier iCal valide. Veuillez réessayer.");
        return;
      }

      // Si le lien est valide, sauvegarde l'utilisateur
      await fetch(`${process.env.REACT_APP_URL_BACK}/api/save-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, icalLink }),
      });
      
      setIsAuthenticated(true);
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

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        {!showLinkInput ? (
          <form onSubmit={handleLogin} className="auth-form">
            <h2>Accéder à votre emploi du temps</h2>
            <div className="input-group">
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Entrez votre identifiant ent"
                required
              />
            </div>
            <button type="submit">Connexion</button>
          </form>
        ) : (
          <form onSubmit={handleSubmitLink} className="auth-form">
            <h2>C'est votre première visite !</h2>
            <h3>Sur votre Hypperplanning, veuillez exporter le lien de votre calendrier</h3>
            <img src={process.env.PUBLIC_URL + "/ical-destock.jpg"} className="ical-destock" alt="Lien de votre calendrier" />
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
      />
    </div>
  );
};

export default HpCalendar;