import { Menu } from "lucide-react";
import { motion } from "framer-motion";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import { getSetupStatus } from "../utils/getSetupStatus";

/**
 * Composant Header - Barre de navigation principale de l'application
 * Affiche le logo, le menu, et la pastille d'accès aux Réglages.
 */
export default function Header({ onMenuToggle }) {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const setupStatus = getSetupStatus(user);
  const progressPercent = Math.round(
    (setupStatus.completedCount / setupStatus.totalCount) * 100,
  );
  const avatarColor = setupStatus.activeColor?.primary || "#ffffff";
  const avatarIconUrl = setupStatus.activeColor?.iconUrl
    ? `${process.env.REACT_APP_URL_BACK}${setupStatus.activeColor.iconUrl}`
    : null;

  return (
    <motion.header
      className="app-header"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: "easeOut" }}
    >
      <div className="app-header-inner">
        <motion.button
          type="button"
          className="app-header-menu"
          onClick={onMenuToggle}
          aria-label="Ouvrir le menu"
          whileTap={{ scale: 0.94 }}
        >
          <Menu size={22} />
        </motion.button>

        <div className="app-header-brand" aria-label="Centraliz.it">
          <span className="app-header-logo-frame">
            <img src={"/logo-title.png"} className="app-header-logo" alt="" />
          </span>
          <div className="app-header-wordmark">
            <span>Centraliz</span>
            <small>.it</small>
          </div>
        </div>

        <motion.button
          type="button"
          className={`app-header-avatar${
            setupStatus.isComplete ? " app-header-avatar-complete" : ""
          }`}
          style={{
            "--avatar-color": avatarColor,
            "--avatar-progress": `${progressPercent}%`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            navigate("/reglages");
          }}
          aria-label={
            setupStatus.isComplete
              ? "Ouvrir mes réglages"
              : `Ouvrir mes réglages — configuration à ${progressPercent}%`
          }
          whileTap={{ scale: 0.94 }}
        >
          {avatarIconUrl ? (
            <img
              src={avatarIconUrl}
              alt=""
              className="app-header-avatar-icon"
            />
          ) : (
            <span className="app-header-avatar-dot" />
          )}
        </motion.button>
      </div>
    </motion.header>
  );
}
