import React, { useState, useCallback, useEffect } from "react";
import NavBar from "./NavBar";
import Notes from "./Notes";
import HpCalendar from "./HpCalendar";
import ClaCalendar from "./ClaCalendar";
import Mail from "./Mail";
import Links from "./Links";

const SECTIONS = {
  NOTES: 'notes',
  CALENDAR: 'calendar',
  MAIL: 'mail'
};

// Ajouter un debounce utility
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const useSwipe = (onSwipe) => {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchMoveX, setTouchMoveX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    setTouchMoveX(e.touches[0].clientX);
    
    // Calculer la différence de déplacement
    const diff = touchStartX - e.touches[0].clientX;
    
    // Si le déplacement est significatif, empêcher le scroll vertical
    if (Math.abs(diff) > 5) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;

    const diff = touchStartX - touchMoveX;
    const minSwipeDistance = 30; // Réduire la distance minimale pour un swipe

    if (Math.abs(diff) > minSwipeDistance) {
      onSwipe(diff > 0 ? 'left' : 'right');
    }

    setIsSwiping(false);
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: (e) => {
      e.stopPropagation();
      handleTouchMove(e);
    },
    onTouchEnd: handleTouchEnd,
  };
};

const Main = () => {
  const [currentSection, setCurrentSection] = useState(SECTIONS.CALENDAR);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const handleSectionChange = useCallback((newSection) => {
    if (isTransitioning || isTyping) return;
    
    setIsTransitioning(true);
    setCurrentSection(newSection);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, isTyping]);

  // Mise à jour de la gestion du swipe
  const handleSwipe = useCallback((direction) => {
    if (isTyping || isTransitioning) return;

    const sections = ['notes', 'calendar', 'mail'];
    const currentIndex = sections.indexOf(currentSection);
    
    // Ajout d'une vérification supplémentaire
    if (!sections.includes(currentSection)) return;
    
    const newIndex = direction === 'left' ? 
      Math.min(sections.length - 1, currentIndex + 1) : 
      Math.max(0, currentIndex - 1);
    
    if (newIndex !== currentIndex) {
      handleSectionChange(sections[newIndex]);
    }
  }, [currentSection, handleSectionChange, isTyping, isTransitioning]);

  const swipeHandlers = useSwipe(handleSwipe);

  // Optimisation de la détection du focus
  const isInputElement = useCallback((element) => {
    if (!element) return false;
    
    const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
    return inputTags.includes(element.tagName) || 
           element.isContentEditable ||
           element.closest('[contenteditable="true"]');
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      // Vérifier si on est vraiment en train de taper
      const activeElement = document.activeElement;
      const isActiveInput = activeElement.tagName === 'INPUT' || 
                          activeElement.tagName === 'TEXTAREA' ||
                          activeElement.isContentEditable;
      
      if (isActiveInput) {
        return;
      }
      
      // Navigation par touches
      if (e.key === 'ArrowLeft') handleSwipe('right');
      if (e.key === 'ArrowRight') handleSwipe('left');
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleSwipe]);

  // Ajout d'un gestionnaire de focus/blur global
  useEffect(() => {
    let focusTimeout;
    
    const handleFocusChange = (e) => {
      // Annuler tout timeout précédent
      clearTimeout(focusTimeout);
      
      const element = e.target;
      const shouldBeTyping = isInputElement(element);
      
      if (!shouldBeTyping) {
        // Petit délai avant de désactiver isTyping
        focusTimeout = setTimeout(() => setIsTyping(false), 100);
      } else {
        setIsTyping(true);
      }
    };

    // Gestionnaire de clic amélioré
    const handleClick = debounce((e) => {
      if (!isInputElement(e.target)) {
        setIsTyping(false);
      }
    }, 150);

    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);
    document.addEventListener('click', handleClick);
    
    // Force reset isTyping state when ESC is pressed
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIsTyping(false);
      }
    };
    
    document.addEventListener('keydown', handleEsc);

    return () => {
      clearTimeout(focusTimeout);
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isInputElement]);

  return (
    <div className="main-container">
      <NavBar 
        currentSection={currentSection}
        onNavigate={handleSectionChange}
        isDisabled={isTransitioning || isTyping}
      />
      
      <div 
        className="pages-container" 
        {...swipeHandlers}
        style={{ 
          touchAction: 'none', // Désactive le scroll natif pendant le swipe
          userSelect: 'none'  // Empêche la sélection de texte pendant le swipe
        }}
      >
        <div className={`pages-wrapper section-${currentSection}`}>
          <section className="page-section">
            <div className="section-content">
              <div className="div-notes">
                <Notes />
              </div>
            </div>
          </section>

          <section className="page-section">
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
          </section>

          <section className="page-section">
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
          </section>
        </div>
      </div>
    </div>
  );
};

export default Main;
