import React from "react";
import "../styles/CanartNavigation.scss";

const CanartNavigation = ({ sections, activeSection, onSectionChange }) => {
  return (
    <nav className="canart-nav">
      <div className="canart-nav-container">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`canart-nav-item ${
              activeSection === section.id ? "active" : ""
            }`}
            onClick={() => onSectionChange(section.id)}
          >
            {section.icon && <span className="nav-icon">{section.icon}</span>}
            <span className="nav-label">{section.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default CanartNavigation;
