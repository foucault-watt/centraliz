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
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchMove, setTouchMove] = useState({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState(false);
  const minSwipeDistance = 50; // Distance minimale pour un swipe
  const swipeThreshold = 0.3; // Ratio minimum de déplacement horizontal vs vertical

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchMove({ x: touch.clientX, y: touch.clientY });
    setIsSwiping(false);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    setTouchMove({ x: touch.clientX, y: touch.clientY });

    // Calculer les différences de déplacement
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);

    // Si le déplacement horizontal est significatif et plus important que le vertical
    if (deltaX > deltaY * swipeThreshold && deltaX > 10) {
      setIsSwiping(true);
      e.preventDefault(); // Empêcher le scroll uniquement si on détecte un swipe horizontal
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;

    const deltaX = touchMove.x - touchStart.x;
    
    if (Math.abs(deltaX) >= minSwipeDistance) {
      onSwipe(deltaX > 0 ? 'right' : 'left');
    }
    
    setIsSwiping(false);
  };

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    },
    isSwiping
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

  // Créer une fonction de navigation réutilisable
  const handleNavigation = useCallback((direction) => {
    if (isTyping || isTransitioning) return;

    const sections = [SECTIONS.NOTES, SECTIONS.CALENDAR, SECTIONS.MAIL];
    const currentIndex = sections.indexOf(currentSection);
    
    if (direction === 'left' && currentIndex < sections.length - 1) {
      handleSectionChange(sections[currentIndex + 1]);
    } else if (direction === 'right' && currentIndex > 0) {
      handleSectionChange(sections[currentIndex - 1]);
    }
  }, [currentSection, handleSectionChange, isTyping, isTransitioning]);

  const { handlers, isSwiping } = useSwipe(handleNavigation);

  // Mise à jour de l'effet pour utiliser handleNavigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      const activeElement = document.activeElement;
      const isActiveInput = activeElement.tagName === 'INPUT' || 
                          activeElement.tagName === 'TEXTAREA' ||
                          activeElement.isContentEditable;
      
      if (isActiveInput) return;
      
      if (e.key === 'ArrowLeft') handleNavigation('right');
      if (e.key === 'ArrowRight') handleNavigation('left');
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleNavigation]);

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
      if (e.key === 'ArrowLeft') handleNavigation('right');
      if (e.key === 'ArrowRight') handleNavigation('left');
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleNavigation]);

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
      
      <div className="pages-container">
        <div 
          className={`pages-wrapper section-${currentSection}`}
          data-swiping={isSwiping}
          {...handlers}
        >
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
