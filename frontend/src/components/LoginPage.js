import React from 'react';
import {
  Calendar,
  Mail,
  BookOpen,
  Clock,
  Users,
  Shield,
  Star,
  Coffee,
  Gift,
  Heart,
  Github,
  ExternalLink,
  LogIn
} from 'lucide-react';

const LoginPage = () => {
  const handleLogin = () => {
    window.location.href = `${process.env.REACT_APP_URL_BACK}/api/auth/login`;
  };

  return (
    <div className="login-page">
      <header className="login-header">
        <img src="/logo-title.svg" alt="Centraliz Logo" className="login-logo" />
        <h1>Centraliz - Votre Assistant Étudiant Numérique à Centrale Lille</h1>
        <p className="lead">
          Simplifiez votre vie étudiante en unifiant l'accès à tous vos outils essentiels
        </p>
        <button className="login-button" onClick={handleLogin}>
          <LogIn size={80} /> {/* Augmentation de la taille de l'icône */}
          Se connecter avec le CAS Centrale Lille
        </button>
      </header>

      <main className="login-content">
        <section className="features">
          <h2>Fonctionnalités Principales</h2>
          <div className="features-grid">
            <div className="feature-card">
              <Calendar className="feature-icon" />
              <h3>Calendriers Unifiés</h3>
              <p>Accédez à vos emplois du temps et événements en un seul endroit</p>
            </div>
            <div className="feature-card">
              <Mail className="feature-icon" />
              <h3>Messagerie Intégrée</h3>
              <p>Gérez vos emails Zimbra directement depuis Centraliz</p>
            </div>
            <div className="feature-card">
              <BookOpen className="feature-icon" />
              <h3>Suivi Académique</h3>
              <p>Consultez vos notes et documents de cours facilement</p>
            </div>
          </div>
        </section>

        <section className="benefits">
          <h2>Les Avantages</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <Clock className="benefit-icon" />
              <h3>Gain de Temps</h3>
              <p>Économisez jusqu'à 30 minutes par jour en évitant les connexions multiples</p>
            </div>
            <div className="benefit-card">
              <Users className="benefit-icon" />
              <h3>Fait pour Vous</h3>
              <p>Développé par un étudiant pour des étudiants</p>
            </div>
            <div className="benefit-card">
              <Shield className="benefit-icon" />
              <h3>Sécurisé</h3>
              <p>Authentification CAS et données protégées</p>
            </div>
            <div className="benefit-card">
              <Star className="benefit-icon" />
              <h3>Design</h3>
              <p>Une application moderne pour tous les usages</p>
            </div>
          </div>
        </section>

        <section className="latest-features">
          <h2>Nouveautés</h2>
          <div className="latest-features-grid">
            <div className="latest-feature-card">
              <Coffee className="feature-icon" />
              <h3>Cacul des notes</h3>
              <p>Les notes sont calculés avec les bons coefs</p>
            </div>
            <div className="latest-feature-card">
              <Gift className="feature-icon" />
              <h3>Comparez votre calendrier</h3>
              <p>Selectionnez un prof, une salle ou un autre étudiant pour voir son calendrier</p>
            </div>
          </div>
        </section>

        <section className="community">
          <h2>Rejoignez la Communauté</h2>
          <p className="community-text">
            Centraliz est un projet open source en constante évolution grâce à sa communauté.
            Participez au développement et suggérez de nouvelles fonctionnalités !
          </p>
          <div className="community-links">
            <a href="https://github.com/foucault-watt/centraliz" className="github-link" target="_blank" rel="noopener noreferrer">
              <Github size={20} />
              Voir sur GitHub
              <ExternalLink size={16} />
            </a>
          </div>
        </section>
      </main>

      <footer className="login-footer">
        <p>
          <Heart size={16} className="heart-icon" /> Développé avec passion pour la communauté de Centrale Lille
        </p>
        <div className="footer-links">
          Mentions légales
          <span className="separator">•</span>
          Confidentialité
          <span className="separator">•</span>
          Contact
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;
