import React, { useEffect, useState } from "react";

function MailItem({ mail, fetchContent, mailContent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Charger le contenu du mail lorsqu'il est développé
  useEffect(() => {
    if (isExpanded && !mailContent && !isLoading) {
      setIsLoading(true);
      fetchContent().finally(() => setIsLoading(false));
    }
  }, [isExpanded, mailContent, fetchContent, isLoading]);

  const handleClick = (e) => {
    // Ne pas développer le mail si l'utilisateur sélectionne du texte
    if (!window.getSelection().toString()) {
      setIsExpanded(!isExpanded);
    }
  };

  // Formater la date pour l'affichage
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
    <li
      className={`mail-item ${isExpanded ? "mail-item--expanded" : ""}`}
      onClick={handleClick}
    >
      <h2 className="mail-item__title">{mail.title}</h2>

      <div className="mail-item__meta">
        <span className="mail-item__author">De : {mail.author}</span>
        <span className="mail-item__date">Le : {formatDate(mail.pubDate)}</span>
      </div>

      {isExpanded && (
        <div className="mail-item__content">
          {isLoading ? (
            <div className="mail-item__loading" />
          ) : mailContent ? (
            <>
              <div
                className="mail-item__body"
                dangerouslySetInnerHTML={{ __html: mailContent }}
              />

              <a
                href={`https://mail.centralelille.fr/modern/email/Inbox/conversation/-${mail.id}`}
                target="_blank"
                rel="noreferrer"
                className="mail-item__action"
                onClick={(e) => e.stopPropagation()}
              >
                Répondre sur Zimbra
              </a>
            </>
          ) : (
            <p className="mail-item__error">Impossible de charger le contenu</p>
          )}
        </div>
      )}
    </li>
  );
}

export default React.memo(MailItem);
