import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { UserContext } from "../App";
import ZimbraAuth from "./ZimbraAuth";
import DOMPurify from 'dompurify'; // Ajouter l'importation de DOMPurify

function Mail() {
  const { userName } = useContext(UserContext);
  const [allMails, setAllMails] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedMailIndices, setExpandedMailIndices] = useState([]);
  const [visibleMails, setVisibleMails] = useState(10); // Ajouter un état pour les mails visibles
  const [mailContents, setMailContents] = useState({});
  const loader = useRef(null);

  const fetchMails = async () => {
    setIsLoading(true);
    try {
      console.log(
        `[Mail] Récupération des mails pour l'utilisateur: ${userName}`
      );
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

        // Stocker tous les mails reçus
        setAllMails(sortedMails);
      } else {
        const errorData = await response.json();
        console.warn(`[Mail] Erreur récupérée:`, errorData);
        setStatus("Impossible de récupérer les mails.");
      }
    } catch (error) {
      console.error("Erreur:", error);
      setStatus("Erreur lors de la récupération des mails.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMailContent = async (mailId) => {
    try {
      console.log(`[Mail] Récupération du contenu du mail: ${mailId}`);
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/zimbra/mail/${mailId}`,
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setMailContents(prev => ({
          ...prev,
          [mailId]: data.content
        }));
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du contenu du mail:", error);
    }
  };

  const loadMoreMails = useCallback(() => {
    if (visibleMails < allMails.length) {
      setVisibleMails((prev) => prev + 10); // Charger 10 mails supplémentaires
    }
  }, [visibleMails, allMails.length]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    const currentLoader = loader.current; // Copier loader.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreMails();
        }
      },
      { threshold: 0.1 } // Ajuster le seuil pour déclencher plus tôt
    );

    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [loadMoreMails]); // Assurez-vous que 'loadMoreMails' est bien dans les dépendances

  const extractHtmlFragment = (rawContent) => {
    // Extrait le contenu entre <!--StartFragment--> et <!--EndFragment-->
    const match = rawContent.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
    const fragment = match ? match[1] : rawContent;
    return DOMPurify.sanitize(fragment, { FORBID_STYLE: true }); // Sanitiser le contenu
  };

  useEffect(() => {
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
          // Afficher le status uniquement pendant l'authentification
          setStatus("Authentification automatique...");
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
            // Effacer le message une fois authentifié
            setStatus("");
          } else {
            // Garder le message d'erreur si l'authentification échoue
            setStatus("Échec de l'authentification automatique");
          }
        }
      } catch (error) {
        console.error("Erreur:", error);
        setStatus("Erreur lors de l'authentification automatique.");
      }
    };
    
    checkStoredPassword();
  }, []);

  return (
    <div>
      <h2 className="module-title">Vos derniers mails</h2>
      {!isAuthenticated ? (
        <ZimbraAuth setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <div className="mail-list">
          {status && <p className="status">{status}</p>}
          {isLoading ? (
            <p className="loading">Chargement des mails...</p>
          ) : (
            <ul>
              {allMails.slice(0, visibleMails).map((mail, index) => (
                <li
                  key={index}
                  className={`mail-item ${
                    expandedMailIndices.includes(index) ? "expanded" : ""
                  }`}
                  onClick={() => {
                    if (expandedMailIndices.includes(index)) {
                      setExpandedMailIndices(
                        expandedMailIndices.filter((i) => i !== index)
                      );
                    } else {
                      setExpandedMailIndices([...expandedMailIndices, index]);
                      if (!mailContents[mail.id]) {
                        fetchMailContent(mail.id);
                      }
                    }
                  }}
                >
                  <h2>{mail.title}</h2>
                  <div className="mail-meta">
                    <span>De : {mail.author}</span>
                    <span>Le : {new Date(mail.pubDate).toLocaleString()}</span>
                  </div>
                  {expandedMailIndices.includes(index) && (
                    <div className="mail-content">
                      {mailContents[mail.id] ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: extractHtmlFragment(mailContents[mail.id])
                          }}
                        />
                      ) : (
                        <div className="content-loading" />
                      )}
                      <a
                        href={`https://mail.centralelille.fr/modern/email/Inbox/conversation/-${mail.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="view-on-zimbra"
                      >
                        Répondre sur Zimbra
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div ref={loader} />
          {visibleMails < allMails.length && <p>Chargement...</p>}
        </div>
      )}
    </div>
  );
}

export default Mail;
