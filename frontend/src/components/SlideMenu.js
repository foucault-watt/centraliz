import { X } from "lucide-react";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { slideMenuConfig } from "../config/slideMenuConfig";

const SlideMenu = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Prevent body scroll when menu is open
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      className={`fixed top-0 left-0 w-full h-full z-[1000] transition-all duration-300 ease-in-out ${
        isOpen ? "visible opacity-100" : "invisible opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`fixed top-0 left-0 w-full h-full bg-game-overlay backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`fixed top-0 left-0 w-80 max-w-[85%] h-full bg-background-module shadow-lg flex flex-col p-5 pt-16 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary hover:bg-slate-500 transition-colors"
          onClick={onClose}
          aria-label="Fermer le menu"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-semibold mb-4 text-text-primary bg-background-light p-3 rounded-lg">Autres onglets</h2>
        <div className="border-b border-border-light mb-6"></div>

        <nav className="flex flex-col gap-3">
          {slideMenuConfig.map((page) => (
            <button
              key={page.id}
              onClick={() => handleNavigation(page.path)}
              className="flex items-center gap-3 p-3 rounded-lg text-white bg-primary-dark/80 hover:bg-primary-dark transition-colors"
            >
              <page.icon size={20} />
              <span className="text-lg">{page.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default SlideMenu;
