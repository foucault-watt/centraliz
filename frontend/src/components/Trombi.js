import React, { useEffect, useRef, useState } from "react";
import { members } from "../data/trombi-cads";
import "../styles/Trombi.scss";
// Importer les icônes de Lucide React
import { Minus, Plus, RotateCcw, X } from "lucide-react";

export default function Trombi() {
  const [selectedMember, setSelectedMember] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [viewportDimensions, setViewportDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [isMobile, setIsMobile] = useState(false);
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [pinchStartDistance, setPinchStartDistance] = useState(0);
  const [pinchStartScale, setPinchStartScale] = useState(1);

  // Détecter si l'appareil est mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Positions des marqueurs (à ajuster selon l'image réelle)
  const markers = members.map((member, index) => ({
    id: index,
    member,
    position: {
      // Distribution plus adaptée à la taille de l'image (3120×2080)juster selon l'image réelle)
      x: 200 + (index % 6) * 450,
      y: 300 + Math.floor(index / 6) * 350,
    },
  }));

  const handleMarkerClick = (member) => {
    setSelectedMember(member);
  };

  const closeModal = () => {
    setSelectedMember(null);
  };

  const handleZoom = (event) => {
    event.preventDefault();
    const newScale = Math.max(
      0.5,
      Math.min(3, scale + (event.deltaY > 0 ? -0.1 : 0.1))
    );
    setScale(newScale);
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      // Left click only
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  // Mise à jour des dimensions réelles de l'image
  const IMAGE_WIDTH = 3595;
  const IMAGE_HEIGHT = 3140;

  // Debugging de l'état de l'image
  useEffect(() => {
    console.log("Image loaded:", imageLoaded);
    console.log("Scale:", scale);
    console.log("Position:", position);
  }, [imageLoaded, scale, position]);

  const handleMouseMove = (e) => {
    if (isDragging) {
      // Calculer la nouvelle position
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Limites pour ne pas sortir du cadre de l'image
      const containerWidth = containerRef.current
        ? containerRef.current.offsetWidth
        : 0;
      const containerHeight = containerRef.current
        ? containerRef.current.offsetHeight
        : 0;
      const imageWidth = IMAGE_WIDTH * scale;
      const imageHeight = IMAGE_HEIGHT * scale;

      // Calcul des limites de déplacement
      const minX = containerWidth - imageWidth;
      const minY = containerHeight - imageHeight;

      // Appliquer les limites pour garder l'image en vue
      const boundedX = Math.min(0, Math.max(minX, newX));
      const boundedY = Math.min(0, Math.max(minY, newY));

      setPosition({
        x: boundedX,
        y: boundedY,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Initialisation et mise à jour lors du changement d'échelle
  useEffect(() => {
    const centerImage = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        // Taille de l'image à l'échelle actuelle
        const scaledWidth = IMAGE_WIDTH * scale;
        const scaledHeight = IMAGE_HEIGHT * scale;

        // Calcul de la position pour centrer
        let newX, newY;

        // Si l'image est plus petite que le conteneur, on la centre parfaitement
        if (scaledWidth < containerWidth) {
          newX = (containerWidth - scaledWidth) / 2;
        } else {
          // Sinon, on commence par la bord gauche
          newX = 0;
        }

        if (scaledHeight < containerHeight) {
          newY = (containerHeight - scaledHeight) / 2;
        } else {
          // Sinon, on commence par le haut
          newY = 0;
        }

        setPosition({ x: newX, y: newY });

        // Mise à jour des dimensions du viewport pour la minimap
        setViewportDimensions({
          width: containerWidth,
          height: containerHeight,
        });
      }
    };

    // Calculer l'échelle initiale pour voir toute l'image
    const calculateInitialScale = () => {
      if (containerRef.current && scale === 1) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        // Calculer le ratio pour adapter l'image au conteneur
        const widthRatio = containerWidth / IMAGE_WIDTH;
        const heightRatio = containerHeight / IMAGE_HEIGHT;

        // Prendre le plus petit pour s'assurer que toute l'image est visible
        const fitScale = Math.min(widthRatio, heightRatio) * 0.9;

        setScale(fitScale);
        // Le centrage sera déclenché lors de la mise à jour du scale
        return true; // Indique qu'on a modifié l'échelle
      }
      return false;
    };

    // Lors du premier rendu ou du changement d'échelle, centrer l'image
    if (!calculateInitialScale()) {
      centerImage();
    }

    // Ajouter un listener pour le redimensionnement de la fenêtre
    window.addEventListener("resize", centerImage);
    return () => window.removeEventListener("resize", centerImage);
  }, [scale, IMAGE_WIDTH, IMAGE_HEIGHT]);

  // Gestionnaire pour le bouton de réinitialisation
  const handleReset = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;

      // Calculer l'échelle optimale
      const widthRatio = containerWidth / IMAGE_WIDTH;
      const heightRatio = containerHeight / IMAGE_HEIGHT;
      const fitScale = Math.min(widthRatio, heightRatio) * 0.9;

      setScale(fitScale);
      // Le useEffect ci-dessus s'occupera du centrage
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedMember) {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMember]);

  // Gestion des événements tactiles
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      // Déplacement avec un doigt
      setIsDragging(true);
      setTouchStartPos({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      // Pinch zoom avec deux doigts
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchStartDistance(distance);
      setPinchStartScale(scale);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault(); // Empêcher le défilement de la page

    if (e.touches.length === 1 && isDragging) {
      // Déplacement avec un doigt
      const newX = e.touches[0].clientX - touchStartPos.x;
      const newY = e.touches[0].clientY - touchStartPos.y;

      // Limites pour ne pas sortir du cadre
      const containerWidth = containerRef.current
        ? containerRef.current.offsetWidth
        : 0;
      const containerHeight = containerRef.current
        ? containerRef.current.offsetHeight
        : 0;
      const imageWidth = IMAGE_WIDTH * scale;
      const imageHeight = IMAGE_HEIGHT * scale;

      const minX = containerWidth - imageWidth;
      const minY = containerHeight - imageHeight;

      const boundedX = Math.min(0, Math.max(minX, newX));
      const boundedY = Math.min(0, Math.max(minY, newY));

      setPosition({
        x: boundedX,
        y: boundedY,
      });
    } else if (e.touches.length === 2) {
      // Pinch zoom avec deux doigts
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      const newScale = Math.max(
        0.2,
        Math.min(2, pinchStartScale * (distance / pinchStartDistance))
      );

      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Version mobile du modal pour plus d'espace
  const MobileModal = ({ member, onClose }) => (
    <div className="mobile-modal">
      <div className="mobile-modal-header">
        <h2>{member.name}</h2>
        <button className="close-button" onClick={onClose}>
          <X size={24} />
        </button>
      </div>
      <div className="mobile-modal-content">
        <h3>"{member.nickname}"</h3>
        <div className="member-role">{member.role}</div>
        <p className="member-description">{member.description}</p>
      </div>
    </div>
  );

  return (
    <div className="trombi-container">
      <div className="trombi-controls">
        <button
          className="zoom-button"
          onClick={() => setScale(Math.min(2, scale + 0.2))}
        >
          <Plus size={20} />
        </button>
        <button
          className="zoom-button"
          onClick={() => setScale(Math.max(0.2, scale - 0.2))}
        >
          <Minus size={20} />
        </button>
        <button className="zoom-button" onClick={handleReset}>
          <RotateCcw size={20} />
        </button>
      </div>

      <div
        className={`trombi-view ${!imageLoaded ? "loading" : ""}`}
        ref={containerRef}
        onWheel={handleZoom}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {!imageLoaded && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Chargement de l'image...</p>
          </div>
        )}
        <div
          className="trombi-image-container"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "0 0", // Point d'origine en haut à gauche
            left: `${position.x}px`,
            top: `${position.y}px`,
            cursor: isDragging ? "grabbing" : "grab",
            width: `${IMAGE_WIDTH}px`,
            height: `${IMAGE_HEIGHT}px`,
          }}
          ref={imageRef}
        >
          <img
            src="/trombi_typo.jpg"
            alt="Trombinoscope"
            className="trombi-background"
            onDragStart={(e) => e.preventDefault()}
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            onLoad={() => {
              setImageLoaded(true);
              handleReset(); // Centrer l'image une fois chargée
            }}
            style={{ opacity: imageLoaded ? 1 : 0 }}
          />

          {imageLoaded &&
            markers.map((marker) => (
              <div
                key={marker.id}
                className="trombi-marker"
                style={{
                  left: `${marker.position.x}px`,
                  top: `${marker.position.y}px`,
                }}
                onClick={() => handleMarkerClick(marker.member)}
              >
                <div className="marker-dot"></div>
                <div className="marker-pulse"></div>
                <div className="marker-label">{marker.member.name}</div>
              </div>
            ))}
        </div>
      </div>

      {imageLoaded && (
        <div className="trombi-minimap">
          <img src="/trombi_typo.jpg" alt="Minimap" className="minimap-image" />
          <div
            className="viewport-indicator"
            style={{
              width: `${
                (viewportDimensions.width / (IMAGE_WIDTH * scale)) * 100
              }%`,
              height: `${
                (viewportDimensions.height / (IMAGE_HEIGHT * scale)) * 100
              }%`,
              left: `${(-position.x / (IMAGE_WIDTH * scale)) * 100}%`,
              top: `${(-position.y / (IMAGE_HEIGHT * scale)) * 100}%`,
            }}
          />
        </div>
      )}

      {selectedMember && (
        <div className="modal-overlay" onClick={closeModal}>
          {isMobile ? (
            <MobileModal member={selectedMember} onClose={closeModal} />
          ) : (
            <div className="member-modal" onClick={(e) => e.stopPropagation()}>
              <button className="close-button" onClick={closeModal}>
                <X size={24} />
              </button>
              <div className="member-details">
                <h2>{selectedMember.name}</h2>
                <h3>"{selectedMember.nickname}"</h3>
                <div className="member-role">{selectedMember.role}</div>
                <p className="member-description">
                  {selectedMember.description}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions pour les mobiles (visible uniquement sur les petits écrans) */}
      {isMobile && imageLoaded && (
        <div className="mobile-instructions">
          <div className="instruction">
            <div className="gesture-icon">👆</div>
            <p>Touchez un marqueur pour voir les détails</p>
          </div>
          <div className="instruction">
            <div className="gesture-icon">✌️</div>
            <p>Pincez pour zoomer/dézoomer</p>
          </div>
          <div className="instruction">
            <div className="gesture-icon">👋</div>
            <p>Glissez pour déplacer l'image</p>
          </div>
        </div>
      )}
    </div>
  );
}
