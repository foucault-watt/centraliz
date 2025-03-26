import React from "react";

const Navigation = ({
  currentPageIndex,
  handleNavigation,
  isTyping,
  pagesConfig,
}) => {
  return (
    <>
      <nav className="app-navigation">
        {/* Afficher tous les icônes pour mobile et desktop */}
        <div className="nav-items">
          {pagesConfig.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${
                  currentPageIndex === index ? "active" : ""
                }`}
                onClick={() => handleNavigation(index)}
                disabled={isTyping}
                aria-label={item.label}
              >
                <span className="nav-icon">
                  <Icon
                    size={20}
                    className={currentPageIndex === index ? "active" : ""}
                  />
                </span>
                {/* Le label n'est visible que sur desktop grâce au CSS */}
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Navigation;
