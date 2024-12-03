
import React from 'react';
import HpCalendar from '../components/HpCalendar';
import ClaCalendar from '../components/ClaCalendar';

const CalendarsPage = () => {
  return (
    <div className="page calendars-page">
      <div className="page-content">
        <div className="div-hp-calendar">
          <HpCalendar />
        </div>
        <div className="div-cla-calendar">
          <ClaCalendar />
        </div>
      </div>
    </div>
  );
};

export default CalendarsPage;