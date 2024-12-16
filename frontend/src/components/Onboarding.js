import React, { useState } from 'react';

const Onboarding = ({ userName, onComplete }) => {
  const [icalLink, setIcalLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Bienvenue sur Centraliz !",
      content: "Centraliz est ton nouveau compagnon pour simplifier ta vie à Centrale Lille. Découvrons ensemble tout ce que tu peux faire !",
      icon: "👋",
    },
    {
      title: "Ton emploi du temps",
      content: "Fini Hyperplanning ! Visualise ton planning de cours dans une interface moderne et intuitive.",
      icon: "📅",
    },
    {
      title: "Les événements du CLA",
      content: "Ne rate plus aucun événement ! Retrouve tous les torchtôts, soirées et activités organisés par le CLA.",
      icon: "🎉",
    },
    {
      title: "Tes mails Zimbra",
      content: "Consulte facilement tes mails importants de l'administration sans passer par Zimbra.",
      icon: "📧",
    },
    {
      title: "Progressive Web App",
      content: "Tu peux installer Centraliz sur ton téléphone pour y accéder encore plus rapidement !",
      icon: "📱",
    },
    {
      title: "Qui suis-je ?",
      content: "Je suis Foucault Wattinne, étudiant à l'ITEEM. J'ai créé Centraliz pour faciliter notre vie étudiante. Des suggestions ? Contacte-moi !",
      icon: "👨‍💻",
    },
    {
      title: "Commençons !",
      content: "Pour commencer, va sur ton hyperplanning et copie le lien iCal en suivant le guide ci-dessous",
      icon: "🚀",
    }
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
        setLinkError("Ce lien ne semble pas valide. Vérifie que tu l'as bien copié !");
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
            onClick={() => setCurrentStep(curr => curr + 1)}
            className="next-button"
          >
            Suivant →
          </button>
        )}

        <div className="steps-indicator">
          {steps.map((_, index) => (
            <div 
              key={index}
              className={`step-dot ${index <= currentStep ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
