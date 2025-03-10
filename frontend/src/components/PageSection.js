import React, { memo } from "react";
import { useInView } from "react-intersection-observer";

// Composant optimisé pour les sections de page
const PageSection = ({ id, children, className = "" }) => {
  // Utiliser IntersectionObserver pour optimiser les rendus
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  });

  // Classes CSS pour la section
  const sectionClass = `page-section ${id}-section ${className}`;

  return (
    <div ref={ref} className={sectionClass}>
      <div className="section-content">
        {/* Ne rendre le contenu que s'il est visible ou presque visible */}
        {(inView || window.innerWidth <= 768) && children}
      </div>
    </div>
  );
};

// Utiliser memo pour éviter les rendus inutiles
export default memo(PageSection);
