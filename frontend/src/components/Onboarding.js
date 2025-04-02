import { ArrowRight, ExternalLink } from "lucide-react";
import React, { useState } from "react";
import { steps } from "../data/onboarding-steps";

const Onboarding = ({ userName, onComplete }) => {
  const [icalLink, setIcalLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const handleSubmitLink = async (e) => {
    e.preventDefault();
    setLinkError("");

    try {
      const validationResponse = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/validate-ical`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icalLink }),
        }
      );

      const validationData = await validationResponse.json();
      if (!validationData.isValid) {
        setLinkError(
          "Ce lien ne semble pas valide. Vérifie que tu l'as bien copié !"
        );
        return;
      }

      await fetch(`${process.env.REACT_APP_URL_BACK}/api/save-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userName, icalLink }),
      });

      onComplete();
    } catch (error) {
      setLinkError("Oups ! Une erreur s'est produite. Réessaie !");
    }
  };

  // Fonction pour sauter l'étape du lien iCal
  const handleSkipIcalStep = async () => {
    try {
      // Notifier le backend que l'utilisateur a décidé de sauter cette étape
      await fetch(`${process.env.REACT_APP_URL_BACK}/api/skip-ical-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: userName }),
      });

      // Compléter l'onboarding
      onComplete();
    } catch (error) {
      console.error("Erreur lors du contournement de l'étape iCal:", error);
      setLinkError("Impossible de passer cette étape. Réessaie plus tard !");
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-content">
        <div className="onboarding-step animate-fade-in">
          <div className="step-icon">{steps[currentStep].icon}</div>
          <h1>{steps[currentStep].title}</h1>
          <p>{steps[currentStep].content}</p>
        </div>

        {currentStep === steps.length - 1 ? (
          <div className="onboarding-form animate-slide-up">
            <div className="tutorial-container">
              <video
                src="/export-hp.mp4"
                className="tutorial-video"
                autoPlay
                loop
                muted
                playsInline
              />
              <a
                href="https://planning.centralelille.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="hyperplanning-link"
              >
                Ouvrir Hyperplanning{" "}
                <ExternalLink size={16} className="inline-block ml-1" />
              </a>
            </div>

            <form onSubmit={handleSubmitLink}>
              <div className="input-group">
                <input
                  type="text"
                  value={icalLink}
                  onChange={(e) => setIcalLink(e.target.value)}
                  placeholder="Colle ton lien iCal ici"
                  required
                />
                {linkError && <div className="error-message">{linkError}</div>}
              </div>
              <button type="submit" className="submit-button">
                C'est parti ! 🚀
              </button>
            </form>

            <div className="skip-option">
              <button onClick={handleSkipIcalStep} className="skip-button">
                Accéder au site sans configurer mon calendrier
              </button>
              <p className="skip-info">
                Tu pourras configurer ton calendrier plus tard dans les
                paramètres
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCurrentStep((curr) => curr + 1)}
            className="next-button animate-pulse"
          >
            Continuer l'aventure{" "}
            <ArrowRight size={20} className="inline-block ml-1" />
          </button>
        )}

        <div className="steps-indicator">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
