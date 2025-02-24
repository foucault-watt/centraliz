import { Info, Menu } from "lucide-react";
import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../App";
import SlideMenu from "./SlideMenu";

/**
 * Composant Header - Barre de navigation principale de l'application
 * Affiche le logo, le menu et les informations de classement de l'utilisateur
 */
export default function Header() {
  // États locaux
  const [scrolled, setScrolled] = useState(false); // État de défilement de la page
  const [isMenuOpen, setIsMenuOpen] = useState(false); // État d'ouverture du menu
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

  // Effet pour gérer le scroll de la page
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  // Gestion de l'ouverture/fermeture du menu
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <>
      <header className={`header ${scrolled ? "scrolled" : ""}`}>
        {/* Bouton du menu hamburger */}
        <button
          className="header__menu-button"
          onClick={toggleMenu}
          aria-label="Menu"
        >
          <Menu />
        </button>

        {/* Logo et titre */}
        <div
          onClick={toggleMenu}
          className="header-link"
          style={{ cursor: "pointer" }}
        >
          <img src={"logo-title.png"} className="header-logo" alt="logo" />
          <h1 className="header-title">Centraliz</h1>
          <span className="header-domain-suffix">.it</span>
        </div>

        {/* Affichage du classement si disponible */}
        {rankingInfo && (
          <div className="header-ranking">
            <span className="ranking-text">{rankingInfo.message}</span>
            <div className="info-icon">
              <Info size={18} />
              <div className="info-tooltip">
                <p>Calculé sur le nombre de jours de connexion uniques</p>
                <p>
                  Votre score : <strong>{rankingInfo.userScore}</strong> jours
                  de connexion
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Menu latéral */}
        <SlideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      </header>
    </>
  );
}
