import DOMPurify from "dompurify";
import React, { useCallback, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import MailItem from "./mail/mailItem";
import ZimbraAuth from "./mail/zimbraAuth";

function Mail() {
  const [allMails, setAllMails] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mailContents, setMailContents] = useState({});
  const [visibleMails, setVisibleMails] = useState(10);
  const { ref: loaderRef, inView } = useInView({ threshold: 0.1 });

  // Récupérer tous les mails
  const fetchMails = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/zimbra/mails`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Trier les mails par date décroissante
        const sortedMails = data.mails.sort(
          (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
        );
        setAllMails(sortedMails);
        setStatus("");
      } else {
        const errorData = await response.json();
        console.warn("[Mail] Erreur récupérée:", errorData);
        setStatus("Impossible de récupérer les mails.");
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des mails:", error);
      setStatus("Erreur lors de la récupération des mails.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Récupérer le contenu d'un mail spécifique
  const fetchMailContent = useCallback(
    async (mailId) => {
      if (mailContents[mailId]) return mailContents[mailId];

      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/zimbra/mail/${mailId}`,
          {
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          setMailContents((prev) => ({
            ...prev,
            [mailId]: data.content,
          }));
          return data.content;
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du contenu:", error);
      }
      return null;
    },
    [mailContents]
  );

  // Augmenter le nombre de mails visibles (pagination)
  const loadMoreMails = useCallback(() => {
    if (visibleMails < allMails.length) {
      setVisibleMails((prev) => Math.min(prev + 10, allMails.length));
    }
  }, [visibleMails, allMails.length]);

  // Sanitizer le contenu HTML du mail
  const sanitizeMailContent = useCallback((rawContent) => {
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
  }, []);

  // Effet pour l'authentification automatique
  useEffect(() => {
    const autoAuthenticate = async () => {
      try {
        const authResponse = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/zimbra/auto-auth`,
          {
            method: "POST",
            credentials: "include",
          }
        );
        const authData = await authResponse.json();
        if (authResponse.ok && authData.success) {
          setIsAuthenticated(true);
          setStatus("");
        } else {
          setStatus("Échec de l'authentification automatique");
        }
      } catch (error) {
        console.error("Erreur d'authentification automatique:", error);
        setStatus("Erreur lors de l'authentification automatique.");
      }
    };

    const checkStoredPassword = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/zimbra/check`,
          {
            credentials: "include",
          }
        );
        const data = await response.json();
        if (data.hasPassword) {
          setStatus("Authentification automatique...");
          await autoAuthenticate();
        }
      } catch (error) {
        console.error("Erreur de vérification du mot de passe:", error);
      }
    };

    checkStoredPassword();
  }, []);

  // Charger les mails lorsque l'authentification change
  useEffect(() => {
    if (isAuthenticated) {
      fetchMails();
    }
  }, [isAuthenticated, fetchMails]);

  // Observer l'élément de chargement pour la pagination infinie
  useEffect(() => {
    if (inView) {
      loadMoreMails();
    }
  }, [inView, loadMoreMails]);

  return (
    <div className="mail-module">
      <h2 className="module-title">Vos derniers mails</h2>

      {!isAuthenticated ? (
        <ZimbraAuth setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <div className="mail-container">
          {status && <p className="mail-status">{status}</p>}

          {isLoading && <p className="mail-loading">Chargement des mails...</p>}

          {!isLoading && allMails.length === 0 && (
            <p className="mail-empty">Aucun mail trouvé</p>
          )}

          {!isLoading && allMails.length > 0 && (
            <ul className="mail-list">
              {allMails.slice(0, visibleMails).map((mail) => (
                <MailItem
                  key={mail.id}
                  mail={mail}
                  fetchContent={() => fetchMailContent(mail.id)}
                  mailContent={
                    mailContents[mail.id]
                      ? sanitizeMailContent(mailContents[mail.id])
                      : null
                  }
                />
              ))}
            </ul>
          )}

          <div ref={loaderRef} className="mail-loader-trigger">
            {visibleMails < allMails.length && <p>Chargement...</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default Mail;
