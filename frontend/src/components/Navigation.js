import React from "react";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";

const Navigation = ({ pagesConfig }) => {
  return (
    <motion.nav
      className="app-navigation"
      initial={{ opacity: 0, y: 18, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="nav-items">
        {pagesConfig.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={`/${item.id}`}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              aria-label={item.label}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      className="nav-active-pill"
                      layoutId="nav-active-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <motion.span
                    className="nav-content"
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                  >
                    <span className="nav-icon">
                      <Icon size={20} />
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </motion.span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default Navigation;
