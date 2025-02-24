import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Bdi from "./Bdi";
import ClaCalendar from "./ClaCalendar";
import HpCalendar from "./HpCalendar";
import Links from "./Links";
import Mail from "./Mail";
import NavBar from "./NavBar";
import Notes from "./Notes";

// Créer un contexte pour les logos
export const LogoVisibilityContext = createContext(null);

const FloatingLogos = () => {
  const { logoVisibility } = useContext(LogoVisibilityContext);
  const [logos, setLogos] = useState([]);

  useEffect(() => {
    const generateLogos = () => {
      const numberOfLogos = 30; // Augmentation du nombre de logos
      const newLogos = [];
      const sizes = ["small", "medium", "large"];

      for (let i = 0; i < numberOfLogos; i++) {
        newLogos.push({
          id: i,
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          delay: Math.random() * -30,
          size: sizes[Math.floor(Math.random() * sizes.length)],
          type: Math.floor(Math.random() * 4) + 1, // 4 types d'animations différentes
          zIndex: Math.floor(Math.random() * 10),
        });
      }

      setLogos(newLogos);
    };

    generateLogos();

    // Régénération périodique des positions
    const interval = setInterval(generateLogos, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!logoVisibility) return null;

  return (
    <div className="floating-logos">
      {logos.map((logo) => (
        <div
          key={logo.id}
          className={`floating-logo ${logo.size} type-${logo.type}`}
          style={{
            top: logo.top,
            left: logo.left,
            animationDelay: `${logo.delay}s`,
            zIndex: logo.zIndex,
          }}
        >
          <img src="/rays-elit-480.png" alt="Logo flottant" />
        </div>
      ))}
    </div>
  );
};

function Main() {
  const [currentPosition, setCurrentPosition] = useState("center-left");
  const [isTyping, setIsTyping] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [logoVisibility, setLogoVisibility] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetch("/api/bdi/logo-visibility", {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          setLogoVisibility(data.logoVisibility);
        })
        .catch((error) =>
          console.error("Error loading logo visibility:", error)
        );
    }
  }, [isAuthenticated]);

  const handleNavigation = useCallback(
    (newPosition) => {
      if (isBlocked) return;
      setCurrentPosition(newPosition);
    },
    [isBlocked]
  );

  useEffect(() => {
    const updateMedia = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    updateMedia();
    window.addEventListener("resize", updateMedia);
    return () => window.removeEventListener("resize", updateMedia);
  }, []);

  return (
    <LogoVisibilityContext.Provider
      value={{ logoVisibility, setLogoVisibility }}
    >
      <div className="main-container">
        <FloatingLogos />
        <NavBar
          currentPosition={currentPosition}
          handleNavigation={handleNavigation}
          isTyping={isTyping}
        />
        <div className="pages-container">
          <div
            className={`pages-wrapper position-${currentPosition} ${
              isBlocked ? "blocked" : ""
            }`}
            style={{
              "--shake-base": `${getShakeBaseTransform(currentPosition)}`,
            }}
          >
            <div className="page-section notes-section">
              <div className="section-content">
                <div className="div-notes">
                  <Notes />
                </div>
              </div>
            </div>

            <div className="page-section calendars-section">
              <div className="section-content">
                <div className="calendars-wrapper">
                  <div className="div-hp-calendar">
                    <HpCalendar />
                  </div>
                  <div className="div-cla-calendar">
                    <ClaCalendar />
                  </div>
                </div>
              </div>
            </div>

            <div className="page-section mail-links-section">
              <div className="section-content">
                <div className="mail-links-wrapper">
                  <div className="div-mail">
                    <Mail />
                  </div>
                  <div className="div-links">
                    <Links />
                  </div>
                </div>
              </div>
            </div>

            <div className="page-section bdi-section">
              <div className="section-content">
                <div className="div-bdi">
                  <Bdi />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LogoVisibilityContext.Provider>
  );
}

// Fonction utilitaire pour calculer la base de l'animation shake
function getShakeBaseTransform(position) {
  const transforms = {
    left: "0%",
    "center-left": "-25%",
    "center-right": "-50%",
    right: "-75%",
  };
  return transforms[position] || "0%";
}

export default Main;
