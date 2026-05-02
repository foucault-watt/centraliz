import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { slideMenuConfig } from "../config/slideMenuConfig";

const SlideMenu = ({ isOpen, onClose, user }) => {
  const navigate = useNavigate();
  const visiblePages = slideMenuConfig.filter(
    (page) => !page.adminOnly || user?.is_admin,
  );

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="app-slide-menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            className="slide-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.aside
            className="slide-menu-panel"
            initial={{ x: "-102%" }}
            animate={{ x: 0 }}
            exit={{ x: "-102%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="slide-menu-top">
              <div>
                <p className="slide-menu-kicker">Centraliz</p>
                <h2>Autres onglets</h2>
              </div>
              <motion.button
                type="button"
                className="slide-menu-close"
                onClick={onClose}
                aria-label="Fermer le menu"
                whileTap={{ scale: 0.94 }}
              >
                <X size={22} />
              </motion.button>
            </div>

            <nav className="slide-menu-items">
              {visiblePages.map((page, index) => (
                <motion.button
                  key={page.id}
                  type="button"
                  onClick={() => handleNavigation(page.path)}
                  className="slide-menu-item"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.035 }}
                  whileTap={{ scale: 0.985 }}
                >
                  <span className="slide-menu-item-icon">
                    <page.icon size={19} />
                  </span>
                  <span>{page.label}</span>
                </motion.button>
              ))}
            </nav>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SlideMenu;
