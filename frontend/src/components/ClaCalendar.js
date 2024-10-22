import ICAL from "ical.js";
import moment from "moment";
import "moment/locale/fr";
import React, { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/ClaCalendar.scss";
import { ArrowLeft, ArrowRight } from "lucide-react";

moment.locale("fr");

const localizer = momentLocalizer(moment);

const messages = {
  next: <ArrowRight />,
  previous: <ArrowLeft />,
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

const ClaCalendar = () => {
  const [events, setEvents] = useState([]);
  const [icalData, setIcalData] = useState(null);


  useEffect(() => {
    fetch(`${process.env.REACT_APP_URL_BACK}/api/cla-data`)
        .then(response => response.text())
        .then(data => {
            setIcalData(data);
        })
        .catch(error => console.error("Erreur lors de la récupération du fichier iCal :", error));
}, []);

  useEffect(() => {
    if (icalData) {
      const parsedEvents = parseICal(icalData);
      setEvents(parsedEvents);
    }
  }, [icalData]);

  const parseICal = (icalData) => {
    try {
      const jcalData = ICAL.parse(icalData);
      
      if (!jcalData || !Array.isArray(jcalData)) {
        console.error("Les données jcal ne sont pas dans le format attendu");
        return [];
      }
      
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents("vevent");
  
      return vevents.map((vevent) => {
        try {
          const summary = vevent.getFirstPropertyValue("summary");
          const dtstart = vevent.getFirstPropertyValue("dtstart");
          const dtend = vevent.getFirstPropertyValue("dtend");
  
          if (!summary || !dtstart || !dtend) {
            console.warn("Événement incomplet:", { summary, dtstart, dtend });
            return null;
          }
  
          return {
            title: summary,
            start: dtstart.toJSDate(),
            end: dtend.toJSDate(),
          };
        } catch (eventError) {
          console.error("Erreur lors de l'analyse d'un événement:", eventError);
          return null;
        }
      }).filter(event => event !== null);
    } catch (error) {
      console.error("Erreur lors de l'analyse iCal:", error);
      return [];
    }
  };
  
  return (
    <div className="cla-calendar">
      <Calendar 
        localizer={localizer}
        events={events}
        messages={messages}
        defaultView="agenda"
        views={["agenda"]}

      />
    </div>
  );
};

export default ClaCalendar;