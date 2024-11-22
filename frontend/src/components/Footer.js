import {
  Facebook,
  Github,
  LinkedinIcon,
  MessageSquare,
  Send,
} from "lucide-react";
import React, { useContext, useState } from "react";
import { UserContext } from "../App";

const Footer = () => {
  const [feedback, setFeedback] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const { userName } = useContext(UserContext);

  // Fonction pour sanitiser le feedback
  const sanitizeFeedback = (text) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const sanitizedFeedback = sanitizeFeedback(feedback); // Sanitisation du feedback

    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: userName, // Assurez-vous d'avoir accès à l'utilisateur connecté
            text: sanitizedFeedback, // Utilisation du feedback sanitizé
          }),
        }
      );

      if (response.ok) {
        setSubmitStatus("Merci pour votre feedback!");
        setFeedback("");
      } else {
        setSubmitStatus("Une erreur est survenue");
      }
    } catch (error) {
      console.error("Erreur:", error);
      setSubmitStatus("Une erreur est survenue");
    } finally {
      setTimeout(() => setSubmitStatus(""), 3000);
    }
  };

  return (
    <footer className="footer">
      <div className="footer__main">
        <div className="footer__grid">
          {/* À propos Section */}
          <div className="footer__section">
            <h3 className="footer__title">À propos</h3>
            <p className="footer__text">
              Centraliz est votre outil de productivité tout-en-un pour
              Iteemiens, Centraliens et Chimistes. <br/>
              Simplifiez votre organisation
              quotidienne en centralisant vos calendriers, notes et mails.
            </p>
            <div className="footer__version">
              <small>Version {process.env.REACT_APP_VERSION}</small>
            </div>
          </div>

          {/* Auteur/Contact Section */}
          <div className="footer__section">
            <h3 className="footer__title">Auteur</h3>
            <div className="footer__contact">
              <p className="footer__author">
                Développé par <b>Foucault Wattinne</b>
              </p>
              <p className="footer__contact-info">
                <a
                  href="mailto:foucault.wattinne@iteem.centralelille.fr"
                  className="footer__link"
                >
                  foucault.wattinne@iteem.centralelille.fr
                </a>
              </p>
              <div className="footer__social">
                <a
                  href="https://github.com/foucault-watt/centraliz"
                  className="footer__social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="GitHub"
                >
                  <Github size={18} />
                </a>
                <a
                  href="https://linkedin.com/in/foucault-wattinne"
                  className="footer__social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="LinkedIn"
                >
                  <LinkedinIcon size={18} />
                </a>
                <a
                  href="https://facebook.com/fukowatt"
                  className="footer__social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook"
                >
                  <Facebook size={18} />
                </a>
                <a
                  href="https://m.me/fukowatt"
                  className="footer__social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Messenger"
                >
                  <MessageSquare size={18} />
                </a>
              </div>
            </div>
          </div>

          {/* Feedback Form Section */}
          <div className="footer__section">
            <h3 className="footer__title">Feedback</h3>
            <form onSubmit={handleSubmit} className="footer__form">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Partagez vos suggestions..."
                className="footer__textarea"
                required
                maxLength={800} // Limitation à 800 caractères
              />
              <button type="submit" className="footer__submit">
                <Send size={14} />
                <span>Envoyer</span>
              </button>
              {submitStatus && (
                <div className="footer__status">{submitStatus}</div>
              )}
            </form>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
