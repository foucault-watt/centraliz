// Importation des dépendances nécessaires
import ICAL from "ical.js";
import moment from "moment";
import "moment/locale/fr";
import React, { useCallback, useEffect, useRef, useState } from "react";

// Configuration de moment.js en français
moment.locale("fr");

const ClaCalendar = () => {
  // États pour gérer les événements et l'infinite scroll
  const [events, setEvents] = useState([]); // Stocke tous les événements
  const [visibleEvents, setVisibleEvents] = useState(10); // Nombre d'événements affichés
  const loader = useRef(null); // Référence pour l'infinite scroll

  // Effet pour charger les données du calendrier au montage du composant
  useEffect(() => {
    const fetchICalData = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/cla-data`
        );
        const data = await response.text();
        const parsedEvents = parseICal(data);
        setEvents(parsedEvents);
      } catch (error) {
        console.error(
          "Erreur lors de la récupération du fichier iCal :",
          error
        );
      }
    };
    fetchICalData();
  }, []);

  // Fonction pour analyser les données iCal et les convertir en événements exploitables
  const parseICal = (icalData) => {
    try {
      // Analyse initiale des données iCal
      const jcalData = ICAL.parse(icalData);

      if (!jcalData || !Array.isArray(jcalData)) {
        console.error("Les données jcal ne sont pas dans le format attendu");
        return [];
      }

      // Extraction et transformation des événements
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

  // Gestionnaire de chargement des événements supplémentaires
  const loadMoreEvents = useCallback(() => {
    if (visibleEvents < events.length) {
      setVisibleEvents((prev) => prev + 10); // Charger 10 événements supplémentaires
    }
  }, [visibleEvents, events.length]);

  // Configuration de l'Intersection Observer pour l'infinite scroll
  useEffect(() => {
    const currentLoader = loader.current; // Copier loader.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreEvents();
        }
      },
      { threshold: 0.1 } // Ajuster le seuil pour déclencher plus tôt
    );

    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [loadMoreEvents]);

  // Filtre les événements futurs et les trie par date
  const getFutureEvents = () => {
    const now = new Date();
    return events
      .filter((event) => event.start >= now)
      .sort((a, b) => a.start - b.start)
      .slice(0, visibleEvents); // Limiter aux événements visibles
  };

  // Détermine le type d'événement en fonction des horaires
  const getEventType = (start, end) => {
    const startHour = moment(start).hours();
    const endHour = moment(end).hours();

    // Classification des événements selon leur horaire
    if (startHour === 20 && endHour === 0) {
      return { type: "Soirée 20H-Minuit", className: "torch-tot" };
    }
    if (startHour === 22 && endHour === 3) {
      return { type: "Soirée Dansante", className: "torcho" };
    }
    return null;
  };

  // Rendu du composant
  return (
    <>
      <h2 className="module-title">Les prochains évents CLA</h2>
      <div className="cla-calendar">
        <div className="events-list">
          {/* Boucle sur les événements futurs */}
          {getFutureEvents().map((event, index) => {
            const eventType = getEventType(event.start, event.end);
            return (
              <div key={index} className="event-item">
                <div className="event-date">
                  {moment(event.start).format("dddd").charAt(0).toUpperCase() +
                    moment(event.start).format("dddd").slice(1)}{" "}
                  {moment(event.start).format("DD MMMM")}
                  <span className="event-time">
                    {eventType ? (
                      <span className={eventType.className}>
                        {eventType.type}
                      </span>
                    ) : (
                      `${moment(event.start).format("HH:mm")} - ${moment(
                        event.end
                      ).format("HH:mm")}`
                    )}
                  </span>
                </div>
                <div className="event-title">{event.title}</div>
              </div>
            );
          })}
        </div>
        {/* Élément observé pour l'infinite scroll */}
        <div ref={loader} />
        {/* Indicateur de chargement */}
        {visibleEvents < events.length && <p>Chargement...</p>}
      </div>
    </>
  );
};

export default ClaCalendar;
