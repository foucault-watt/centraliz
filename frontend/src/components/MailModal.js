import React from "react";
import DOMPurify from "dompurify";
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
    <div className="mail-modal-overlay" onClick={onClose}>
      <div className="mail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mail-modal-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="mail-modal-title">{mail.title}</h2>
        <div className="mail-modal-meta">
          <span className="mail-modal-author">De : {mail.author}</span>
          <span className="mail-modal-date">Le : {formatDate(mail.pubDate)}</span>
        </div>
        {isContentLoading ? (
          <Loader />
        ) : (
          <div
            className="mail-modal-body"
            dangerouslySetInnerHTML={{
              __html: mail.content ? sanitizeMailContent(mail.content) : "",
            }}
          />
        )}
        <a
          href={`https://mail.centralelille.fr/modern/email/Inbox/conversation/-${mail.id}`}
          target="_blank"
          rel="noreferrer"
          className="mail-modal-action"
        >
          Répondre sur Zimbra
        </a>
      </div>
    </div>
  );
};

export default MailModal;
