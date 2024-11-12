import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../App";
import ZimbraAuth from "./ZimbraAuth";

function Mail() {
  const { userName } = useContext(UserContext);
  const [allMails, setAllMails] = useState([]);
  const [mails, setMails] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedMailIndices, setExpandedMailIndices] = useState([]);
  const [visibleMailsCount, setVisibleMailsCount] = useState(4);

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

      console.log(`[Mail] Statut de la réponse: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[Mail] Mails reçus:`, data.mails);

        // Trier les mails par date décroissante
        const sortedMails = data.mails.sort(
          (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
        );

        // Stocker tous les mails reçus
        setAllMails(sortedMails);

        // Mettre à jour les mails affichés initialement
        setMails(sortedMails.slice(0, visibleMailsCount));
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

  useEffect(() => {
    if (isAuthenticated) {
      fetchMails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Mettre à jour les mails affichés lorsque visibleMailsCount ou allMails changent
  useEffect(() => {
    setMails(allMails.slice(0, visibleMailsCount));
  }, [visibleMailsCount, allMails]);

  return (
    <div>
      {!isAuthenticated ? (
        <ZimbraAuth setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <div>
          <div className="mail-header">
            <h2>Vos Derniers Mails</h2>
          </div>
          {status && <p className="status">{status}</p>}
          {isLoading ? (
            <p className="loading">Chargement des mails...</p>
          ) : (
            <ul className="mail-list">
              {mails.map((mail, index) => (
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
                    }
                  }}
                >
                  <h3>{mail.title}</h3>
                  <div className="mail-meta">
                    <span>De : {mail.author}</span>
                    <span>Le : {new Date(mail.pubDate).toLocaleString()}</span>
                  </div>
                  {expandedMailIndices.includes(index) && (
                    <div className="mail-content">
                      <p>{mail.description}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {visibleMailsCount < Math.min(48, allMails.length) && (
            <button className="show-more-button"
              onClick={() => setVisibleMailsCount(visibleMailsCount + 4)}
            >
              Afficher plus
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Mail;
