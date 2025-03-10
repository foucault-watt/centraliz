import React from "react";
import { animated, useSpring } from "react-spring";
import { useNavigation } from "../contexts/NavigationContext";

// Options de configuration des animations
const transitionConfig = {
  tension: 300,
  friction: 35,
};

const PageContainer = ({ children }) => {
  const { currentPosition, isTransitioning, isBlocked, getShakeBaseTransform } =
    useNavigation();

  // Animation pour les transitions de page avec react-spring
  const springProps = useSpring({
    transform: `translateX(${getTranslateValue(currentPosition)})`,
    config: transitionConfig,
    immediate: false,
  });

  // Générer les classes CSS nécessaires
  const containerClasses = `pages-wrapper ${isBlocked ? "blocked" : ""} ${
    isTransitioning ? "transitioning" : ""
  }`;

  // Style CSS-in-JS pour l'animation de secousse
  const shakeStyle = {
    "--shake-base": getShakeBaseTransform(currentPosition),
  };

  return (
    <div className="pages-container">
      <animated.div
        className={containerClasses}
        style={{
          ...springProps,
          ...shakeStyle,
        }}
      >
        {children}
      </animated.div>
    </div>
  );
};

// Fonction utilitaire pour obtenir la valeur de translation en fonction de la position
function getTranslateValue(position) {
  const values = {
    left: "0%",
    "center-left": "-25%",
    "center-right": "-50%",
    right: "-75%",
  };
  return values[position] || "0%";
}

export default PageContainer;
