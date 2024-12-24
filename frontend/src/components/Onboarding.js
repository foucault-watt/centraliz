import React, { useState } from "react";

const Onboarding = ({ userName, onComplete }) => {
  const [icalLink, setIcalLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Bienvenue sur Centraliz !",
      content:
        "Centraliz est ton nouveau compagnon pour simplifier ta vie à Centrale Lille. Découvrons ensemble tout ce que tu peux faire !",
      icon: "👋",
    },
    {
      title: "L'ENT c'est terminé !",
      content:
        "Centraliz te permet de centraliser les outils de l'ENT au même endroit. Au revoir les interfaces veillotes et compliquées !",
      icon: "🤦‍♂️",
    },
    {
      title: "Ton emploi du temps",
      content:
        "Fini Hyperplanning ! Visualise ton planning de cours dans une interface moderne et intuitive.",
      icon: "📅",
    },
    {
      title: "Les événements associatifs",
      content:
        "Ne rate plus aucun événement ! Retrouve tous les torchtôts, soirées et activités organisés par les assos.",
      icon: "🎉",
    },
    {
      title: "Tes mails Zimbra",
      content:
        "Consulte facilement et rapidement tes mails sans devoir passer par Zimbra.",
      icon: "📧",
    },
    {
      title: "Centraliz en tant qu'app",
      content:
        "A tous moments tu peux cliquer sur le titre Centraliz pour installer l'application sur ton téléphone !",
      icon: "📲",
    },
    {
      title: "Qui suis-je ?",
      content:
        "Je suis Foucault Wattinne, étudiant à l'ITEEM. J'ai créé Centraliz pour nous faciliter la vie à centrale. ",
      icon: "👨‍💻",
    },
    {
      title: "Donne moi ton avis !",
      content:
        "Tu peux me laisser un feedback à tous moments en bas de la page !",
      icon: "🫵",
    },
    {
      title: "Commençons !",
      content:
        "Pour commencer, va sur ton hyperplanning et copie le lien iCal en suivant le guide ci-dessous",
      icon: "🚀",
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
        <div className="onboarding-step">
          <div className="step-icon">{steps[currentStep].icon}</div>
          <h1>{steps[currentStep].title}</h1>
          <p>{steps[currentStep].content}</p>
        </div>

        {currentStep === steps.length - 1 ? (
          <div className="onboarding-form">
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
                Ouvrir Hyperplanning →
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
            className="next-button"
          >
            Suivant →
          </button>
        )}

        <div className="steps-indicator">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`step-dot ${index <= currentStep ? "active" : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
