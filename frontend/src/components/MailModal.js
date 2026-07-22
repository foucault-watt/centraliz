import DOMPurify from "dompurify";
import { motion } from "framer-motion";
import Loader from "./Loader";

const MailModal = ({ mail, onClose, isContentLoading }) => {
  const sanitizeMailContent = (rawContent) => {
    if (!rawContent) return "";
    const match = rawContent.match(
      /<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i
    );
    const fragment = match ? match[1] : rawContent;
    return DOMPurify.sanitize(fragment, {
      FORBID_TAGS: ["style", "script"],
      FORBID_ATTR: ["style", "onerror", "onload"],
      ALLOW_DATA_ATTR: false,
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <motion.div
      className="mail-modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="mail-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mail-modal-header">
          <div>
            <span className="mail-modal-eyebrow">Mail</span>
            <h2 className="mail-modal-title">{mail.title}</h2>
          </div>
          <button
            className="mail-modal-close"
            onClick={onClose}
            aria-label="Fermer le mail"
          >
            ×
          </button>
        </div>
        <div className="mail-modal-meta">
          <span className="mail-modal-author">{mail.author}</span>
          <span className="mail-modal-date">{formatDate(mail.pubDate)}</span>
        </div>
        {isContentLoading ? (
          <div className="mail-modal-loading">
            <Loader />
          </div>
        ) : (
          <div
            className="mail-modal-body"
            dangerouslySetInnerHTML={{
              __html: mail.content ? sanitizeMailContent(mail.content) : "",
            }}
          />
        )}
        <div className="mail-modal-actions">
          <a
            href={`https://mail.centralelille.fr/modern/email/Inbox/conversation/-${mail.id}`}
            target="_blank"
            rel="noreferrer"
            className="mail-modal-action mail-modal-action-zimbra"
          >
            Répondre sur Zimbra
          </a>
          <button
            type="button"
            className="mail-modal-action mail-modal-action-close"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MailModal;
