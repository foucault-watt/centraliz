import ICAL from "ical.js";
import moment from "moment";
import "moment/locale/fr";
import React, { useEffect, useState, useRef, useCallback } from "react";

moment.locale("fr");

const ClaCalendar = () => {
  const [events, setEvents] = useState([]);
  const [visibleEvents, setVisibleEvents] = useState(10); // Ajouter un état pour les événements visibles
  const loader = useRef(null);

  useEffect(() => {
    const fetchICalData = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/cla-data`);
        const data = await response.text();
        const parsedEvents = parseICal(data);
        setEvents(parsedEvents);
      } catch (error) {
        console.error("Erreur lors de la récupération du fichier iCal :", error);
      }
    };
    fetchICalData();
  }, []);

  const parseICal = (icalData) => {
    try {
      const jcalData = ICAL.parse(icalData);

      if (!jcalData || !Array.isArray(jcalData)) {
        console.error("Les données jcal ne sont pas dans le format attendu");
        return [];
      }

      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents("vevent");

      return vevents
        .map((vevent) => {
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
            console.error(
              "Erreur lors de l'analyse d'un événement:",
              eventError
            );
            return null;
          }
        })
        .filter((event) => event !== null);
    } catch (error) {
      console.error("Erreur lors de l'analyse iCal:", error);
      return [];
    }
  };

  const loadMoreEvents = useCallback(() => {
    if (visibleEvents < events.length) {
      setVisibleEvents((prev) => prev + 10); // Charger 10 événements supplémentaires
    }
  }, [visibleEvents, events.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreEvents();
        }
      },
      { threshold: 0.1 } // Ajuster le seuil pour déclencher plus tôt
    );

    if (loader.current) {
      observer.observe(loader.current);
    }

    return () => {
      if (loader.current) {
        observer.unobserve(loader.current);
      }
    };
  }, [loadMoreEvents]);

  const getFutureEvents = () => {
    const now = new Date();
    return events
      .filter(event => event.start >= now)
      .sort((a, b) => a.start - b.start)
      .slice(0, visibleEvents); // Limiter aux événements visibles
  };

  const getEventType = (start, end) => {
    const startHour = moment(start).hours();
    const endHour = moment(end).hours();
    
    if (startHour === 20 && endHour === 0) {
      return { type: "Torch'Tôt", className: "torch-tot" };
    }
    if (startHour === 22 && endHour === 3) {
      return { type: "Torcho", className: "torcho" };
    }
    return null;
  };

  return (
    <>
      <h2 className="module-title">Les prochains events</h2>
      <div className="cla-calendar">
        <div className="events-list">
          {getFutureEvents().map((event, index) => {
            const eventType = getEventType(event.start, event.end);
            return (
              <div key={index} className="event-item">
                <div className="event-date">
                  {moment(event.start).format('dddd').charAt(0).toUpperCase() + moment(event.start).format('dddd').slice(1)} {moment(event.start).format('DD MMMM')}
                  <span className="event-time">
                    {eventType ? (
                      <span className={eventType.className}>{eventType.type}</span>
                    ) : (
                      `${moment(event.start).format('HH:mm')} - ${moment(event.end).format('HH:mm')}`
                    )}
                  </span>
                </div>
                <div className="event-title">{event.title}</div>
              </div>
            );
          })}
        </div>
        <div ref={loader} />
        {visibleEvents < events.length && <p>Chargement...</p>}
      </div>
    </>
  );
};

export default ClaCalendar;
