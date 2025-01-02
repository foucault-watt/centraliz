import ICAL from "ical.js";
import { ArrowLeft, ArrowRight } from "lucide-react";
import moment from "moment";
import "moment/locale/fr";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "../App";

moment.locale("fr");

// Fonction utilitaire pour formater l'heure
const formatHour = (hour) => {
  return `${hour}:00`;
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

    // Nouveau parsing du summary
    const parts = summary.split('-').map(part => part.trim());
    let courseName = parts[0];
    let professor = '';
    let courseType = '';

    if (parts.length >= 3) {
      courseName = parts[0];
      professor = parts[1];
      courseType = parts.slice(2).join(' - '); // Au cas où il y aurait d'autres tirets
    } else if (parts.length === 2) {
      courseName = parts[0];
      professor = parts[1];
    }

    const isTNE = summary.includes("TNE");
    const isCB = summary.includes("CB");

    let className = "";
    if (isTNE) className = "tne-event";
    else if (isCB) className = "cb-event";

    return {
      title: courseName,
      professor: professor,
      courseType: courseType,
      location: location,
      start: dtstart,
      end: dtend,
      className: className,
    };
  });
};

const HpCalendar = () => {
  const [icalData, setIcalData] = useState("");
  const [currentDate, setCurrentDate] = useState(moment().startOf('week').add(1, 'day'));
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

  // Générer les heures de la journée (8h à 18h)
  const hours = Array.from({ length: 10 }, (_, i) => i + 8);

  // Modifier la génération des jours de la semaine
  const weekDays = Array.from({ length: 5 }, (_, i) => 
    moment(currentDate).startOf('week').add(i, 'days')
  );

  const renderTimeColumn = () => (
    <div className="time-column">
      {hours.map(hour => (
        <div key={hour} className="time-slot">
          {formatHour(hour)}
        </div>
      ))}
    </div>
  );

  const getEventsForCell = (day, hour) => {
    if (!events) return [];
    
    return events.filter(event => {
      const eventStart = moment(event.start);
      const eventEnd = moment(event.end);
      const cellStart = moment(day).hour(hour);
      const cellEnd = moment(day).hour(hour + 1);

      // Un événement est dans la cellule si :
      // - il commence dans cette cellule
      // - OU il a commencé avant mais n'est pas encore fini
      return eventStart.isSame(cellStart, 'hour') ||
             (eventStart.isBefore(cellEnd) && eventEnd.isAfter(cellStart));
    }).map(event => {
      const eventStart = moment(event.start);
      const eventEnd = moment(event.end);
      const duration = eventEnd.diff(eventStart, 'hours');
      
      // Calculer la position et la taille de l'événement
      const startHour = eventStart.hour();
      const topOffset = (startHour === hour) ? 0 : -((hour - startHour) * 100);
      
      return {
        ...event,
        duration,
        topOffset,
        isStart: startHour === hour
      };
    });
  };

  const renderDayColumn = (day) => (
    <div key={day.format('YYYY-MM-DD')} className="day-column">
      <div className="day-header">
        {isMobile ? day.format('dddd DD/MM') : day.format('ddd DD/MM')}
      </div>
      {hours.map(hour => (
        <div key={`${day.format('YYYY-MM-DD')}-${hour}`} className="time-cell">
          {getEventsForCell(day, hour).map((event, index) => (
            event.isStart && <div
              key={index}
              className={`calendar-event ${event.className}`}
              onClick={() => handleSelectEvent(event)}
              style={{
                height: `calc(${event.duration * 100}% - 2px)`,
                top: `${event.topOffset}%`,
                zIndex: 1
              }}
            >
              <div className="event-title">
                {event.title}
              </div>
              {event.courseType && <div className="event-type">{event.courseType}</div>}
              {event.professor && <div className="event-professor">{event.professor}</div>}
              {event.location && <div className="event-location">{event.location}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const navigateWeek = (direction) => {
    setCurrentDate(prev => 
      direction === 'next' 
        ? moment(prev).add(1, 'week')
        : moment(prev).subtract(1, 'week')
    );
  };

  const handleMonthSelect = (monthOffset) => {
    setCurrentDate(prev => moment(prev).add(monthOffset, 'months'));
    setShowMonthPicker(false);
  };

  const goToToday = () => {
    setCurrentDate(moment().startOf('week').add(1, 'day'));
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
          <h2>{currentDate.format('MMMM YYYY')}</h2>
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
          {renderTimeColumn()}
        </div>
        {isMobile ? (
          <div className="mobile-view">
            {renderDayColumn(currentDate)}
          </div>
        ) : (
          weekDays.map(day => renderDayColumn(day))
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