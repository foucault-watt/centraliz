// frontend/src/components/Mail.js
import React, { useState, useContext, useEffect } from "react";
import { UserContext } from "../App";
import ZimbraAuth from "./ZimbraAuth";

function Mail() {
  const { userName } = useContext(UserContext);
  const [mails, setMails] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchMails = async () => {
    setIsLoading(true);
    try {
      console.log(`[Mail] Récupération des mails pour l'utilisateur: ${userName}`);
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/zimbra/mails`, {
        method: "GET",
        credentials: "include",
      });

      console.log(`[Mail] Statut de la réponse: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[Mail] Mails reçus:`, data.mails);
        
        // Trier les mails par date décroissante
        const sortedMails = data.mails.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // Limiter à 10 derniers mails
        const latestMails = sortedMails.slice(0, 6);
        
        setMails(latestMails);
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
                <li key={index} className="mail-item">
                  <h3>{mail.title}</h3>
                  <p>{mail.description}</p>
                  <div className="mail-meta">
                    <span>De : {mail.author}</span>
                    <span>Le : {new Date(mail.pubDate).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default Mail;