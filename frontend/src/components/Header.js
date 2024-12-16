import React, { useState, useEffect } from "react";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);  // Changé de 50 à 0
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <a href="https://r.mtdv.me/centraliz" target="_blank" rel="noreferrer" className="header-link">
        <img src={"logo-title.svg"} className="header-logo" alt="logo" />
        <h1 className="header-title">Centraliz</h1>
      </a>
    </header>
  );
}
