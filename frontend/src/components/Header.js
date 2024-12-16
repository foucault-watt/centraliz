import React, { useState, useEffect } from "react";

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

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPopup, setShowInstallPopup] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async (e) => {
    e.preventDefault();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
    } else {
      setShowInstallPopup(true);
    }
  };

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div onClick={handleInstallClick} className="header-link" style={{ cursor: 'pointer' }}>
        <img src={"logo-title.svg"} className="header-logo" alt="logo" />
        <h1 className="header-title">Centraliz</h1>
      </div>
      
      {showInstallPopup && (
        <div className="install-popup">
          <div className="install-popup-content">
            <h3>Comment installer Centraliz</h3>
            <p>{getInstallInstructions()}</p>
            <button onClick={() => setShowInstallPopup(false)}>Fermer</button>
          </div>
        </div>
      )}
    </header>
  );
}
