import React from 'react';
import { FileText, Calendar, Mail } from 'lucide-react'; // Importer les icônes spécifiques

const NavBar = ({ currentPosition, handleNavigation, isTyping }) => {
  return (
    <nav className="floating-nav">
      <button 
        onClick={() => handleNavigation('left')}
        className={currentPosition === 'left' ? 'active' : ''}
        disabled={isTyping} // Désactiver lorsque isTyping est true
      >
        <FileText size={24} /> {/* Icône pour Notes */}
        <span className="nav-text">Notes</span>
      </button>
      
      <button 
        onClick={() => handleNavigation('center')}
        className={currentPosition === 'center' ? 'active' : ''}
        disabled={isTyping} // Désactiver lorsque isTyping est true
      >
        <Calendar size={24} /> {/* Icône pour Calendriers */}
        <span className="nav-text">Calendriers</span>
      </button>
      
      <button 
        onClick={() => handleNavigation('right')}
        className={currentPosition === 'right' ? 'active' : ''}
        disabled={isTyping} // Désactiver lorsque isTyping est true
      >
        <Mail size={24} /> {/* Icône pour Mails & Liens */}
        <span className="nav-text">Mails & Liens</span>
      </button>
    </nav>
  );
};

export default NavBar;
