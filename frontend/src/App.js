import React, { createContext, useEffect, useState } from "react";
import Header from "./components/Header.js";
import Main from "./components/Main.js";

export const UserContext = createContext();

const App = () => {
  const [userName, setUserName] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        console.log(data);
        setIsAuthenticated(data.authenticated);

        setUserName(data.user.userName);
        setDisplayName(data.user.displayName);

        console.log(data.user.userName);
        console.log(data.user.displayName);
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
        <img src={"logo-title.png"} className="logo-loading" alt="logo" />
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
      </div>
    </UserContext.Provider>
  );
};

export default App;
