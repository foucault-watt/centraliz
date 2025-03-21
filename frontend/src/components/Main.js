import React, { useCallback, useContext, useMemo, useState } from "react";
import { UserContext } from "../App";
import { pagesConfig } from "../config/pages";
import { admin } from "../data/admin";
import Alain from "./Alain";
import Aprem from "./Aprem";
import CanartNavigation from "./CanartNavigation";
import ClaCalendar from "./ClaCalendar";
import Events from "./Events";
import HpCalendar from "./HpCalendar";
import Links from "./Links";
import Mail from "./Mail";
import Navigation from "./Navigation";
import Notes from "./Notes";
import Trombi from "./Trombi";

function Main() {
  const [currentPageIndex, setCurrentPageIndex] = useState(1); // index 1 = Calendriers
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeCanartSection, setActiveCanartSection] = useState("events");
  const { userName } = useContext(UserContext);

  // Vérifier si l'utilisateur est un administrateur
  const isAdmin = useMemo(() => {
    return admin.includes(userName);
  }, [userName]);

  // Configuration des modules Canart - centraliser ici pour faciliter l'ajout/suppression
  const canartModules = [
    {
      id: "events",
      label: "Évents",
      icon: "🗓️",
      component: Events,
    },
    {
      id: "alain",
      label: "Jazz",
      icon: "🤖",
      component: Alain,
    },
    {
      id: "aprem",
      label: "Aprem Rez",
      icon: "☀️",
      component: Aprem,
    },
    {
      id: "trombi",
      label: "Trombi",
      icon: "👥",
      component: Trombi,
    },
  ];

  // Filtrer les pages de configuration pour n'inclure "canart" que pour les administrateurs
  const filteredPagesConfig = useMemo(() => {
    return pagesConfig.filter((page) => page.id !== "canart" || isAdmin);
  }, [isAdmin]);

  const handleNavigation = useCallback(
    (newIndex) => {
      // Ajuster l'index si les pages ont été filtrées
      const targetIndex =
        newIndex >= filteredPagesConfig.length
          ? filteredPagesConfig.length - 1
          : newIndex;

      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrentPageIndex(targetIndex);
      setTimeout(() => {
        setIsTransitioning(false);
        window.scrollTo(0, 0); // Scroll to top after page change
      }, 500);
    },
    [isTransitioning, filteredPagesConfig.length]
  );

  // Gestion de la navigation Canart simplifiée
  const handleCanartSectionChange = (sectionId) => {
    setActiveCanartSection(sectionId);
  };

  // Association des pages et leur contenu
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
            <Links />
          </div>
        );
      case "links":
        return (
          <div className="div-links">
            <Links />
          </div>
        );
      case "canart":
        // Ne rendre le contenu Canart que si l'utilisateur est administrateur
        if (!isAdmin) return null;

        return (
          <div className="div-canart">
            <div className="canart-nav-wrapper">
              <CanartNavigation
                activeSection={activeCanartSection}
                onSectionChange={handleCanartSectionChange}
                sections={canartModules}
              />
            </div>

            <div className="canart-sections">
              {canartModules.map((module) => {
                const ModuleComponent = module.component;
                return (
                  <div
                    key={module.id}
                    id={`canart-section-${module.id}`}
                    className={`canart-section ${
                      activeCanartSection === module.id ? "visible" : "hidden"
                    }`}
                  >
                    <div className="section-header">
                      <h2>
                        <span className="section-icon">{module.icon}</span>
                        {module.label}
                      </h2>
                    </div>
                    <ModuleComponent />
                  </div>
                );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="main-container">
      <Navigation
        currentPageIndex={currentPageIndex}
        handleNavigation={handleNavigation}
        pagesConfig={filteredPagesConfig}
      />
      <div className="pages-container">
        <div
          className={`pages-wrapper ${isTransitioning ? "transitioning" : ""}`}
          style={{
            width: `${filteredPagesConfig.length * 100}%`,
            transform: `translateX(-${
              (currentPageIndex * 100) / filteredPagesConfig.length
            }%)`,
          }}
        >
          {filteredPagesConfig.map((page) => (
            <div
              key={page.id}
              className={`page-section ${page.id}-section`}
              style={{
                flex: `0 0 ${100 / filteredPagesConfig.length}%`,
                maxWidth: `${100 / filteredPagesConfig.length}%`,
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
  );
}

export default Main;
