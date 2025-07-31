import React from "react";
import HpCalendar from "./HpCalendar";
import ClaCalendar from "./ClaCalendar";

const Calendars = () => {
  return (
    <div className="calendars-wrapper">
      <div className="div-hp-calendar">
        <HpCalendar />
      </div>
      <div className="div-cla-calendar">
        <ClaCalendar />
      </div>
    </div>
  );
};

export default Calendars;
