import DOMPurify from "dompurify";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "../App";
import Loader from "./Loader";
import ZimbraAuth from "./mail/zimbraAuth";
import MailModal from "./MailModal";

function Mail() {
  const { user } = useContext(UserContext);
  const [allMails, setAllMails] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authStatus, setAuthStatus] = useState("pending");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mailContents, setMailContents] = useState({});
  const [visibleMails, setVisibleMails] = useState(20);
  const [selectedMail, setSelectedMail] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const listRef = useRef(null);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

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

  // Charger plus de mails
  const loadMoreMails = useCallback(() => {
    if (isLoadingMore || visibleMails >= allMails.length) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleMails((prev) => Math.min(prev + 20, allMails.length));
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, visibleMails, allMails.length]);

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

  // Format date courte
  const formatShortDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    } else {
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      });
    }
  };

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
        }
      } catch (error) {
        console.error("Erreur d'authentification automatique:", error);
        setAuthStatus("failure");
      }
    };

    // Utiliser hasPassword du contexte au lieu de faire un nouvel appel API
    if (user?.hasPassword) {
      setStatus("Authentification automatique...");
      autoAuthenticate();
    } else {
      setAuthStatus("failure");
    }
  }, [user]);

  // Charger les mails
  useEffect(() => {
    if (isAuthenticated) {
      fetchMails();
    }
  }, [isAuthenticated, fetchMails]);

  // Intersection Observer pour le scroll infini
  useEffect(() => {
    if (!sentinelRef.current || !isAuthenticated || allMails.length === 0)
      return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          visibleMails < allMails.length &&
          !isLoadingMore
        ) {
          loadMoreMails();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [
    isAuthenticated,
    allMails.length,
    visibleMails,
    isLoadingMore,
    loadMoreMails,
  ]);

  const handleMailClick = async (mail) => {
    setSelectedMail(mail);
    setIsContentLoading(true);
    await fetchMailContent(mail.id);
    setIsContentLoading(false);
    if (window.innerWidth <= 768) {
      setIsModalOpen(true);
    }
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  return (
    <div className="mail-module-modern">
      <div className="mail-header-modern">
        <h2 className="mail-title-modern">📬 Boîte de réception</h2>
        {isAuthenticated && allMails.length > 0 && (
          <span className="mail-count-badge">{allMails.length} messages</span>
        )}
      </div>

      {!isAuthenticated ? (
        <ZimbraAuth
          setIsAuthenticated={setIsAuthenticated}
          authStatus={authStatus}
        />
      ) : (
        <div className="mail-layout-modern">
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mail-status-modern"
            >
              {status}
            </motion.div>
          )}

          {isLoading ? (
            <div className="mail-loading-modern">
              <Loader />
              <p>Chargement de vos mails...</p>
            </div>
          ) : allMails.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mail-empty-modern"
            >
              <div className="mail-empty-icon">📭</div>
              <p>Aucun mail trouvé</p>
            </motion.div>
          ) : (
            <div className="mail-split-modern">
              {/* Liste des mails */}
              <div className="mail-list-container-modern" ref={listRef}>
                <motion.div
                  className="mail-list-modern"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.03 },
                    },
                  }}
                >
                  {allMails.slice(0, visibleMails).map((mail, index) => (
                    <motion.div
                      key={mail.id}
                      className={`mail-card-modern ${
                        selectedMail?.id === mail.id ? "mail-card-selected" : ""
                      }`}
                      onClick={() => handleMailClick(mail)}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          transition: { delay: index * 0.02 },
                        },
                      }}
                      whileHover={{
                        scale: 1.01,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="mail-card-info">
                        <div className="mail-card-author-row">
                          <span
                            className="mail-card-author"
                            title={mail.author}
                          >
                            {truncateText(mail.author, 35)}
                          </span>
                          <span className="mail-card-date">
                            {formatShortDate(mail.pubDate)}
                          </span>
                        </div>
                        <h3 className="mail-card-title" title={mail.title}>
                          {truncateText(mail.title, 60)}
                        </h3>
                        <p className="mail-card-preview">
                          {truncateText(mail.description || "", 100)}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Sentinel pour détecter le scroll */}
                  {visibleMails < allMails.length && (
                    <div ref={sentinelRef} className="mail-sentinel">
                      {isLoadingMore && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mail-loading-more"
                        >
                          <div className="spinner-small"></div>
                          <span>Chargement...</span>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Panneau de détails */}
              <div className="mail-detail-container-modern">
                <AnimatePresence mode="wait">
                  {selectedMail ? (
                    <motion.div
                      key={selectedMail.id}
                      className="mail-detail-modern"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="mail-detail-header">
                        <h2 className="mail-detail-title">
                          {selectedMail.title}
                        </h2>
                        <div className="mail-detail-meta">
                          <div className="mail-detail-author">
                            <div className="mail-detail-author-name">
                              {selectedMail.author}
                            </div>
                            <div className="mail-detail-date">
                              {new Date(selectedMail.pubDate).toLocaleString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {isContentLoading ? (
                        <div className="mail-detail-loading">
                          <Loader />
                        </div>
                      ) : (
                        <>
                          <div
                            className="mail-detail-body"
                            dangerouslySetInnerHTML={{
                              __html: mailContents[selectedMail.id]
                                ? sanitizeMailContent(
                                    mailContents[selectedMail.id]
                                  )
                                : "",
                            }}
                          />
                          <motion.a
                            href={`https://mail.centralelille.fr/modern/email/Inbox/conversation/-${selectedMail.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mail-detail-action"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            📨 Répondre sur Zimbra
                          </motion.a>
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      className="mail-detail-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="mail-detail-empty-icon">✉️</div>
                      <p>Sélectionnez un mail pour le lire</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
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
