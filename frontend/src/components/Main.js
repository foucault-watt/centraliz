import React, { createContext, useCallback, useState } from "react";
import { pagesConfig } from "../config/pages";
import Bdi from "./Bdi";
import ClaCalendar from "./ClaCalendar";
import HpCalendar from "./HpCalendar";
import Links from "./Links";
import Mail from "./Mail";
import Navigation from "./Navigation";
import Notes from "./Notes";

// Créer un contexte pour les logos
export const LogoVisibilityContext = createContext(null);

function Main() {
  const [currentPageIndex, setCurrentPageIndex] = useState(1); // index initial = Calendriers
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [logoVisibility, setLogoVisibility] = useState(false);

  const handleNavigation = useCallback(
    (newIndex) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrentPageIndex(newIndex);
      setTimeout(() => {
        setIsTransitioning(false);
        window.scrollTo(0, 0); // Scroll to top after page change
      }, 500);
    },
    [isTransitioning]
  );

  // Association des pages et leur contenu – adaptez le switch en fonction de vos composants
  const renderPageContent = (pageId) => {
    switch (pageId) {
      case "notes":
        return (
          <div className="div-notes">
            <Notes />
          </div>
        );
      case "calendars":
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
      case "communication":
        return (
          <div className="div-mail">
            <Mail />
          </div>
        );
      case "bdi":
        return (
          <div className="div-bdi">
            <Bdi />
          </div>
        );
      case "links":
        return (
          <div className="div-links">
            <Links />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <LogoVisibilityContext.Provider
      value={{ logoVisibility, setLogoVisibility }}
    >
      <div className="main-container">
        <Navigation
          currentPageIndex={currentPageIndex}
          handleNavigation={handleNavigation}
          pagesConfig={pagesConfig}
        />
        <div className="pages-container">
          <div
            className={`pages-wrapper ${
              isTransitioning ? "transitioning" : ""
            }`}
            style={{
              width: `${pagesConfig.length * 100}%`,
              transform: `translateX(-${
                (currentPageIndex * 100) / pagesConfig.length
              }%)`,
            }}
          >
            {pagesConfig.map((page) => (
              <div
                key={page.id}
                className={`page-section ${page.id}-section`}
                style={{
                  flex: `0 0 ${100 / pagesConfig.length}%`,
                  maxWidth: `${100 / pagesConfig.length}%`,
                }}
              >
                <div className="section-content">
                  {renderPageContent(page.id)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LogoVisibilityContext.Provider>
  );
}

export default Main;
