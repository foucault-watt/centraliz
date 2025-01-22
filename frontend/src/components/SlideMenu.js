import React from 'react';
import {
  X,
  Facebook,
  Github,
  LinkedinIcon,
  MessageSquare,
  Send,
  Download,
  Info,
  MessageCircle,
  Mail,
} from "lucide-react";

const SlideMenu = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = React.useState('main');
  const [feedback, setFeedback] = React.useState("");
  const [submitStatus, setSubmitStatus] = React.useState("");


  React.useEffect(() => {
    if (!isOpen) {
      setActiveSection('main');
    }
  }, [isOpen]);

  const sanitizeFeedback = (text) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    
    const sanitizedFeedback = sanitizeFeedback(feedback);
    setSubmitStatus("Envoi en cours...");

    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/feedback`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sanitizedFeedback,
          }),
        }
      );

      if (response.ok) {
        setSubmitStatus("Merci pour votre feedback!");
        setFeedback("");
        setTimeout(() => {
          setActiveSection('main');
          setSubmitStatus("");
        }, 3000);
      } else {
        throw new Error('Réponse serveur non valide');
      }
    } catch (error) {
      console.error("Erreur:", error);
      setSubmitStatus("Une erreur est survenue");
      setTimeout(() => setSubmitStatus(""), 3000);
    }
  };

  const getInstallInstructions = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isFirefox = ua.toLowerCase().indexOf('firefox') > -1;
    const isChrome = /chrome/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if (isIOS) {
      return "Sur iOS : Appuyez sur l'icône 'Partager' en bas de Safari, puis sélectionnez 'Sur l'écran d'accueil'";
    } else if (isAndroid && isChrome) {
      return "Sur Android : Appuyez sur les trois points en haut à droite, puis 'Ajouter à l'écran d'accueil'";
    } else if (isFirefox) {
      return "Sur Firefox : Appuyez sur les trois points dans la barre d'adresse, puis 'Installer l'application'";
    } else if (isSafari) {
      return "Sur Safari : Utilisez le menu 'Partager' puis 'Ajouter à l'écran d'accueil'";
    }
    return "Dans votre navigateur : Utilisez le menu (⋮) puis 'Installer l'application' ou 'Ajouter à l'écran d'accueil'";
  };

  console.log()

  const menuSections = {
    install: {
      title: "Installation",
      icon: Download,
      content: () => (
        <div className="slide-menu__section">
          <h3>Installation</h3>
          <p>{getInstallInstructions()}</p>
        </div>
      )
    },
    about: {
      title: "À propos",
      icon: Info,
      content: () => (
        <div className="slide-menu__section">
          <h3>À propos</h3>
          <p>
            Centraliz est votre outil de productivité tout-en-un pour
            Iteemiens, Centraliens et Chimistes.
            Simplifiez votre organisation quotidienne en centralisant
            vos calendriers, notes et mails.
          </p>
          <p className="version">Version {process.env.REACT_APP_VERSION}</p>
        </div>
      )
    },
    feedback: {
      title: "Feedback",
      icon: MessageCircle,
      content: () => (
        <div className="slide-menu__section">
          <h3>Feedback</h3>
          <form onSubmit={handleFeedbackSubmit}>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Partagez vos suggestions..."
              required
              maxLength={800}
            />
            <button type="submit">
              <Send size={14} />
              <span>Envoyer</span>
            </button>
            {submitStatus && <div className="status-message">{submitStatus}</div>}
          </form>
        </div>
      )
    },
    contact: {
      title: "Contact",
      icon: Mail,
      content: () => (
        <div className="slide-menu__section">
          <h3>Contact</h3>
          <p><strong>Foucault Wattinne</strong></p>
          <a href="mailto:foucault.wattinne@iteem.centralelille.fr">
            foucault.wattinne@iteem.centralelille.fr
          </a>
          <div className="social-links">
            <a href="https://github.com/foucault-watt/centraliz" target="_blank" rel="noopener noreferrer">
              <Github size={18} />
            </a>
            <a href="https://linkedin.com/in/foucault-wattinne" target="_blank" rel="noopener noreferrer">
              <LinkedinIcon size={18} />
            </a>
            <a href="https://facebook.com/fukowatt" target="_blank" rel="noopener noreferrer">
              <Facebook size={18} />
            </a>
            <a href="https://m.me/fukowatt" target="_blank" rel="noopener noreferrer">
              <MessageSquare size={18} />
            </a>
          </div>
        </div>
      )
    }
  };

  const renderContent = () => {
    if (activeSection === 'main') {
      return (
        <div className="slide-menu__main">
          {Object.entries(menuSections).map(([key, section]) => (
            <button key={key} onClick={() => setActiveSection(key)}>
              <section.icon size={18} />
              <span>{section.title}</span>
            </button>
          ))}
        </div>
      );
    }
    
    const section = menuSections[activeSection];
    return section ? section.content() : null;
  };

  return (
    <div className={`slide-menu ${isOpen ? 'open' : ''}`}>
      <div className="slide-menu__overlay" onClick={onClose} />
      <div className="slide-menu__content">
        <button className="slide-menu__close" onClick={onClose}>
          <X size={24} />
        </button>
        {activeSection !== 'main' && (
          <button 
            className="slide-menu__back"
            onClick={() => setActiveSection('main')}
          >
            Retour
          </button>
        )}
        {renderContent()}
      </div>
    </div>
  );
};

export default SlideMenu;
