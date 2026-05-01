import { Menu } from "lucide-react";
import { motion } from "framer-motion";
// import { useContext } from "react";
// import { UserContext } from "../App";

/**
 * Composant Header - Barre de navigation principale de l'application
 * Affiche le logo, le menu et les informations de classement de l'utilisateur
 */
export default function Header({ onMenuToggle }) {
  // Classement temporairement masque.
  // const [rankingInfo, setRankingInfo] = useState(null); // Informations de classement

  // Récupération du nom d'utilisateur depuis le contexte
  // const { user } = useContext(UserContext);
  // const displayName = user?.displayName || user?.userName;

  // /**
  //  * Récupère les informations de classement depuis l'API
  //  * @returns {Promise<Object|null>} Données de classement ou null en cas d'erreur
  //  */
  // const getRankingInfo = async () => {
  //   try {
  //     const response = await fetch(`/api/ranking/`, {
  //       method: "GET",
  //       credentials: "include",
  //     });
  //     if (!response.ok) throw new Error("Erreur réseau");
  //     return await response.json();
  //   } catch (error) {
  //     console.error("Erreur lors de la récupération du classement:", error);
  //     return null;
  //   }
  // };

  // // Effet pour récupérer les informations de classement
  // useEffect(() => {
  //   const fetchRanking = async () => {
  //     if (displayName) {
  //       const info = await getRankingInfo();
  //       setRankingInfo(info);
  //     }
  //   };
  //   fetchRanking();
  // }, [displayName]);

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
            <img src={"logo-title.png"} className="app-header-logo" alt="" />
          </span>
          <div className="app-header-wordmark">
            <span>Centraliz</span>
            <small>.it</small>
          </div>
        </div>

        {/* {rankingInfo && (
          <div
            className="app-header-ranking"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="ranking-short">Top {rankingInfo.rank}</span>
            <span className="ranking-message">{rankingInfo.message}</span>
            <div className="ranking-info">
              <Info size={16} />
              <div className="ranking-tooltip">
                <p>Calculé sur le nombre de jours de connexion uniques</p>
                <p>
                  Votre score : <strong>{rankingInfo.userScore}</strong> jours
                  de connexion
                </p>
              </div>
            </div>
          </div>
        )} */}
      </div>
    </motion.header>
  );
}
