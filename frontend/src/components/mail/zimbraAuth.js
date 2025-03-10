import React, { useContext, useState } from "react";
import { UserContext } from "../../App";

const ZimbraAuth = ({ setIsAuthenticated }) => {
  const { userName } = useContext(UserContext);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

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
      console.log(`[ZimbraAuth] Données reçues:`);

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

  const handlePasswordChange = (e) => {
    e.stopPropagation(); // Arrêter la propagation
    setPassword(e.target.value);
  };

  return (
    <div className="zimbra-auth-container" onClick={(e) => e.stopPropagation()}>
      <h2>Accès à vos derniers mails</h2>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <input
          type="password"
          value={password}
          placeholder="Entrez votre mot de passe ENT"
          onChange={handlePasswordChange}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          autoComplete="current-password"
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
