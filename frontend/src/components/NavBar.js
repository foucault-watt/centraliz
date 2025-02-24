import React from 'react';
import { FileText, Calendar, Mail, PawPrint } from 'lucide-react';

const NavBar = ({ currentPosition, handleNavigation, isTyping }) => {
  const navItems = [
    { position: 'left', icon: FileText, text: 'Notes' },
    { position: 'center-left', icon: Calendar, text: 'Calendriers' },
    { position: 'center-right', icon: Mail, text: 'Mails & Liens' },
    { position: 'right', icon: PawPrint, text: "Edouard" }
  ];

  return (
    <nav className="floating-nav">
      {navItems.map(({ position, icon: Icon, text }) => (
        <button 
          key={position}
          onClick={() => handleNavigation(position, true)}
          className={currentPosition === position ? 'active' : ''}
          disabled={isTyping}
        >
          <Icon size={24} />
          <span className="nav-text">{text}</span>
        </button>
      ))}
    </nav>
  );
};

export default NavBar;