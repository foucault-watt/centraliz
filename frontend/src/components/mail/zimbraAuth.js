import React, { useContext, useState } from "react";
import { UserContext } from "../../App";
import { motion, AnimatePresence } from "framer-motion";
import Loader from "../Loader";

const ZimbraAuth = ({ setIsAuthenticated, authStatus }) => {
  const { user } = useContext(UserContext);
  const userName = user?.userName;
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Traitement...");

    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/zimbra`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ password, rememberMe }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("Authentification réussie !");
        setIsAuthenticated(true);
      } else {
        setStatus(data.error || "Échec de l'authentification.");
      }
    } catch (error) {
      console.error("Erreur:", error);
      setStatus("Erreur lors de la connexion.");
    }
  };

  const handlePasswordChange = (e) => {
    e.stopPropagation();
    setPassword(e.target.value);
  };

  return (
    <div className="zimbra-auth-container" onClick={(e) => e.stopPropagation()}>
      <AnimatePresence mode="wait">
        {authStatus === "pending" && (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader />
          </motion.div>
        )}

        {authStatus === "failure" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ZimbraAuth;
