import React, { useEffect, useState } from "react";
import Header from "./components/Header.js";
import Main from "./components/Main.js";

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/auth/status`, {
          credentials: "include",
        });
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
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
    <div className="App">
      <Header />
      <Main />
    </div>
  );
};

export default App;
