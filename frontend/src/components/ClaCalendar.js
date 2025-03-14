// Importation des dépendances nécessaires
import ICAL from "ical.js";
import moment from "moment";
import "moment/locale/fr";
import React, { useCallback, useEffect, useRef, useState } from "react";
import "../styles/ClaCalendar.scss";

// Configuration de moment.js en français
moment.locale("fr");

const ClaCalendar = () => {
  // États pour gérer les événements et l'infinite scroll
  const [calendars, setCalendars] = useState({ cla: [], fablab: [] });
  const [loading, setLoading] = useState({ cla: true, fablab: true });
  const [errors, setErrors] = useState({ cla: null, fablab: null });
  const [visibleEvents, setVisibleEvents] = useState({ cla: 10, fablab: 10 });
  const [activeTab, setActiveTab] = useState("cla");
  const loaderCla = useRef(null);
  const loaderFablab = useRef(null);
  const calendarsContainerRef = useRef(null);

  // Effet pour charger les données des calendriers
  useEffect(() => {
    const fetchCalendarsData = async () => {
      try {
        setLoading({ cla: true, fablab: true });
        setErrors({ cla: null, fablab: null });

        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/calendars-data`
        );
        const data = await response.json();

        // Traitement du calendrier CLA
        if (data.cla && data.cla.success) {
          setCalendars((prev) => ({
            ...prev,
            cla: parseICal(data.cla.data, "cla"),
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            cla: data.cla?.error || "Erreur de chargement du calendrier CLA",
          }));
        }
        setLoading((prev) => ({ ...prev, cla: false }));

        // Traitement du calendrier FabLab
        if (data.fablab && data.fablab.success) {
          setCalendars((prev) => ({
            ...prev,
            fablab: parseICal(data.fablab.data, "fablab"),
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            fablab:
              data.fablab?.error || "Erreur de chargement du calendrier FabLab",
          }));
        }
        setLoading((prev) => ({ ...prev, fablab: false }));
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des calendriers :",
          error
        );
        setErrors({
          cla: "Erreur de communication avec le serveur",
          fablab: "Erreur de communication avec le serveur",
        });
        setLoading({ cla: false, fablab: false });
      }
    };
    fetchCalendarsData();
  }, []);

  // Fonction pour analyser les données iCal et les convertir en événements exploitables
  const parseICal = (icalData, calendarType) => {
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
      const now = new Date();
      let events = [];

      vevents.forEach((vevent) => {
        try {
          const summary = vevent.getFirstPropertyValue("summary");
          const description = vevent.getFirstPropertyValue("description") || "";

          // Attributs spécifiques au fablab
          let color = null;
          if (calendarType === "fablab") {
            try {
              color = vevent.getFirstPropertyValue("color");
            } catch (e) {
              // Ignorer si la propriété n'existe pas
            }
          }

          // Vérification si l'événement est récurrent
          const rruleProp = vevent.getFirstProperty("rrule");
          const isEventOngoing = (start, end) => {
            const now = new Date();
            return start <= now && end >= now;
          };

          if (rruleProp) {
            // Traitement des événements récurrents
            const dtstart = vevent.getFirstPropertyValue("dtstart");
            const rruleValue = rruleProp.getFirstValue();
            const eventComponent = new ICAL.Event(vevent);

            // Calculer les occurrences sur une période de 6 mois
            const sixMonthsFromNow = new Date(now);
            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

            const iterator = eventComponent.iterator();
            let next;

            // Limiter à 50 occurrences pour éviter une boucle infinie
            let count = 0;
            const maxOccurrences = 50;

            // Pour chaque occurrence de l'événement récurrent
            while ((next = iterator.next()) && count < maxOccurrences) {
              const startDate = next.toJSDate();

              // Ne prendre que les occurrences futures
              let endDate = null;
              if (eventComponent.endDate) {
                // Calculer la date de fin en fonction de la durée de l'événement
                const duration = eventComponent.duration;
                endDate = new Date(startDate);
                endDate.setSeconds(endDate.getSeconds() + duration.toSeconds());
              }

              // Vérifier si l'événement est futur ou en cours
              if (
                (startDate >= now ||
                  (endDate && isEventOngoing(startDate, endDate))) &&
                startDate <= sixMonthsFromNow
              ) {
                events.push({
                  title: summary,
                  start: startDate,
                  end: endDate,
                  description: description,
                  recurring: true,
                  color: color,
                  ongoing: endDate ? isEventOngoing(startDate, endDate) : false,
                });
              }

              count++;
            }
          } else {
            // Événement unique
            const dtstart = vevent.getFirstPropertyValue("dtstart");
            const dtend = vevent.getFirstPropertyValue("dtend");

            if (!summary || !dtstart) {
              console.warn("Événement incomplet:", { summary, dtstart });
              return;
            }

            const startDate = dtstart.toJSDate();
            const endDate = dtend ? dtend.toJSDate() : null;

            // Inclure l'événement s'il est futur ou en cours
            if (
              startDate >= now ||
              (endDate && isEventOngoing(startDate, endDate))
            ) {
              events.push({
                title: summary,
                start: startDate,
                end: endDate,
                description: description,
                recurring: false,
                color: color,
                ongoing: endDate ? isEventOngoing(startDate, endDate) : false,
              });
            }
          }
        } catch (eventError) {
          console.error("Erreur lors de l'analyse d'un événement:", eventError);
        }
      });

      // Trier avec les événements en cours en premier
      return events.sort((a, b) => {
        if (a.ongoing && !b.ongoing) return -1;
        if (!a.ongoing && b.ongoing) return 1;
        return a.start - b.start;
      });
    } catch (error) {
      console.error("Erreur lors de l'analyse iCal:", error);
      return [];
    }
  };

  // Gestionnaires de chargement des événements supplémentaires
  const loadMoreEvents = useCallback((calendarType) => {
    setVisibleEvents((prev) => ({
      ...prev,
      [calendarType]: prev[calendarType] + 10,
    }));
  }, []);

  // Configuration de l'Intersection Observer pour l'infinite scroll
  useEffect(() => {
    const observerCla = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreEvents("cla");
        }
      },
      { threshold: 0.1 }
    );

    const observerFablab = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreEvents("fablab");
        }
      },
      { threshold: 0.1 }
    );

    if (loaderCla.current) {
      observerCla.observe(loaderCla.current);
    }

    if (loaderFablab.current) {
      observerFablab.observe(loaderFablab.current);
    }

    return () => {
      if (loaderCla.current) {
        observerCla.unobserve(loaderCla.current);
      }
      if (loaderFablab.current) {
        observerFablab.unobserve(loaderFablab.current);
      }
    };
  }, [loadMoreEvents]);

  // Obtenir les événements visibles
  const getVisibleEvents = (calendarType) => {
    return calendars[calendarType].slice(0, visibleEvents[calendarType]);
  };

  // Détermine le type d'événement en fonction des horaires (pour CLA)
  const getEventType = (start, end) => {
    if (!start || !end) return null;

    const startHour = moment(start).hours();
    const endHour = moment(end).hours();

    if (startHour === 20 && endHour === 0) {
      return { type: "Soirée 20H-Minuit", className: "torch-tot" };
    }
    if (startHour === 22 && endHour === 3) {
      return { type: "Soirée Dansante", className: "torcho" };
    }
    return null;
  };

  // Gestionnaire pour changer d'onglet
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (calendarsContainerRef.current) {
      const index = tab === "cla" ? 0 : 1;
      const scrollPosition = index * calendarsContainerRef.current.offsetWidth;
      calendarsContainerRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
    }
  };

  // Gestionnaire pour détecter le défilement et mettre à jour l'onglet actif
  const handleScroll = () => {
    if (calendarsContainerRef.current) {
      const { scrollLeft, offsetWidth } = calendarsContainerRef.current;
      const selectedIndex = Math.round(scrollLeft / offsetWidth);
      const newActiveTab = selectedIndex === 0 ? "cla" : "fablab";

      if (newActiveTab !== activeTab) {
        setActiveTab(newActiveTab);
      }
    }
  };

  // Rendu de l'état de chargement
  const renderLoadingState = (calendarType) => (
    <div className="calendar-loading">
      <div className="loading-spinner"></div>
      <p>
        Chargement du calendrier {calendarType === "cla" ? "CLA" : "FabLab"}...
      </p>
    </div>
  );

  // Rendu d'un message d'erreur
  const renderErrorState = (calendarType) => (
    <div className="calendar-error">
      <div className="error-icon">⚠️</div>
      <h3>Impossible de charger le calendrier</h3>
      <p>{errors[calendarType]}</p>
    </div>
  );

  // Rendu des événements d'un calendrier
  const renderCalendarEvents = (calendarType) => {
    // Si en chargement, afficher l'animation
    if (loading[calendarType]) {
      return renderLoadingState(calendarType);
    }

    // Si erreur, afficher le message
    if (errors[calendarType]) {
      return renderErrorState(calendarType);
    }

    // Si aucun événement, afficher un message
    if (calendars[calendarType].length === 0) {
      return (
        <div className="no-events">
          <p>Aucun événement à venir</p>
        </div>
      );
    }

    // Rendu normal des événements
    return (
      <>
        {getVisibleEvents(calendarType).map((event, index) => {
          const eventType =
            calendarType === "cla"
              ? getEventType(event.start, event.end)
              : null;
          return (
            <div
              key={`${calendarType}-${index}`}
              className={`event-item ${event.recurring ? "recurring" : ""} ${
                event.ongoing ? "ongoing" : ""
              }`}
              style={
                calendarType === "fablab" && event.color
                  ? { borderLeft: `3px solid ${event.color}` }
                  : {}
              }
            >
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
                    `${moment(event.start).format("HH:mm")} - ${
                      event.end ? moment(event.end).format("HH:mm") : "NC"
                    }`
                  )}
                  {event.recurring && (
                    <span className="event-recurring"> (récurrent)</span>
                  )}
                </span>
              </div>
              <div className="event-title">{event.title}</div>
              {calendarType === "fablab" && event.description && (
                <div className="event-description">{event.description}</div>
              )}
            </div>
          );
        })}

        <div ref={calendarType === "cla" ? loaderCla : loaderFablab} />

        {!loading[calendarType] &&
          !errors[calendarType] &&
          visibleEvents[calendarType] < calendars[calendarType].length && (
            <p className="loading-more">Chargement...</p>
          )}
      </>
    );
  };

  return (
    <>
      <h2 className="module-title">Plannings</h2>

      {/* Onglets de navigation */}
      <div className="calendar-tabs">
        <button
          className={`tab-button ${activeTab === "cla" ? "active" : ""}`}
          onClick={() => handleTabChange("cla")}
        >
          Events CLA
        </button>
        <button
          className={`tab-button ${activeTab === "fablab" ? "active" : ""}`}
          onClick={() => handleTabChange("fablab")}
        >
          FabLab
        </button>
      </div>

      {/* Conteneur de défilement horizontal */}
      <div
        className="calendars-container"
        ref={calendarsContainerRef}
        onScroll={handleScroll}
      >
        {/* Calendrier CLA */}
        <div className="calendar-wrapper">
          <div className="cla-calendar">
            <div className="events-list">{renderCalendarEvents("cla")}</div>
          </div>
        </div>

        {/* Calendrier FabLab */}
        <div className="calendar-wrapper">
          <div className="fablab-calendar cla-calendar">
            <div className="events-list">{renderCalendarEvents("fablab")}</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClaCalendar;
