import React, { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import SlideMenu from "./SlideMenu";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <button 
        className="header__menu-button" 
        onClick={toggleMenu}
        aria-label="Menu"
      >
        <Menu />
      </button>
      
      <div onClick={toggleMenu} className="header-link" style={{ cursor: 'pointer' }}>
        <img src={"logo-title.svg"} className="header-logo" alt="logo" />
        <h1 className="header-title">Centraliz</h1>
      </div>

      <SlideMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)}
      />
    </header>
  );
}
