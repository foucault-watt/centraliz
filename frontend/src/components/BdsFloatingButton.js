import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import "../styles/BdsFloatingButton.css";

const BdsFloatingButton = ({ bdsInfo }) => {
  const [isActive, setIsActive] = useState(false);
  const [logos, setLogos] = useState([]);

  useEffect(() => {
    if (isActive) {
      // Générer davantage de logos flottants
      const newLogos = Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: 8 + Math.random() * 6,
        delay: Math.random() * 2,
        rotation: Math.random() * 360,
        scale: 0.45 + Math.random() * 0.45,
      }));
      setLogos(newLogos);
    } else {
      setLogos([]);
    }
  }, [isActive]);

  if (!bdsInfo || !bdsInfo.logoSrc) return null;

  const toggleAnimation = () => {
    setIsActive(!isActive);
  };

  return (
    <>
      {/* Bouton flottant */}
      <motion.button
        className="bds-floating-button"
        onClick={toggleAnimation}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300 }}
        style={{
          backgroundColor: bdsInfo.accentColor,
        }}
        title={`${isActive ? "Désactiver" : "Activer"} l'animation ${
          bdsInfo.displayName
        }`}
      >
        <img
          src={bdsInfo.logoSrc}
          alt={bdsInfo.displayName}
          className={`bds-button-logo ${isActive ? "active" : ""}`}
        />
        {isActive && (
          <motion.div
            className="bds-button-pulse"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{
              backgroundColor: bdsInfo.accentColor,
            }}
          />
        )}
      </motion.button>

      {/* Logos flottants */}
      <AnimatePresence>
        {isActive && (
          <div className="bds-floating-logos-container">
            {logos.map((logo) => (
              <motion.div
                key={logo.id}
                className="bds-floating-logo"
                initial={{
                  x: `${logo.x}vw`,
                  y: `${logo.y}vh`,
                  opacity: 0,
                  scale: 0,
                  rotate: logo.rotation,
                }}
                animate={{
                  x: [`${logo.x}vw`, `${(logo.x + 20) % 100}vw`, `${logo.x}vw`],
                  y: [`${logo.y}vh`, `${(logo.y - 30) % 100}vh`, `${logo.y}vh`],
                  opacity: [0, 0.22, 0.22, 0],
                  scale: [0, logo.scale, logo.scale, 0],
                  rotate: [logo.rotation, logo.rotation + 360],
                }}
                exit={{
                  opacity: 0,
                  scale: 0,
                  transition: { duration: 0.5 },
                }}
                transition={{
                  duration: logo.duration,
                  delay: logo.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <img src={bdsInfo.logoSrc} alt="" />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BdsFloatingButton;
