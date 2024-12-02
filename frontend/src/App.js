import React, { createContext, useEffect, useState } from "react";
import Header from "./components/Header.js";
import Main from "./components/Main.js";
import Footer from "./components/Footer.js";

export const UserContext = createContext();

const isBot = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const botPattern = /bot|crawl|slurp|spider|mediapartners|google|bing|inspection/i;
  return botPattern.test(userAgent);
};

const App = () => {
  const [userName, setUserName] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

        setUserName(data.user.userName);
        setDisplayName(data.user.displayName);

      } catch (error) {
        console.error("Error checking auth status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log(`${process.env.REACT_APP_URL_BACK}/api/auth/login`);
      window.location.href = `${process.env.REACT_APP_URL_BACK}/api/auth/login`;
    }
  }, [isLoading, isAuthenticated]);

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
    return null; // This will prevent any content from being rendered before redirect
  }

  return (
    <UserContext.Provider value={{ userName, displayName }}>
      <div className="App">
        <Header />
        <Main />
        <Footer />
      </div>
    </UserContext.Provider>
  );
};

export default App;
