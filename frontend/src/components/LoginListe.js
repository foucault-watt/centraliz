import { ChevronDown, ChevronUp, ExternalLink, Github, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import "../styles/LoginListe.scss";
import LegalNotice from "./LegalNotice";

const LoginListe = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLegalNotice, setShowLegalNotice] = useState(false);
  const featuresRef = useRef(null);
  const canartRef = useRef(null);
  const testimonialsRef = useRef(null);

  // Gérer les animations au scroll
  useEffect(() => {
    setIsLoaded(true);

    const handleScroll = () => {
      setScrollPosition(window.scrollY);

      // Animation des éléments au scroll
      const scrollElements = document.querySelectorAll(".scroll-animate");
      scrollElements.forEach((element) => {
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150;

        if (elementTop < window.innerHeight - elementVisible) {
          element.classList.add("active");
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Vérifier les éléments visibles au chargement
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogin = () => {
    window.location.href = `${process.env.REACT_APP_URL_BACK}/api/auth/login`;
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className={`centraliz-landing ${isLoaded ? "loaded" : ""}`}>
      <div className="animated-background">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <header className="centraliz-header">
        <div className="logo-container">
          <div className="logo-circle pulse">C</div>
          <h1 className="centraliz-title">
            <span className="title-part">Central</span>
            <span className="title-part accent">iz</span>
          </h1>
        </div>
        <p className="tagline">Simplifie ta vie étudiante à Centrale Lille</p>
      </header>

      <div className="login-floating">
        <button className="login-button primary" onClick={handleLogin}>
          <span>Se connecter</span>
          <span className="icon">→</span>
        </button>
      </div>

      <main className="centraliz-content">
        <section className="hero-section">
          <div className="hero-text">
            <h2>Tout Centrale Lille dans ta poche</h2>
            <p>Une interface unique pour tous tes besoins étudiants</p>
            <div className="hero-cta">
              <button className="cta-button primary" onClick={handleLogin}>
                <span>Se connecter avec Centrale Lille</span>
                <span className="icon">→</span>
              </button>
              <a href="#features" className="discover-more">
                Découvrir Centraliz
                <ChevronDown size={20} />
              </a>
            </div>
          </div>
          <div className="hero-image">
            <div className="phone-mockup">
              <div className="phone-screen">
                <div className="app-interface">
                  <div className="app-header"></div>
                  <div className="app-content">
                    <div className="content-block"></div>
                    <div className="content-block"></div>
                    <div className="content-block"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="features-section" ref={featuresRef}>
          <h2 className="section-title">Ce que Centraliz t'offre</h2>

          <div className="feature-cards">
            <div
              className="feature-card scroll-animate slide-from-right"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="feature-icon">📅</div>
              <h3>Emploi du temps</h3>
              <p>Accès instantané à ton planning de cours</p>
            </div>

            <div
              className="feature-card scroll-animate slide-from-right"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="feature-icon">🎉</div>
              <h3>Événements CLA</h3>
              <p>Calendrier des soirées et activités du campus</p>
            </div>

            <div
              className="feature-card scroll-animate slide-from-right"
              style={{ animationDelay: "0.5s" }}
            >
              <div className="feature-icon">📝</div>
              <h3>Notes</h3>
              <p>Consulte tes résultats académiques en temps réel</p>
            </div>

            <div
              className="feature-card scroll-animate slide-from-right"
              style={{ animationDelay: "0.7s" }}
            >
              <div className="feature-icon">📧</div>
              <h3>Emails Zimbra</h3>
              <p>Tous tes mails importants en un coup d'œil</p>
            </div>
          </div>
        </section>

        <section
          className="canart-promo scroll-animate fade-in"
          ref={canartRef}
        >
          <div className="promo-content">
            <div className="badge">Nouveau</div>
            <h2>Canart'Man x Centraliz</h2>
            <p>
              Le futur BDA s'associe à Centraliz pour te proposer une expérience
              culturelle inédite
            </p>
            <ul className="promo-features">
              <li
                className="scroll-animate slide-from-right"
                style={{ animationDelay: "0.1s" }}
              >
                ✨ Événements artistiques
              </li>
              <li
                className="scroll-animate slide-from-right"
                style={{ animationDelay: "0.2s" }}
              >
                ✨ Ateliers créatifs
              </li>
              <li
                className="scroll-animate slide-from-right"
                style={{ animationDelay: "0.3s" }}
              >
                ✨ Accès privilégié aux spectacles
              </li>
            </ul>
          </div>
          <div className="promo-visual">
            <div className="canart-logo parallax" data-speed="0.1">
              <span>A'C</span>
            </div>
          </div>
        </section>

        <section
          className="testimonials scroll-animate fade-in"
          ref={testimonialsRef}
        >
          <h2 className="section-title">Ce que les étudiants en disent</h2>
          <div className="testimonial-slider">
            <div
              className="testimonial scroll-animate slide-from-right"
              style={{ animationDelay: "0.1s" }}
            >
              <p>
                "Centraliz m'a sauvé la vie. Plus besoin de jongler entre 5
                sites différents !"
              </p>
              <div className="student-info">Emma, G1</div>
            </div>
            <div
              className="testimonial scroll-animate slide-from-right"
              style={{ animationDelay: "0.3s" }}
            >
              <p>
                "L'app qui manquait à Centrale. Simple, rapide et efficace."
              </p>
              <div className="student-info">Thomas, G2</div>
            </div>
            <div
              className="testimonial scroll-animate slide-from-right"
              style={{ animationDelay: "0.5s" }}
            >
              <p>
                "Je ne rate plus aucun événement du campus grâce aux
                notifications."
              </p>
              <div className="student-info">Léa, G3</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="centraliz-footer">
        <div className="footer-content">
          <div className="footer-top">
            <p>Centraliz © {new Date().getFullYear()}</p>
            <p className="creator">Par des étudiants, pour des étudiants</p>
          </div>
          <div className="footer-links">
            <button
              className="legal-notice-button"
              onClick={() => setShowLegalNotice(true)}
            >
              Mentions légales
            </button>
            <a
              href="https://github.com/foucault-watt/centraliz"
              className="github-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={20} />
              Voir sur GitHub
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
        <div className="footer-actions">
          <button className="login-button secondary" onClick={handleLogin}>
            Connexion
          </button>
          <button className="scroll-top" onClick={scrollToTop}>
            <ChevronUp size={20} />
          </button>
        </div>
      </footer>

      {/* Modal pour les mentions légales */}
      {showLegalNotice && (
        <div className="legal-notice-modal">
          <div
            className="modal-overlay"
            onClick={() => setShowLegalNotice(false)}
          ></div>
          <div className="modal-content">
            <button
              className="close-modal"
              onClick={() => setShowLegalNotice(false)}
            >
              <X size={24} />
            </button>
            <LegalNotice />
          </div>
        </div>
      )}

      {/* Éléments flottants qui suivent le scroll */}
      <div className="floating-elements">
        <div
          className="floating-element"
          style={{
            transform: `translateY(${scrollPosition * 0.15}px) rotate(${
              scrollPosition * 0.05
            }deg)`,
          }}
        ></div>
        <div
          className="floating-element"
          style={{
            transform: `translateY(${scrollPosition * -0.2}px) rotate(${
              scrollPosition * -0.08
            }deg)`,
          }}
        ></div>
        <div
          className="floating-element"
          style={{
            transform: `translateY(${scrollPosition * 0.25}px) rotate(${
              scrollPosition * 0.03
            }deg)`,
          }}
        ></div>
      </div>
    </div>
  );
};

export default LoginListe;
