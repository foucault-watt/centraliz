import React, { createContext, useEffect, useState } from "react";
import Header from "./components/Header.js";
import Main from "./components/Main.js";
import Onboarding from "./components/Onboarding.js"; // Ajoutez cette ligne
import LoginPage from "./components/LoginPage.js"; // Ajoutez cette ligne

export const UserContext = createContext();

const isBot = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  console.log('Current UserAgent:', userAgent); // Aide au débogage
  
  const bingBotPatterns = [
    'bingbot',
    'msnbot',
    'adidxbot',
    'bingpreview'
  ];
  
  const otherBotPatterns = [
    'bot',
    'crawl',
    'spider',
    'slurp',
    'mediapartners',
    'google'
  ];
  
  // Vérifie d'abord spécifiquement les bots Bing
  if (bingBotPatterns.some(pattern => userAgent.includes(pattern))) {
    console.log('Bing bot detected');
    return true;
  }
  
  // Vérifie ensuite les autres patterns de bots
  if (otherBotPatterns.some(pattern => userAgent.includes(pattern))) {
    console.log('Other bot detected');
    return true;
  }
  
  return false;
};

const App = () => {
  const [userName, setUserName] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (isBot()) {
      window.location.href = "/bot-index.html";
      return;
    }

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

          const calendarResponse = await fetch(
            `${process.env.REACT_APP_URL_BACK}/api/check-user/${data.user.userName}`
          );
          const calendarData = await calendarResponse.json();
          setNeedsOnboarding(!calendarData.exists);
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
        <img src={"logo-title.svg"} className="logo-loading" alt="logo" rel="preload" />
        <span className="title-loading">
          <b>Centraliz</b>
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;  // Afficher la page de connexion au lieu de rediriger
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
          {/* Suppression du Footer */}
        </div>
      )}
    </UserContext.Provider>
  );
};

export default App;
