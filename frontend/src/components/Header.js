import React from "react";

export default function Header() {
  return (
    <div className="header">
      <a href="https://www.github.com/foucault-watt/centraliz" target="_blank" rel="noreferrer" className="header-link">
        <img src={"logo-title.png"} className="header-logo" alt="logo" />
        <h1 className="header-title">Centraliz</h1>
      </a>
    </div>
  );
}
