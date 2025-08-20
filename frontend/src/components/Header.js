import { Info } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "../App";

/**
 * Composant Header - Barre de navigation principale de l'application
 * Affiche le logo, le menu et les informations de classement de l'utilisateur
 */
export default function Header() {
  // États locaux
  const [rankingInfo, setRankingInfo] = useState(null); // Informations de classement

  // Récupération du nom d'utilisateur depuis le contexte
  const { displayName } = useContext(UserContext);

  /**
   * Récupère les informations de classement depuis l'API
   * @returns {Promise<Object|null>} Données de classement ou null en cas d'erreur
   */
  const getRankingInfo = async () => {
    try {
      const response = await fetch(`/api/ranking/`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erreur réseau");
      return await response.json();
    } catch (error) {
      console.error("Erreur lors de la récupération du classement:", error);
      return null;
    }
  };

  // Effet pour récupérer les informations de classement
  useEffect(() => {
    const fetchRanking = async () => {
      if (displayName) {
        const info = await getRankingInfo();
        setRankingInfo(info);
      }
    };
    fetchRanking();
  }, [displayName]);


  return (
    <>
      <header className="bg-primary-dark text-white top-0 z-50 shadow-md sticky w-full overflow-visible">
        {/* Logo et titre */}
        <div className="flex justify-center items-center h-20">
          <img src={"logo-title.png"} className="h-14 pr-2" alt="logo" />
          <h1 className="text-4xl font-semibold tracking-wide text-day">Centraliz</h1>
          <span className="text-2xl font-light opacity-80 text-day ml-0.5 tracking-tighter hidden sm:inline">.it</span>
        </div>

        {/* Affichage du classement si disponible */}
        {rankingInfo && (
          <div
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-day text-sm max-w-xs text-right"
            onClick={(e) => e.stopPropagation()} // Empêcher la fermeture du menu quand on clique sur les infos de classement
          >
            <span className="font-medium block leading-tight whitespace-normal break-words mr-1 sm:hidden">Top {rankingInfo.rank}</span>
            <span className="font-medium block leading-tight whitespace-normal break-words hidden sm:block">{rankingInfo.message}</span>
            <div className="relative cursor-help flex items-center p-1 rounded-full transition-colors hover:bg-white hover:bg-opacity-10 hidden sm:flex group">
              <Info size={18} />
              <div className="absolute right-0 top-full bg-white text-secondary p-3 rounded-md shadow-lg w-max max-w-xs invisible opacity-0 translate-y-[-10px] transition-all ease-in-out duration-200 z-50 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0">
                <p className="my-0.5 text-sm leading-tight">Calculé sur le nombre de jours de connexion uniques</p>
                <p className="my-0.5 text-sm leading-tight">
                  Votre score : <strong className="font-bold">{rankingInfo.userScore}</strong> jours
                  de connexion
                </p>
              </div>
            </div>
          </div>
        )}

      </header>
    </>
  );
}
