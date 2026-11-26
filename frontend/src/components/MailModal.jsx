import { motion } from "framer-motion";
import { useEffect } from "react";
import MailReader from "./mail/MailReader";

// Mobile : le mail s'ouvre dans une feuille plein écran, tout de suite,
// avec un squelette pendant le chargement du contenu.
const MailModal = ({ mail, content, loading, onClose }) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[2000] flex items-end bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={mail.title || "Mail"}
        className="w-full h-[94svh] overflow-hidden rounded-t-3xl bg-white shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" />
        <MailReader
          mail={mail}
          content={content}
          loading={loading}
          onClose={onClose}
        />
      </motion.div>
    </motion.div>
  );
};

export default MailModal;
