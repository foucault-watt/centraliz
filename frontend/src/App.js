import React, { createContext, useEffect, useState } from "react";
import Header from "./components/Header.js";
import LoginListe from "./components/LoginListe.js";
import Main from "./components/Main.js";
import Onboarding from "./components/Onboarding.js"; // Ajoutez cette ligne
import "./styles/CanartNavigation.scss";
import LoginPage from "./components/LoginPage.js";

export const UserContext = createContext();

const App = () => {
  const [userName, setUserName] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/auth/status`,
          {
            credentials: "include",
          }
        );
        const data = await response.json();
        setIsAuthenticated(data.authenticated);

        if (data.authenticated) {
          setUserName(data.user.userName);
          setDisplayName(data.user.displayName);

          // Utiliser la nouvelle route pour vérifier si l'onboarding est nécessaire
          const onboardingResponse = await fetch(
            `${process.env.REACT_APP_URL_BACK}/api/auth/check-onboarding`,
            {
              method: "GET",
              credentials: "include",
            }
          );
          const onboardingData = await onboardingResponse.json();
          setNeedsOnboarding(onboardingData.needsOnboarding);
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <img
          src={"logo-title.png"}
          className="logo-loading"
          alt="logo"
          rel="preload"
        />
        <span className="title-loading">
          <b>Centraliz</b>
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginListe />; // Afficher la page de connexion au lieu de rediriger
  }

  return (
    <UserContext.Provider value={{ userName, displayName }}>
      {needsOnboarding ? (
        <Onboarding
          userName={userName}
          onComplete={() => setNeedsOnboarding(false)}
        />
      ) : (
        <div className="App">
          <Header />
          <Main />
        </div>
      )}
    </UserContext.Provider>
  );
};

export default App;
