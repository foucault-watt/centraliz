import React from 'react';
import { FileText, Calendar, Mail } from 'lucide-react';

const NavBar = ({ currentSection, onNavigate, isDisabled }) => {
  return (
    <nav className="floating-nav">
      <button 
        onClick={() => onNavigate('notes')}
        className={currentSection === 'notes' ? 'active' : ''}
        disabled={isDisabled}
      >
        <FileText size={24} />
        <span className="nav-text">Notes</span>
      </button>
      
      <button 
        onClick={() => onNavigate('calendar')}
        className={currentSection === 'calendar' ? 'active' : ''}
        disabled={isDisabled}
      >
        <Calendar size={24} />
        <span className="nav-text">Calendriers</span>
      </button>
      
      <button 
        onClick={() => onNavigate('mail')}
        className={currentSection === 'mail' ? 'active' : ''}
        disabled={isDisabled}
      >
        <Mail size={24} />
        <span className="nav-text">Mails & Liens</span>
      </button>
    </nav>
  );
};

export default NavBar;
