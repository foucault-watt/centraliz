// frontend/src/components/ZimbraAuth.js
import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../App";

const ZimbraAuth = ({ setIsAuthenticated }) => {
  const { userName } = useContext(UserContext);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const checkStoredPassword = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/zimbra/check`,
          {
            credentials: "include",
          }
        );
        const data = await response.json();
        if (data.hasPassword) {
          setStatus("Authentification automatique...");
          const authResponse = await fetch(
            `${process.env.REACT_APP_URL_BACK}/api/zimbra/auto-auth`,
            {
              method: "POST",
              credentials: "include",
            }
          );
          const authData = await authResponse.json();
          if (authResponse.ok && authData.success) {
            setStatus("Authentification réussie !");
            setIsAuthenticated(true);
          } else {
            setStatus(authData.error || "Échec de l'authentification automatique.");
          }
        }
      } catch (error) {
        console.error("Erreur:", error);
        setStatus("Erreur lors de l'authentification automatique.");
      }
    };
    checkStoredPassword();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Traitement...");

    try {
      console.log(
        `[ZimbraAuth] Envoi de la requête pour l'utilisateur: ${userName}`
      );
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/zimbra`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ username: userName, password, rememberMe }),
        }
      );

      console.log(`[ZimbraAuth] Statut de la réponse: ${response.status}`);

      const data = await response.json();
      console.log(`[ZimbraAuth] Données reçues:`, data);

      if (response.ok && data.success) {
        setStatus("Authentification réussie !");
        setIsAuthenticated(true); // Met à jour l'état d'authentification
      } else {
        setStatus(data.error || "Échec de l'authentification.");
      }
    } catch (error) {
      console.error("Erreur:", error);
      setStatus("Erreur lors de la connexion.");
    }
  };

  return (
    <div className="zimbra-auth-container">
      <h2>Accès à vos derniers mails</h2>
      <span className="wendling">Merci à Maxime Wendling</span>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          placeholder="Entrez votre mot de passe ENT"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="remember-me">
          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Se souvenir du mot de passe
          </label>
        </div>
        <button type="submit">Se connecter</button>
      </form>
      {status && <p>{status}</p>}
    </div>
  );
};

export default ZimbraAuth;
