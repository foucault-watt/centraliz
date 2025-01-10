import ICAL from "ical.js";
import { ArrowLeft, ArrowRight } from "lucide-react";
import moment from "moment";
import "moment/locale/fr";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "../App";

moment.locale("fr");

// Fonction utilitaire pour formater l'heure
const formatHour = (hour) => {
  return `${hour.toString().padStart(2, '0')}h`;
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

      const parts = summary.split('-').map(part => part.trim());
      const [courseName, professor = '', ...rest] = parts;
      const courseType = rest.join(' - ');

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

const HpCalendar = () => {
  const [icalData, setIcalData] = useState("");
  const [currentDate, setCurrentDate] = useState(() => {
    const today = moment();
    // Sur mobile, on commence par le jour actuel
    if (window.innerWidth < 768) {
      // Si c'est un weekend, on va au prochain jour ouvré
      while (today.day() === 0 || today.day() === 6) {
        today.add(1, 'day');
      }
      return today;
    }
    // Sur desktop, on garde le comportement existant
    return moment().startOf('week').add(1, 'day');
  });
  const { userName, displayName } = useContext(UserContext);
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

  useEffect(() => {
    const fetchEvaluationConfig = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/eva/config?userName=${userName}`
        );
        if (!response.ok) {
          throw new Error("Configuration non disponible");
        }
        const data = await response.json();
        setEvaluationConfig(data);
      } catch (error) {
        console.error("Erreur lors de la récupération de la configuration:", error);
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

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ajouter un useEffect pour gérer le clic en dehors du sélecteur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMonthPicker && !event.target.closest('.month-selector')) {
        setShowMonthPicker(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMonthPicker]);

  // Ajouter un effet pour scroller au bouton quand l'évaluation est ouverte
  useEffect(() => {
    if (showEvaluationModal) {
      setTimeout(() => {
        document.getElementById('submitButton')?.scrollIntoView({ behavior: 'smooth' });
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
    try {
      const cleanTitle = event.title.split('\n')[0];
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

  const handleEvaluate = () => {
    if (!hasEvaluated) {
      // Vérifier si l'événement est passé
      const eventEndTime = moment(selectedEvent.end);
      const now = moment();
  
      if (eventEndTime.isAfter(now)) {
        setErrorMessage("Vous ne pouvez évaluer que les enseignements terminés");
        return;
      }
  
      // Vérifier d'abord si une configuration existe pour le groupe
      fetch(`${process.env.REACT_APP_URL_BACK}/api/eva/config?userName=${userName}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Pas de configuration disponible pour votre groupe');
          }
          return response.json();
        })
        .then(config => {
          if (config && config.questions && config.questions.length > 0) {
            setAnswers({});
            setErrorMessage("");
            setSubmitSuccess(false);
            setShowEvaluationModal(true);
            setShowModal(false);
          } else {
            setErrorMessage("L'évaluation n'est pas disponible pour votre groupe");
          }
        })
        .catch(error => {
          setErrorMessage(error.message);
        });
    }
  };

  const handleAnswerChange = (questionId, value, maxLength) => {
    if (typeof value === 'string' && maxLength) {
      value = value.substring(0, maxLength);
    }
    
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const submitEvaluation = async () => {
    const missingRequired = evaluationConfig.questions
      .filter(q => q.required)
      .some(q => !answers[q.id]);

    if (missingRequired) {
      setErrorMessage("Les questions marquées d'un * sont obligatoires");
      // Scroll jusqu'au message d'erreur
      document.querySelector('.error-message')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const cleanTitle = selectedEvent.title.split('\n')[0];
  
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/eva`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userName: displayName, // On envoie le displayName
          eventTitle: cleanTitle,
          answers
        }),
      });
      
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
      setErrorMessage(error.message || "Une erreur est survenue. Veuillez réessayer.");
    }
  };

  // Mémoisation des heures et jours
  const hours = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 8), []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => 
      moment(currentDate).startOf('week').add(i, 'days')
    );
  }, [currentDate]);

  // Optimisation du calcul des événements par cellule
  const getEventsForCell = useCallback((day, hour) => {
    if (!events?.length) return [];
    
    const cellStart = moment(day).hour(hour).minute(0);
    const cellEnd = moment(day).hour(hour + 1).minute(0);
    
    return events.filter(event => {
      const eventStart = moment(event.start);
      const eventEnd = moment(event.end);
      return eventStart.isBefore(cellEnd) && eventEnd.isAfter(cellStart);
    }).map(event => {
      const eventStart = moment(event.start);
      const startHour = eventStart.hour() + (eventStart.minute() / 60);
      const endHour = moment(event.end).hour() + (moment(event.end).minute() / 60);
      
      return {
        ...event,
        duration: endHour - startHour,
        topOffset: ((startHour - hour) * 100),
        isStart: Math.floor(startHour) === hour
      };
    });
  }, [events]);

  // Mémoisation des colonnes du calendrier
  const DayColumn = React.memo(({ day, hours, getEventsForCell, handleSelectEvent, isMobile }) => {
    return (
      <div className="day-column">
        <div className="day-header">
          {isMobile ? day.format('dddd DD/MM') : day.format('ddd DD/MM')}
        </div>
        {hours.map(hour => (
          <TimeCell 
            key={`${day.format('YYYY-MM-DD')}-${hour}`}
            day={day}
            hour={hour}
            getEventsForCell={getEventsForCell}
            handleSelectEvent={handleSelectEvent}
          />
        ))}
      </div>
    );
  });

  // Composant optimisé pour les cellules de temps
  const TimeCell = React.memo(({ day, hour, getEventsForCell, handleSelectEvent }) => {
    const events = getEventsForCell(day, hour);
    
    return (
      <div className="time-cell">
        {events.map((event, index) => (
          event.isStart && (
            <Event 
              key={index}
              event={event}
              handleSelectEvent={handleSelectEvent}
            />
          )
        ))}
      </div>
    );
  });

  // Composant optimisé pour les événements
  const Event = React.memo(({ event, handleSelectEvent }) => {
    const style = {
      height: `calc(${event.duration * 100}% - 2px)`,
      top: `${event.topOffset}%`,
      zIndex: 1
    };

    return (
      <div
        className={`calendar-event ${event.className}`}
        onClick={() => handleSelectEvent(event)}
        style={style}
      >
        <div className="event-title">{event.title}</div>
        {event.location && <div className="event-location">{event.location}</div>}
        {event.courseType && <div className="event-type">{event.courseType}</div>}
        {event.professor && <div className="event-professor">{event.professor}</div>}
      </div>
    );
  });

  const navigateWeek = (direction) => {
    if (isMobile) {
      // Navigation quotidienne sur mobile (sans weekends)
      setCurrentDate(prev => {
        let newDate = direction === 'next' 
          ? moment(prev).add(1, 'day')
          : moment(prev).subtract(1, 'day');
        
        // Si le nouveau jour est un weekend, on continue jusqu'au prochain jour ouvré
        while (newDate.day() === 0 || newDate.day() === 6) {
          newDate = direction === 'next'
            ? newDate.add(1, 'day')
            : newDate.subtract(1, 'day');
        }
        
        return newDate;
      });
    } else {
      // Navigation hebdomadaire sur desktop (comportement existant)
      setCurrentDate(prev => 
        direction === 'next' 
          ? moment(prev).add(1, 'week')
          : moment(prev).subtract(1, 'week')
      );
    }
  };

  const handleMonthSelect = (monthOffset) => {
    setCurrentDate(prev => moment(prev).add(monthOffset, 'months'));
    setShowMonthPicker(false);
  };

  const goToToday = () => {
    let today = moment();
    
    // Si on est sur mobile et que c'est un weekend
    if (isMobile && (today.day() === 0 || today.day() === 6)) {
      // On va au prochain lundi
      while (today.day() === 0 || today.day() === 6) {
        today.add(1, 'day');
      }
    } else if (!isMobile) {
      // Sur desktop, on reste sur le comportement existant
      today = today.startOf('week').add(1, 'day');
    }
    
    setCurrentDate(today);
  };

  return (
    <div className="hp-calendar">
      <div className="calendar-header">
        <div className="navigation-controls">
          <button onClick={() => navigateWeek('prev')} title="Semaine précédente">
            <ArrowLeft />
          </button>
          <button onClick={goToToday} className="today-btn" title="Aujourd'hui">
            Aujourd'hui
          </button>
          <div className="month-selector" onClick={() => setShowMonthPicker(!showMonthPicker)}>
          <h2>{currentDate.format('MMMM YYYY')} ⯆</h2>
          {showMonthPicker && (
            <div className="month-picker">
              {[-2, -1, 0, 1, 2].map(offset => (
                <div 
                  key={offset} 
                  onClick={() => handleMonthSelect(offset)}
                  className={offset === 0 ? 'current' : ''}
                >
                  {moment(currentDate).add(offset, 'months').format('MMMM YYYY')}
                </div>
              ))}
            </div>
          )}
        </div>
          <button onClick={() => navigateWeek('next')} title="Semaine suivante">
            <ArrowRight />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        <div className="time-column">
          <div className="corner-header"></div>
          {hours.map(hour => (
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
          weekDays.map(day => (
            <DayColumn
              key={day.format('YYYY-MM-DD')}
              day={day}
              hours={hours}
              getEventsForCell={getEventsForCell}
              handleSelectEvent={handleSelectEvent}
              isMobile={isMobile}
            />
          ))
        )}
      </div>

      {showModal && selectedEvent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Détails de l'événement</h2>
            <div className="event-details">
              <div className="event-main-title">{selectedEvent.title}</div>
              <div className="event-type-detail">
                <span className="label">Type :</span>
                <span className="value">{selectedEvent.courseType}</span>
              </div>
              {selectedEvent.professor && (
                <div className="event-professor-detail">
                  <span className="label">Professeur :</span>
                  <span className="value">{selectedEvent.professor}</span>
                </div>
              )}
              {selectedEvent.location && (
                <div className="event-location-detail">
                  <span className="label">Salle :</span>
                  <span className="value">{selectedEvent.location}</span>
                </div>
              )}
            </div>
            {errorMessage ? (
              <div className="error-message">{errorMessage}</div>
            ) : hasEvaluated ? (
              <div className="evaluation-notice">
                Vous avez déjà évalué cet enseignement
              </div>
            ) : (
              <button onClick={handleEvaluate}>Évaluer</button>
            )}
            <button onClick={closeModal}>Fermer</button>
          </div>
        </div>
      )}
      {showEvaluationModal && evaluationConfig && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content evaluation" onClick={(e) => e.stopPropagation()}>
            <h2>Évaluation de l'enseignement</h2>
            <div className="required-notice">* Questions obligatoires</div>
            {evaluationConfig.questions.map(question => (
              <div key={question.id} className="question">
                <label className={question.required ? 'required' : ''}>
                  {question.text}
                  {question.required && ' *'}
                </label>
                {question.type === 'likert' ? (
                  <div className="likert-scale horizontal">
                    {question.options.map((option, index) => (
                      <label key={index}>
                        <input
                          type="radio"
                          name={`question_${question.id}`}
                          value={index}
                          onChange={() => handleAnswerChange(question.id, index)}
                          checked={answers[question.id] === index}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    maxLength={question.maxLength}
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value, question.maxLength)}
                    placeholder={`Votre réponse... ${question.required ? '(obligatoire)' : '(optionnel)'} (${question.maxLength} caractères max)`}
                  />
                )}
              </div>
            ))}
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            {submitSuccess && (
              <div className="success-message">
                ✓ Évaluation enregistrée avec succès !
              </div>
            )}
            <button 
              id="submitButton"
              onClick={submitEvaluation}
              className={submitSuccess ? 'success' : ''}
            >
              {submitSuccess ? '✓ Envoyé' : 'Envoyer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HpCalendar;