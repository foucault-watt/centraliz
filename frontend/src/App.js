import React, { createContext, useEffect, useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header.js";
import LoginPage from "./components/LoginPage.js";
import Main from "./components/Main.js";
import Onboarding from "./components/Onboarding.js";

// Importer les composants de page de manière lazy
const Notes = lazy(() => import("./components/Notes"));
const Calendars = lazy(() => import("./components/Calendars"));
const Communication = lazy(() => import("./components/Communication"));
const Bdi = lazy(() => import("./components/Bdi"));
const Links = lazy(() => import("./components/Links"));

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
        console.log("Fetching auth status from:", `${process.env.REACT_APP_URL_BACK}/api/auth/status`);
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
          const icalLink = data.user.icalLink;

          console.log("data.user:", data.user);
          console.log("icalLink:", icalLink);

          setNeedsOnboarding(!icalLink);
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
    return <LoginPage />;
  }

  return (
    <UserContext.Provider value={{ userName, displayName }}>
      <BrowserRouter>
        {needsOnboarding ? (
          <Onboarding
            userName={userName}
            onComplete={() => setNeedsOnboarding(false)}
          />
        ) : (
          <div className="App">
            <Header />
            <Suspense fallback={<div>Chargement...</div>}>
              <Routes>
                <Route path="/" element={<Main />}>
                  <Route index element={<Calendars />} />
                  <Route path="notes" element={<Notes />} />
                  <Route path="calendars" element={<Calendars />} />
                  <Route path="communication" element={<Communication />} />
                  <Route path="bdi" element={<Bdi />} />
                  <Route path="links" element={<Links />} />
                </Route>
              </Routes>
            </Suspense>
          </div>
        )}
      </BrowserRouter>
    </UserContext.Provider>
  );
};

export default App;
