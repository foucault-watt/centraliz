import DOMPurify from "dompurify";
import React, { useCallback, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { motion, AnimatePresence } from "framer-motion";
import ZimbraAuth from "./mail/zimbraAuth";
import MailModal from "./MailModal";
import Loader from "./Loader";

function Mail() {
  const [allMails, setAllMails] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authStatus, setAuthStatus] = useState("pending"); // 'pending', 'success', 'failure'
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mailContents, setMailContents] = useState({});
  const [visibleMails, setVisibleMails] = useState(15);
  const [selectedMail, setSelectedMail] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
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
      setVisibleMails((prev) => Math.min(prev + 15, allMails.length));
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
          setAuthStatus("success");
          setStatus("");
        } else {
          setAuthStatus("failure");
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
        } else {
          setAuthStatus("failure");
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
    if (inView && !isPaginating) {
      setIsPaginating(true);
      loadMoreMails();
      setTimeout(() => {
        setIsPaginating(false);
      }, 500);
    }
  }, [inView, loadMoreMails, isPaginating]);

  const handleMailClick = async (mail) => {
    setSelectedMail(mail);
    setIsContentLoading(true);
    await fetchMailContent(mail.id);
    setIsContentLoading(false);
    if (window.innerWidth <= 768) {
      setIsModalOpen(true);
    }
  };

  return (
    <div className="mail-module">
      <h2 className="module-title">Vos derniers mails</h2>

      {!isAuthenticated ? (
        <ZimbraAuth
          setIsAuthenticated={setIsAuthenticated}
          authStatus={authStatus}
        />
      ) : (
        <div className="mail-container">
          {status && <p className="mail-status">{status}</p>}

          {isLoading && <p className="mail-loading">Chargement des mails...</p>}

          {!isLoading && allMails.length === 0 && (
            <p className="mail-empty">Aucun mail trouvé</p>
          )}

          {!isLoading && allMails.length > 0 && (
            <div className="mail-split-view">
              <motion.ul
                className="mail-list"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.05,
                    },
                  },
                }}
              >
                {allMails.slice(0, visibleMails).map((mail) => (
                  <motion.li
                    key={mail.id}
                    className={`mail-item ${
                      selectedMail && selectedMail.id === mail.id ? "selected" : ""
                    }`}
                    onClick={() => handleMailClick(mail)}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <h2 className="mail-item__title">{mail.title}</h2>
                    <div className="mail-item__meta">
                      <span className="mail-item__author">De : {mail.author}</span>
                      <span className="mail-item__date">
                        Le : {new Date(mail.pubDate).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </motion.li>
                ))}
                {visibleMails < allMails.length && (
                  <li ref={loaderRef} className="mail-loader-trigger">
                    <p>Chargement...</p>
                  </li>
                )}
              </motion.ul>
              <div className="mail-content-view">
                <AnimatePresence mode="wait">
                  {selectedMail ? (
                    <motion.div
                      key={selectedMail.id}
                      className="mail-content"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <h2 className="mail-content-title">{selectedMail.title}</h2>
                      <div className="mail-content-meta">
                        <span className="mail-content-author">
                          De : {selectedMail.author}
                        </span>
                        <span className="mail-content-date">
                          Le : {new Date(selectedMail.pubDate).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {isContentLoading ? (
                        <Loader />
                      ) : (
                        <div
                          className="mail-content-body"
                          dangerouslySetInnerHTML={{
                            __html: mailContents[selectedMail.id]
                              ? sanitizeMailContent(mailContents[selectedMail.id])
                              : "",
                          }}
                        />
                      )}
                      <a
                        href={`https://mail.centralelille.fr/modern/email/Inbox/conversation/-${selectedMail.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mail-content-action"
                      >
                        Répondre sur Zimbra
                      </a>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      className="mail-content-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Sélectionnez un mail pour le lire
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          <div ref={loaderRef} className="mail-loader-trigger">
            {visibleMails < allMails.length && <p>Chargement...</p>}
          </div>
        </div>
      )}

      {isModalOpen && (
        <MailModal
          mail={{ ...selectedMail, content: mailContents[selectedMail.id] }}
          onClose={() => setIsModalOpen(false)}
          isContentLoading={isContentLoading}
        />
      )}
    </div>
  );
}

export default Mail;
