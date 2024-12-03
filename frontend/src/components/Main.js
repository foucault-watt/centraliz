import React, { useState, useEffect } from "react";
import { useSwipeable } from 'react-swipeable';
import NavBar from "./NavBar";
import Notes from "./Notes";
import HpCalendar from "./HpCalendar";
import ClaCalendar from "./ClaCalendar";
import Mail from "./Mail";
import Links from "./Links";

function Main() {
  const [currentPosition, setCurrentPosition] = useState('center');
  const [pageHistory, setPageHistory] = useState(['center']);
  const [isTyping, setIsTyping] = useState(false);

  const isInputFocused = () => {
    const activeElement = document.activeElement;
    return activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
  };

  const handleNavigation = (direction) => {
    if (isTyping) {
      return;
    }

    if (direction === 'center') {
      setCurrentPosition('center');
      setPageHistory(prev => [...prev, 'center']);
    } else {
      const newPosition = getNewPosition(direction);
      setCurrentPosition(newPosition);
      setPageHistory(prev => [...prev, newPosition]);
    }
  };

  const getNewPosition = (direction) => {
    const positions = {
      left: { right: 'center', left: 'right' },
      center: { right: 'right', left: 'left' },
      right: { right: 'left', left: 'center' }
    };
    return positions[currentPosition][direction];
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => handleNavigation('right'),
    onSwipedRight: () => handleNavigation('left'),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isInputFocused()) {
        setIsTyping(true);
        return;
      }
      setIsTyping(false);
      if (e.key === 'ArrowLeft') handleNavigation('left');
      if (e.key === 'ArrowRight') handleNavigation('right');
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPosition]);

  return (
    <div className="main-container">
      <NavBar 
        currentPosition={currentPosition}
        handleNavigation={handleNavigation}
        isTyping={isTyping}
      />
      <div className="pages-container" {...handlers}>
        <div className={`pages-wrapper position-${currentPosition}`}>
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
        </div>
      </div>
    </div>
  );
}

export default Main;
