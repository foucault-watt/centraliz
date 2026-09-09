import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleChevronDown,
  Search,
} from "lucide-react";
import React from "react";

// Faux planning utilisé en fond flouté de PasswordGateModal tant que l'user
// n'a pas ajouté son lien iCal : donne un aperçu réaliste de l'onglet
// Calendriers sans dépendre de vraies données. Réutilise les classes CSS du
// vrai HpCalendar pour rester visuellement identique une fois flouté.
const FAKE_HOURS = Array.from({ length: 10 }, (_, i) => i + 8);
const FAKE_DAYS = [
  "lun. 06/10",
  "mar. 07/10",
  "mer. 08/10",
  "jeu. 09/10",
  "ven. 10/10",
];

const FAKE_EVENTS = [
  { day: 0, hour: 8, duration: 2, title: "Mathématiques", location: "Amphi A" },
  { day: 0, hour: 14, duration: 2, title: "Anglais", location: "S204" },
  { day: 1, hour: 9, duration: 2, title: "Physique", location: "TP1", type: "tne-event" },
  { day: 2, hour: 8, duration: 3, title: "Projet", location: "Studio" },
  { day: 3, hour: 13, duration: 2, title: "DS Info", location: "Amphi B", type: "cb-event" },
  { day: 4, hour: 10, duration: 2, title: "Sport", location: "Gymnase" },
];

const CalendarSkeleton = () => (
  <div className="hp-calendar" aria-hidden="true">
    <div className="calendar-header">
      <div className="calendar-top-row">
        <div className="navigation-controls">
          <span className="calendar-icon-btn">
            <ArrowLeft />
          </span>
          <span className="today-btn">Aujourd'hui</span>
          <span className="calendar-icon-btn">
            <ArrowRight />
          </span>
        </div>
        <div className="month-selector">
          <CalendarDays size={18} />
          <h2>
            Octobre <CircleChevronDown size={18} />
          </h2>
        </div>
      </div>
      <div className="user-selector">
        <div className="search-shell">
          <Search className="search-icon" size={17} />
          <span className="search-input">Choisir une catégorie...</span>
        </div>
      </div>
    </div>
    <div className="calendar-grid">
      <div className="time-column">
        <div className="corner-header" />
        <div className="association-row-spacer" />
        {FAKE_HOURS.map((hour) => (
          <div key={hour} className="time-slot">
            {hour}h
          </div>
        ))}
      </div>
      {FAKE_DAYS.map((day, dayIndex) => (
        <div key={day} className="day-column">
          <div className="day-header">
            <span className="day-label">{day}</span>
          </div>
          <div className="day-association-preview is-empty" />
          {FAKE_HOURS.map((hour) => {
            const event = FAKE_EVENTS.find(
              (e) => e.day === dayIndex && e.hour === hour,
            );
            return (
              <div key={hour} className="time-cell">
                {event && (
                  <div
                    className={`calendar-event ${event.type || ""}`}
                    style={{
                      height: `calc(${event.duration * 100}% - 2px)`,
                      top: 0,
                    }}
                  >
                    <div className="event-title">{event.title}</div>
                    <div className="event-location">{event.location}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  </div>
);

export default CalendarSkeleton;
