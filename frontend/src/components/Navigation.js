import React from "react";
import { NavLink } from "react-router-dom";

const Navigation = ({ pagesConfig }) => {
  return (
    <nav className="app-navigation">
      <div className="nav-items">
        {pagesConfig.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={`/${item.id}`}
              className="nav-item"
              aria-label={item.label}
            >
              <span className="nav-icon">
                <Icon size={20} />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
