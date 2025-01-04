import { Menu, Info } from "lucide-react";
import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../App";
import SlideMenu from "./SlideMenu";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { displayName } = useContext(UserContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [rankingInfo, setRankingInfo] = useState(null);

  const getRankingInfo = async (username) => {
    try {
      const response = await fetch(`/api/ranking/${encodeURIComponent(username)}`);
      if (!response.ok) throw new Error('Erreur réseau');
      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la récupération du classement:', error);
      return null;
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetchRanking = async () => {
      if (displayName) {
        const info = await getRankingInfo(displayName);
        setRankingInfo(info);
      }
    };
    fetchRanking();
  }, [displayName]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className={`header ${scrolled ? "scrolled" : ""}`}>
      <button
        className="header__menu-button"
        onClick={toggleMenu}
        aria-label="Menu"
      >
        <Menu />
      </button>

      <div
        onClick={toggleMenu}
        className="header-link"
        style={{ cursor: "pointer" }}
      >
        <img src={"logo-title.svg"} className="header-logo" alt="logo" />
        <h1 className="header-title">Centraliz</h1>
      </div>

      {rankingInfo && (
        <div className="header-ranking">
          <span className="ranking-text">
            {rankingInfo.message}
          </span>
          <div className="info-icon">
            <Info size={18} />
            <div className="info-tooltip">
              <p>Score basé sur le nombre de jours de connexion uniques</p>
              <p>Votre score: {rankingInfo.userScore} jours de connexion</p>
            </div>
          </div>
        </div>
      )}

      <SlideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </header>
  );
}
