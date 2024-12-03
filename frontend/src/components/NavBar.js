import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const NavBar = ({ currentPosition, handleNavigation, isTyping }) => {
  return (
    <nav className="floating-nav">
      <button 
        onClick={() => handleNavigation('left')}
        className={currentPosition === 'left' ? 'active' : ''}
        disabled={isTyping} // Désactiver lorsque isTyping est true
      >
        <ChevronLeft size={24} />
        Notes
      </button>
      
      <button 
        onClick={() => handleNavigation('center')}
        className={currentPosition === 'center' ? 'active' : ''}
        disabled={isTyping} // Désactiver lorsque isTyping est true
      >
        Calendriers
      </button>
      
      <button 
        onClick={() => handleNavigation('right')}
        className={currentPosition === 'right' ? 'active' : ''}
        disabled={isTyping} // Désactiver lorsque isTyping est true
      >
        Mails & Liens
        <ChevronRight size={24} />
      </button>
    </nav>
  );
};

export default NavBar;
