import React, { createContext } from "react";
import { Outlet } from "react-router-dom";
import { pagesConfig } from "../config/pages";
import Navigation from "./Navigation";

// Créer un contexte pour les logos
export const LogoVisibilityContext = createContext(null);

function Main() {
  return (
    <LogoVisibilityContext.Provider value={{ logoVisibility: false, setLogoVisibility: () => {} }}>
      <div className="main-container">
        <Navigation pagesConfig={pagesConfig} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </LogoVisibilityContext.Provider>
  );
}

export default Main;
