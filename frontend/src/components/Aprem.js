import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../App";
import { admin } from "../data/admin";
import { useApiWithRetry } from "../hooks/useAprem";
import "../styles/Aprem.scss";

export default function Aprem() {
  const { userName } = useContext(UserContext);
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminTrials, setAdminTrials] = useState({});
  const [trialCountdown, setTrialCountdown] = useState(null);
  const [standRequests, setStandRequests] = useState({});
  const [adminStandRequests, setAdminStandRequests] = useState({});
  const [standRequestCountdowns, setStandRequestCountdowns] = useState({});
  const [refreshCount, setRefreshCount] = useState(0);
  const [selectedPoints, setSelectedPoints] = useState(1);

  // Utiliser le hook avec réessai pour les requêtes critiques
  const {
    fetchWithRetry,
    loading: retryLoading,
    error: retryError,
    retrying,
  } = useApiWithRetry();

  // Vérifier si l'utilisateur est un administrateur
  const isAdmin = admin.includes(userName);

  // Définition des stands
  const stands = [
    {
      id: "taureau",
      name: "Taureau mécanique",
      description: "Tenir au moins 30 secondes sur le taureau",
    },
    {
      id: "bowling",
      name: "Bowling",
      description: "Faire tomber au moins 5 quilles en un lancer",
    },
    { id: "alibi", name: "Alibi", description: "Jouer une partie complète." },
    {
      id: "pancake",
      name: "Pancake art",
      description: "Participer à la création de pancakes artistiques.",
    },
    {
      id: "atelier",
      name: "Atelier créatif",
      description: "Participer à l'atelier créatif.",
    },
  ];

  // Règles pour les canards
  const duckRules = [
    { stamps: 1, ducks: 1 },
    { stamps: 3, ducks: 2 },
    { stamps: 5, ducks: 3 },
  ];

  // Calculer le nombre de tampons validés
  const countValidatedStamps = () => {
    if (!playerData) return 0;
    return Object.values(playerData.stands).filter((v) => v).length;
  };

  // Calculer le nombre maximum d'essais autorisés en fonction des tampons
  const getMaxTrials = () => {
    if (!playerData) return 0;

    const validatedStamps = countValidatedStamps();
    if (validatedStamps >= 5) return 3;
    if (validatedStamps >= 3) return 2;
    if (validatedStamps >= 1) return 1;
    return 0;
  };

  // Vérifier si le joueur peut faire une demande de pêche
  const canRequestTrial = () => {
    if (!playerData) return false;

    // Calcul du nombre maximum d'essais
    const maxTrials = getMaxTrials();

    // Vérifier si le joueur n'a pas dépassé le maximum d'essais
    if (playerData.trialCount >= maxTrials) return false;

    // Vérifier si le joueur a au moins un tampon
    return countValidatedStamps() > 0;
  };

  // Obtenir le message expliquant pourquoi le joueur ne peut pas faire de demande
  const getTrialDisabledMessage = () => {
    if (!playerData) return "Chargement...";

    const maxTrials = getMaxTrials();

    if (playerData.trialCount >= maxTrials) {
      return `Vous avez atteint le maximum d'essais (${playerData.trialCount}/${maxTrials}) pour votre niveau de tampons actuel`;
    }

    if (countValidatedStamps() === 0) {
      return "Obtenez au moins un tampon pour pouvoir pêcher";
    }

    return "";
  };

  // Charger les données du joueur
  const fetchPlayerData = async () => {
    try {
      const response = await fetch("/api/aprem/player", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des données");
      }

      const data = await response.json();
      setPlayerData(data);
      setError(null);
    } catch (err) {
      setError("Impossible de charger vos données. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  // Charger les demandes d'essai du joueur
  const fetchPlayerTrials = async () => {
    try {
      const response = await fetch("/api/aprem/player-trials", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des essais");
      }

      const data = await response.json();

      // Trouver l'essai en attente
      const pendingTrial = Object.values(data).find(
        (trial) => trial.status === "pending"
      );

      if (pendingTrial) {
        const expiresAt = pendingTrial.expiresAt;
        const now = Date.now();
        const remainingTime = Math.max(0, expiresAt - now);
        setTrialCountdown(remainingTime);
      } else {
        setTrialCountdown(null);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des essais:", err);
    }
  };

  // Charger les demandes de validation de stand du joueur
  const fetchPlayerStandRequests = async () => {
    try {
      const response = await fetch("/api/aprem/player-stand-requests", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des demandes de stand");
      }

      const data = await response.json();
      setStandRequests(data);

      // Mettre à jour les comptes à rebours pour chaque stand
      const countdowns = {};
      Object.values(data).forEach((request) => {
        if (request.status === "pending") {
          const expiresAt = request.expiresAt;
          const now = Date.now();
          const remainingTime = Math.max(0, expiresAt - now);
          countdowns[request.stand] = remainingTime;
        }
      });

      setStandRequestCountdowns(countdowns);
    } catch (err) {
      console.error("Erreur lors du chargement des demandes de stand:", err);
    }
  };

  // Charger les demandes d'essai pour les admins
  const fetchAdminTrials = async () => {
    if (!isAdmin) return;

    try {
      const response = await fetch("/api/aprem/trials", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des essais");
      }

      const data = await response.json();

      // Filtrer pour ne conserver que les essais en attente
      const pendingTrials = {};
      for (const [id, trial] of Object.entries(data)) {
        if (trial.status === "pending") {
          pendingTrials[id] = trial;
        }
      }

      setAdminTrials(pendingTrials);
    } catch (err) {
      console.error("Erreur lors du chargement des essais admin:", err);
    }
  };

  // Charger les demandes de validation de stand pour les admins
  const fetchAdminStandRequests = async () => {
    if (!isAdmin) return;

    try {
      const response = await fetch("/api/aprem/stand-requests", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des demandes de stand");
      }

      const data = await response.json();

      // Filtrer pour ne conserver que les demandes en attente
      const pendingRequests = {};
      for (const [id, request] of Object.entries(data)) {
        if (request.status === "pending") {
          pendingRequests[id] = request;
        }
      }

      setAdminStandRequests(pendingRequests);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des demandes de stand admin:",
        err
      );
    }
  };

  // Demander une validation de stand
  const handleRequestStand = async (standId) => {
    try {
      setLoading(true);
      const response = await fetch("/api/aprem/request-stand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ stand: standId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Erreur lors de la demande de validation"
        );
      }

      await fetchPlayerStandRequests();
      setRefreshCount((prev) => prev + 1);
      setError(null);
    } catch (err) {
      setError(
        err.message ||
          "Erreur lors de la demande de validation. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  // Créer une demande d'essai
  const handleCreateTrial = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/aprem/create-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Erreur lors de la création de l'essai"
        );
      }

      await fetchPlayerTrials();
      setRefreshCount((prev) => prev + 1);
    } catch (err) {
      setError(
        err.message ||
          "Erreur lors de la création de l'essai. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  // Valider une demande de stand (pour admin)
  const handleValidateStandRequest = async (requestId) => {
    try {
      const response = await fetch("/api/aprem/validate-stand-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la validation de la demande");
      }

      await fetchAdminStandRequests();
      setRefreshCount((prev) => prev + 1);
    } catch (err) {
      console.error("Erreur lors de la validation de la demande:", err);
    }
  };

  // Rejeter une demande de stand (pour admin)
  const handleRejectStandRequest = async (requestId) => {
    try {
      const response = await fetch("/api/aprem/reject-stand-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors du rejet de la demande");
      }

      await fetchAdminStandRequests();
      setRefreshCount((prev) => prev + 1);
    } catch (err) {
      console.error("Erreur lors du rejet de la demande:", err);
    }
  };

  // Valider un essai (pour admin)
  const handleValidateTrial = async (trialId) => {
    try {
      const response = await fetchWithRetry(
        "/api/aprem/validate-trial",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trialId, points: selectedPoints }),
        },
        3
      ); // 3 tentatives max

      if (response && response.message) {
        // Rafraîchir les données après succès
        await fetchAdminTrials();
        setRefreshCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Erreur lors de la validation de l'essai:", err);
      setError(
        "Erreur lors de la validation. Le système a essayé plusieurs fois sans succès."
      );
    }
  };

  // Rejeter un essai (pour admin)
  const handleRejectTrial = async (trialId) => {
    try {
      const response = await fetch("/api/aprem/reject-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ trialId }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors du rejet de l'essai");
      }

      await fetchAdminTrials();
      setRefreshCount((prev) => prev + 1);
    } catch (err) {
      console.error("Erreur lors du rejet de l'essai:", err);
    }
  };

  // Format du temps pour le compte à rebours
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Vérifier si un stand a une demande en attente
  const hasStandPendingRequest = (standId) => {
    return Object.values(standRequests).some(
      (request) => request.stand === standId && request.status === "pending"
    );
  };

  // Effet pour les comptes à rebours
  useEffect(() => {
    if (!trialCountdown && Object.keys(standRequestCountdowns).length === 0)
      return;

    const countdownInterval = setInterval(() => {
      // Mettre à jour le compte à rebours de l'essai
      if (trialCountdown) {
        setTrialCountdown((prev) => {
          if (!prev || prev <= 1000) {
            return null;
          }
          return prev - 1000;
        });
      }

      // Mettre à jour les comptes à rebours des demandes de stand
      if (Object.keys(standRequestCountdowns).length > 0) {
        setStandRequestCountdowns((prev) => {
          const updated = { ...prev };
          let changed = false;

          for (const stand in updated) {
            if (updated[stand] <= 1000) {
              delete updated[stand];
              changed = true;
            } else {
              updated[stand] -= 1000;
              changed = true;
            }
          }

          return changed ? updated : prev;
        });
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [trialCountdown, standRequestCountdowns]);

  // Effet pour charger les données initiales
  useEffect(() => {
    fetchPlayerData();
    fetchPlayerTrials();
    fetchPlayerStandRequests();
    if (isAdmin) {
      fetchAdminTrials();
      fetchAdminStandRequests();
    }
  }, [isAdmin, refreshCount]);

  // Rafraîchir les données toutes les 30 secondes
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchPlayerTrials();
      fetchPlayerStandRequests();
      if (isAdmin) {
        fetchAdminTrials();
        fetchAdminStandRequests();
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [isAdmin]);

  // Ajouter un indicateur de réessai
  useEffect(() => {
    if (retrying) {
      setError("Problème de communication, nouvelle tentative en cours...");
    }
  }, [retrying]);

  if (loading && !playerData) {
    return (
      <div className="aprem-container">
        <div className="aprem-header">
          <h1>Tampons de l'Aprem Rez</h1>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  // Trouver les noms des stands pour l'affichage admin
  const getStandName = (standId) => {
    const stand = stands.find((s) => s.id === standId);
    return stand ? stand.name : standId;
  };

  return (
    <div className="aprem-container">
      <div className="aprem-header">
        <h1>Tampons de l'Aprem Rez</h1>
        <p>
          Relevez des défis et collectez des tampons pour pouvoir participer à
          la pêche aux can'arts !
        </p>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      <div className="aprem-stands">
        {stands.map((stand) => {
          const isPending = hasStandPendingRequest(stand.id);
          const countdown = standRequestCountdowns[stand.id];

          return (
            <div key={stand.id} className="stand-card">
              <h3>{stand.name}</h3>
              <p>{stand.description}</p>
              <div className="stamp-status">
                <div
                  className={`stamp ${
                    playerData?.stands[stand.id] ? "validated" : "not-validated"
                  }`}
                >
                  {playerData?.stands[stand.id] ? "✓" : "?"}
                </div>
                <span>
                  {playerData?.stands[stand.id] ? "Validé" : "Non validé"}
                </span>
              </div>

              {isPending && countdown ? (
                <div className="stand-pending">
                  <p>Demande en attente de validation</p>
                  <div className="timer">
                    Expire dans: {formatTime(countdown)}
                  </div>
                </div>
              ) : (
                <div className="stand-action">
                  <button
                    onClick={() => handleRequestStand(stand.id)}
                    disabled={
                      playerData?.stands[stand.id] || loading || isPending
                    }
                  >
                    Demander validation
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="aprem-rewards">
        <h2>Vos récompenses</h2>

        <div className="stamps-summary">
          {[1, 2, 3, 4, 5].map((num) => (
            <div
              key={num}
              className={`stamp-circle ${
                num <= countValidatedStamps() ? "active" : "inactive"
              }`}
            >
              {num}
            </div>
          ))}
        </div>

        <div className="reward-info">
          <h3>Règles du stand de pêche aux canards</h3>
          <ul className="reward-rules">
            <li>1 tampon = 1 essai de pêche</li>
            <li>3 tampons = 2 essais de pêche</li>
            <li>5 tampons = 3 essais de pêche</li>
          </ul>
          <div className="essai-count">
            Essais utilisés: {playerData?.trialCount || 0} / {getMaxTrials()}
          </div>
          <div className="points-count">
            Points totaux: {playerData?.points || 0}
          </div>
        </div>

        {trialCountdown ? (
          <div className="trial-pending">
            <h3>Demande en attente de validation</h3>
            <div className="timer">
              Expire dans: {formatTime(trialCountdown)}
            </div>
            <p>
              Veuillez patienter pendant qu'un membre du staff valide votre
              essai.
            </p>
          </div>
        ) : (
          <div className="reward-action">
            <button
              onClick={handleCreateTrial}
              disabled={!canRequestTrial() || loading}
              title={getTrialDisabledMessage()}
            >
              Demander un essai de pêche
            </button>
            {!canRequestTrial() && (
              <p className="trial-disabled-message">
                {getTrialDisabledMessage()}
              </p>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="admin-section">
          <h2>Interface Administrateur</h2>

          {/* Ajouter un message d'information sur la robustesse du système */}
          <div className="admin-info">
            <p>
              Les actions de validation sont sécurisées contre les pertes de
              données. En cas d'erreur, plusieurs tentatives seront effectuées
              automatiquement.
            </p>
          </div>

          <h3>Demandes de validation de stands</h3>
          <div className="admin-stand-requests">
            {Object.keys(adminStandRequests).length > 0 ? (
              Object.entries(adminStandRequests).map(([requestId, request]) => (
                <div key={requestId} className="request-card">
                  <h4>Demande de validation</h4>
                  <div className="request-info">
                    <p>
                      <strong>Joueur:</strong> {request.userName}
                    </p>
                    <p>
                      <strong>Stand:</strong> {getStandName(request.stand)}
                    </p>
                    <p>
                      <strong>Créé le:</strong>{" "}
                      {new Date(request.timestamp).toLocaleTimeString()}
                    </p>
                    <div className="request-time">
                      <span>Expire dans:</span>
                      <span>
                        {formatTime(
                          Math.max(0, request.expiresAt - Date.now())
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="request-actions">
                    <button
                      className="validate"
                      onClick={() => handleValidateStandRequest(requestId)}
                    >
                      Valider
                    </button>
                    <button
                      className="cancel"
                      onClick={() => handleRejectStandRequest(requestId)}
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-requests">
                <p>Aucune demande de validation en attente.</p>
              </div>
            )}
          </div>

          <h3>Demandes d'essai de pêche aux canards</h3>
          <div className="admin-trials">
            {Object.keys(adminTrials).length > 0 ? (
              Object.entries(adminTrials).map(([trialId, trial]) => (
                <div key={trialId} className="trial-card">
                  <h4>Demande d'essai</h4>
                  <div className="trial-info">
                    <p>
                      <strong>Joueur:</strong> {trial.userName}
                    </p>
                    <div className="point-selection">
                      <p>
                        <strong>Points à attribuer:</strong>
                      </p>
                      <div className="point-options">
                        {[1, 2, 3].map((value) => (
                          <div
                            key={value}
                            className={`point-option ${
                              selectedPoints === value ? "selected" : ""
                            }`}
                            onClick={() => setSelectedPoints(value)}
                          >
                            {value}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p>
                      <strong>Créé le:</strong>{" "}
                      {new Date(trial.timestamp).toLocaleTimeString()}
                    </p>
                    <div className="trial-time">
                      <span>Expire dans:</span>
                      <span>
                        {formatTime(Math.max(0, trial.expiresAt - Date.now()))}
                      </span>
                    </div>
                  </div>

                  <div className="trial-actions">
                    <button
                      className="validate"
                      onClick={() => handleValidateTrial(trialId)}
                      disabled={retrying} // Désactiver pendant les réessais
                    >
                      {retrying
                        ? "Tentative en cours..."
                        : `Valider (${selectedPoints} pt${
                            selectedPoints > 1 ? "s" : ""
                          })`}
                    </button>
                    <button
                      className="cancel"
                      onClick={() => handleRejectTrial(trialId)}
                      disabled={retrying} // Désactiver pendant les réessais
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-trials">
                <p>Aucune demande d'essai en attente.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
