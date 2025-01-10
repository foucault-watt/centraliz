import React, { useState } from "react";
import { ArrowRight } from "lucide-react";

const Onboarding = ({ userName, onComplete }) => {
  const [icalLink, setIcalLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Bienvenue sur Centraliz !",
      content: `Hey ${userName} ! 👋 Tu vas voir, Centraliz va te changer la vie à Centrale. Fini les galères avec les différents sites ! On te montre ça ?`,
      icon: "✨",
    },
    {
      title: "Fini la galère de l'ENT !",
      content: "L'ENT, Hyperplanning, Zimbra... Tout ça c'est du passé ! Tu retrouves tout dans une seule app moderne et simple à utiliser.",
      icon: "🎯",
    },
    {
      title: "Un emploi du temps intelligent",
      content: "Ton planning devient ENFIN lisible ! Les CB sont en rouge, les cours en bleu et les TNE en vert.",
      icon: "📅",
    },
    {
      title: "La vie associative en direct",
      content: "Le calendrier du CLA est intégré directement dans Centraliz ! Plus d'excuses pour rater les soirées !",
      icon: "🎉",
    },
    {
      title: "Tes mails, simplement",
      content: "Reçois tes mails de l'école directement sur Centraliz ! Plus besoin d'ouvrir Zimbra toutes les 10 minutes.",
      icon: "✉️",
    },
    {
      title: "Une vraie app mobile",
      content: "Sur ton téléphone, appuie sur 'Ajouter à l'écran d'accueil' pour avoir Centraliz comme une vraie app ! Pratique pour checker ton planning rapidement.",
      icon: "📱",
    },
    {
      title: "Une histoire d'étudiant",
      content: "Je suis Foucault de l'ITEEM ! J'ai créé Centraliz pour nous faciliter la vie à centrale.",
      icon: "🚀",
    },
    {
      title: "Ensemble, on va plus loin",
      content: "Aide moi à améliorer Centraliz ! Le bouton feedback dans le menu te permet de suggérer des améliorations directement.",
      icon: "💡",
    },
    {
      title: "Dernière étape !",
      content: "Il te suffit de copier-coller ton lien iCal d'Hyperplanning. Ça prend 30 secondes, la dernière ligne droite !",
      icon: "🌟",
    },
  ];

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
                Ouvrir Hyperplanning <ArrowRight size={16} className="inline-block ml-1" />
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
          </div>
        ) : (
          <button
            onClick={() => setCurrentStep((curr) => curr + 1)}
            className="next-button animate-pulse"
          >
            Continuer l'aventure <ArrowRight size={20} className="inline-block ml-1" />
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
