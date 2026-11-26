import { AnimatePresence, motion } from "framer-motion";
import { useContext, useState } from "react";
import { UserContext } from "../../App";
import { fetchApi } from "../../utils/api";
import EntPasswordForm, { EntUsernameField } from "../EntPasswordForm";
import {
  browserEntStorageUnavailable,
  saveBrowserEntCredentials,
} from "../../utils/browserEntCredentials";
import Loader from "../Loader";

const ZimbraAuth = ({ onAuthenticated, authStatus }) => {
  const { user, setUser } = useContext(UserContext);
  const browserStorage = user?.ent_password_storage === "browser";
  const [entUsername, setEntUsername] = useState(user?.ent_username || "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus("");

    try {
      const credentials = { ent_username: entUsername, password };
      const response = await fetchApi("/api/zimbra", {
        method: "POST",
        body: JSON.stringify({
          ...credentials,
          rememberMe: !browserStorage && rememberMe,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const saved = browserStorage &&
          await saveBrowserEntCredentials(user.userName, credentials);
        if (browserStorage) {
          setUser((previous) => previous?.userName === user.userName
            ? { ...previous, ent_username: entUsername }
            : previous);
        }
        setPassword("");
        onAuthenticated(
          data.mails,
          browserStorage && !saved ? browserEntStorageUnavailable : "",
          browserStorage && !saved ? credentials : null,
        );
      } else if (data.code === "USER_KEY_MISSING") {
        setStatus("Session locale incomplete. Recharge la page puis reessaie.");
      } else if (data.code === "USER_KEY_INVALID") {
        setStatus("Ta cle locale a expire. Reconnecte-toi pour resynchroniser l'acces ENT.");
      } else {
        setStatus(data.error || "Échec de l'authentification.");
      }
    } catch (error) {
      console.error("Erreur:", error);
      setStatus("Erreur lors de la connexion.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = (e) => {
    e.stopPropagation();
    setPassword(e.target.value);
  };

  if (browserStorage && authStatus === "failure") {
    return (
      <EntPasswordForm
        title="Accède à tes mails"
        password={password}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
        submitLabel="Ouvrir mes mails"
        busy={submitting}
        error={status}
      >
        <EntUsernameField value={entUsername} onChange={setEntUsername} />
      </EntPasswordForm>
    );
  }

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
                type="text"
                value={entUsername}
                placeholder="Identifiant ENT (ex: pnom)"
                onChange={(e) => setEntUsername(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                autoComplete="username"
                required
                style={{ marginBottom: "10px" }}
              />
              <input
                type="password"
                value={password}
                placeholder="Mot de passe ENT"
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
              <button type="submit" disabled={submitting}>
                {submitting ? "Connexion en cours…" : "Se connecter"}
              </button>
            </form>
            {status && <p>{status}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ZimbraAuth;
