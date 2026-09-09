import { LogOut, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { slideMenuConfig } from "../config/slideMenuConfig";
import { fetchApi } from "../utils/api";

const SlideMenu = ({ isOpen, onClose, user }) => {
  const navigate = useNavigate();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
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

  const handleLogout = async () => {
    await fetchApi("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <>
      <AnimatePresence>
        {isLogoutConfirmOpen && (
          <motion.div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsLogoutConfirmOpen(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              className="relative w-full max-w-sm sm:max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg sm:text-xl font-bold text-secondary">
                Se déconnecter ?
              </h3>
              <p className="mt-2 text-sm sm:text-base text-text-secondary">
                Voulez-vous vraiment vous déconnecter de votre compte ?
              </p>
              <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  className="w-full sm:w-auto rounded-lg px-4 py-2.5 sm:py-2 text-sm font-semibold text-secondary bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full sm:w-auto rounded-lg px-4 py-2.5 sm:py-2 text-sm font-semibold text-white bg-danger hover:opacity-90 transition-opacity"
                >
                  Se déconnecter
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

                <motion.button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(true)}
                  className="slide-menu-item !text-danger !border-danger/20 hover:!bg-danger/5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.18,
                    delay: visiblePages.length * 0.035,
                  }}
                  whileTap={{ scale: 0.985 }}
                >
                  <span className="slide-menu-item-icon !bg-danger/10 !text-danger">
                    <LogOut size={19} />
                  </span>
                  <span>Se déconnecter</span>
                </motion.button>
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SlideMenu;
