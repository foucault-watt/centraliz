import React from "react";
import ClaCalendar from "./ClaCalendar";
import HpCalendar from "./HpCalendar";
import Links from "./Links";
import Mail from "./Mail";
import Notes from "./Notes";

function Main() {
  return (
    <div className="main">
      <div className="div-hp-calendar">
        <HpCalendar />
        
      </div>

      <div className="div-cla-calendar">
        <ClaCalendar />
      </div>

      <div className="div-notes">
        <Notes />
      </div>

      <div className="div-mail">
        <Mail />
      </div>

      <div className="div-links">
        <Links />
      </div>
    </div>
  );
}

export default Main;
