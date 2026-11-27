import { motion } from "framer-motion";

// Modale bloquante (sans bouton "ignorer") affichée au premier plan pendant
// que le contenu réel de la page reste visible, flouté, derrière. Utilisée
// pour le mot de passe mail sur Mail.js : voir issue #55, où l'ancien
// comportement (formulaire qui remplaçait tout le contenu) a été jugé moins
// engageant qu'un aperçu flouté du contenu débloqué.
const PasswordGateModal = ({ background, children }) => (
  <div className="password-gate">
    <div className="password-gate-backdrop" aria-hidden="true">
      {background}
    </div>
    <div className="password-gate-scrim" />
    <div className="password-gate-modal-wrap">
      <motion.div
        className="password-gate-modal"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  </div>
);

export default PasswordGateModal;
