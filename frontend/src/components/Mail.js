import React, { useState, useContext, useEffect, useRef } from "react";
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
  const [mailCount, setMailCount] = useState(6);
  const sliderRef = useRef(null);

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
        setMails(sortedMails.slice(0, mailCount));
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

  // Mettre à jour les mails affichés lorsque mailCount ou allMails changent
  useEffect(() => {
    setMails(allMails.slice(0, mailCount));
  }, [mailCount, allMails]);

  useEffect(() => {
    if (sliderRef.current) {
      const slider = sliderRef.current;
      const styles = getComputedStyle(slider.parentElement);
      const green = styles.getPropertyValue('--green-color').trim();
      const red = styles.getPropertyValue('--red-color').trim();
      const factor = (mailCount - 1) / (50 - 1);
      const thumbColor = interpolateColor(green, red, factor);
      slider.style.setProperty('--thumb-color', thumbColor);
    }
  }, [mailCount]);

  function interpolateColor(color1, color2, factor) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const result = {
      r: Math.round(c1.r + (c2.r - c1.r) * factor),
      g: Math.round(c1.g + (c2.g - c1.g) * factor),
      b: Math.round(c1.b + (c2.b - c1.b) * factor),
    };
    return `rgb(${result.r}, ${result.g}, ${result.b})`;
  }

  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    let bigint = parseInt(hex, 16);
    let r, g, b;
    if (hex.length === 3) {
      r = (bigint >> 8 & 0xf) * 17;
      g = (bigint >> 4 & 0xf) * 17;
      b = (bigint & 0xf) * 17;
    } else if (hex.length === 6) {
      r = bigint >> 16 & 0xff;
      g = bigint >> 8 & 0xff;
      b = bigint & 0xff;
    }
    return { r, g, b };
  }

  return (
    <div>
      {!isAuthenticated ? (
        <ZimbraAuth setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <div>
          <div className="mail-header">
            <h2>Vos Derniers Mails</h2>
          </div>
          <div
            className="mail-count-slider"
            style={{ '--mail-count': mailCount }}
          >
            <label htmlFor="mailCount">
              Nombre de mails à afficher : {mailCount}
            </label>
            <input
              type="range"
              id="mailCount"
              min="1"
              max="50"
              value={mailCount}
              onChange={(e) => setMailCount(Number(e.target.value))}
              ref={sliderRef}
            />
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
        </div>
      )}
    </div>
  );
}

export default Mail;
