import { ArrowLeft, Infinity, Play, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import PromoSelector from "./PromoSelector";

const CekiluiGame = ({ onBackToMenu }) => {
  const [gameState, setGameState] = useState("menu"); // 'menu', 'promoSelection', 'playing', 'result', 'gameover'
  const [selectedPromos, setSelectedPromos] = useState([]);
  const [currentRoundData, setCurrentRoundData] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [gameMode, setGameMode] = useState(null); // 'endless', 'competitive'
  const [gameId, setGameId] = useState(null); // Stores the ID of the competitive game session
  const [competitiveTotalScore, setCompetitiveTotalScore] = useState(0); // Total score for competitive mode
  const [competitiveCurrentRoundNumber, setCompetitiveCurrentRoundNumber] =
    useState(0); // Current round number for competitive mode
  const [endlessScore, setEndlessScore] = useState({
    correct: 0,
    total: 0,
    points: 0,
  }); // Local score for endless mode
  const [timer, setTimer] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false); // Track if image is loaded
  const [timerStarted, setTimerStarted] = useState(false); // Track if server timer is started
  const [gamePhase, setGamePhase] = useState("ready"); // 'ready', 'playing', 'answered', 'gameover'
  const [roundProgress, setRoundProgress] = useState([]); // Track progress of each round
  const timerRef = useRef(null);

  // Constants
  const MAX_COMPETITIVE_ROUNDS = 10; // For UI display only, backend controls the actual limit

  const showPromoSelection = useCallback((mode) => {
    setGameMode(mode);
    setGameState("promoSelection");
  }, []);

  // Gestion du timer informatif (pour l'affichage uniquement)
  useEffect(() => {
    if (gameState === "playing" && gameMode === "competitive" && timerStarted) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 100);
      }, 100);
    } else {
      clearInterval(timerRef.current);
      if (gameState !== "playing" || !timerStarted) {
        setTimer(0);
      }
    }

    return () => clearInterval(timerRef.current);
  }, [gameState, gameMode, timerStarted]);

  const startGameWithPromos = useCallback(
    async (promos) => {
      setSelectedPromos(promos);
      setCompetitiveTotalScore(0); // Reset total score for new game
      setCompetitiveCurrentRoundNumber(0); // Reset round number for new game

      if (gameMode === "competitive") {
        setIsLoading(true);
        setError("");
        try {
          const response = await fetch(
            `${process.env.REACT_APP_URL_BACK}/api/ceki/game/start-competitive`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ selectedGroups: promos }),
            }
          );
          const data = await response.json();
          if (data.success) {
            setGameId(data.gameId);
            setGameState("playing");
            await loadNextRound(data.gameId, true); // Pass gameId and mark as first round
          } else {
            setError(
              data.error || "Erreur lors du démarrage du jeu compétitif."
            );
            setGameState("menu"); // Go back to menu on error
          }
        } catch (err) {
          console.error("Erreur lors du démarrage du jeu compétitif:", err);
          setError("Erreur de connexion lors du démarrage du jeu.");
          setGameState("menu"); // Go back to menu on error
        } finally {
          setIsLoading(false);
        }
      } else {
        // Endless mode
        setGameState("playing");
        await loadNextRound(null, true); // No gameId needed for endless mode, but mark as first round
      }
    },
    [gameMode]
  );

  const loadNextRound = useCallback(
    async (currentLoadedGameId = gameId, isFirstRound = false) => {
      // Accept gameId as parameter and isFirstRound flag
      setIsLoading(true);
      setError("");
      setSelectedChoice(null);
      setRoundResult(null); // Reset round result

      try {
        let url = `${process.env.REACT_APP_URL_BACK}/api/ceki/game/round`;
        if (gameMode === "competitive" && currentLoadedGameId) {
          url += `?gameId=${currentLoadedGameId}`;
        } else if (gameMode === "endless" && selectedPromos.length > 0) {
          url += `?groups=${selectedPromos.join(",")}`;
        }

        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (data.success) {
          setCurrentRoundData(data);
          setImageLoaded(false); // Reset image loaded state
          setTimerStarted(false); // Reset timer started state

          // Only show "ready" phase for the first round of competitive mode or endless mode
          if (isFirstRound || gameMode === "endless") {
            setGamePhase("ready");
          } else {
            // For subsequent rounds in competitive mode, go directly to playing
            setGamePhase("playing");
          }

          if (gameMode === "competitive") {
            setCompetitiveTotalScore(data.totalScore); // Update total score from backend
            setCompetitiveCurrentRoundNumber(data.currentRound); // Update current round number from backend
          }
        } else {
          setError(data.error || "Erreur lors du chargement du round");
          if (gameMode === "competitive") {
            setGameState("gameover"); // Transition to gameover state on error in competitive mode
          } else {
            setGameState("menu"); // Go back to menu on error in endless mode
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement du round:", error);
        setError("Erreur de connexion");
        if (gameMode === "competitive") {
          setGameState("gameover"); // Transition to gameover state on error in competitive mode
        } else {
          setGameState("menu"); // Go back to menu on error in endless mode
        }
      } finally {
        setIsLoading(false);
      }
    },
    [gameMode, gameId, selectedPromos]
  ); // Added gameId and selectedPromos as dependencies

  // Fonction pour démarrer le chrono côté serveur après chargement de l'image
  const startServerTimer = useCallback(async () => {
    if (
      gameMode !== "competitive" ||
      !gameId ||
      !currentRoundData ||
      timerStarted
    )
      return;

    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/ceki/game/start-timer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            gameId: gameId,
            roundId: currentRoundData.roundId,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setTimerStarted(true);
        setTimer(0); // Reset timer display
        console.log("Chrono serveur démarré");
      } else {
        console.error(
          "Erreur lors du démarrage du chrono serveur:",
          data.error
        );
      }
    } catch (error) {
      console.error("Erreur lors du démarrage du chrono serveur:", error);
    }
  }, [gameMode, gameId, currentRoundData, timerStarted]);

  // Gestionnaire de chargement d'image
  const handleImageLoad = useCallback(() => {
    console.log("Image chargée avec succès");
    setImageLoaded(true);

    // Démarrer le chrono serveur uniquement en mode compétitif
    if (gameMode === "competitive") {
      startServerTimer();
    }
  }, [gameMode, startServerTimer]);

  const submitAnswer = useCallback(
    async (choiceId) => {
      if (!currentRoundData || selectedChoice !== null) return;

      clearInterval(timerRef.current); // Stop timer immediately
      setSelectedChoice(choiceId);
      setIsLoading(true);

      try {
        const body = {
          roundId: currentRoundData.roundId,
          choiceId: choiceId,
          // Ne plus envoyer timeElapsed pour le mode compétitif, le backend calcule le temps
        };
        if (gameMode === "competitive" && gameId) {
          body.gameId = gameId; // Add gameId for competitive mode
        } else if (gameMode === "endless") {
          // Pour le mode endless, on peut garder le temps frontend
          body.timeElapsed = timer;
        }

        const response = await fetch(
          `${process.env.REACT_APP_URL_BACK}/api/ceki/game/answer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(body),
          }
        );

        const data = await response.json();

        if (data.success) {
          setRoundResult(data); // Store round result
          if (gameMode === "competitive") {
            setCompetitiveTotalScore(data.totalScore); // Update total score from backend
            setCompetitiveCurrentRoundNumber(data.currentRound); // Update current round number from backend

            // Mettre à jour le progrès des rounds avec le résultat
            setRoundProgress((prev) => {
              const newProgress = [...prev];
              const currentIndex = competitiveCurrentRoundNumber - 1;
              if (currentIndex >= 0) {
                newProgress[currentIndex] = data.correct
                  ? "correct"
                  : "incorrect";
              }
              return newProgress;
            });

            if (data.isGameOver) {
              setGameState("gameover"); // Game is over, transition to gameover state
            } else {
              // Passer directement à la phase "answered" sans écran intermédiaire
              setGamePhase("answered");
              // Après 3 secondes, passer au round suivant automatiquement
              setTimeout(() => {
                loadNextRound(gameId, false);
              }, 3000);
            }
          } else {
            // Endless mode: update local score
            setEndlessScore((prev) => ({
              correct: prev.correct + (data.correct ? 1 : 0),
              total: prev.total + 1,
              points: prev.points + (data.scoreGainedThisRound || 0), // Use scoreGainedThisRound
            }));
            // Passer directement à la phase "answered" sans écran intermédiaire
            setGamePhase("answered");
            // Après 3 secondes, passer au round suivant automatiquement
            setTimeout(() => {
              loadNextRound(null, false);
            }, 3000);
          }
        } else {
          setError(data.error || "Erreur lors de la vérification");
        }
      } catch (error) {
        console.error("Erreur lors de la soumission:", error);
        setError("Erreur de connexion");
      } finally {
        setIsLoading(false);
      }
    },
    [currentRoundData, selectedChoice, timer, gameMode, gameId]
  );

  const nextRound = useCallback(() => {
    // Backend handles game over detection, so we just continue to next round
    setGameState("playing");
    loadNextRound(gameId, false); // Pass gameId and mark as NOT first round
  }, [gameMode, loadNextRound, gameId]);

  // saveScoreAndExit is removed as backend handles saving

  const backToMenu = useCallback(() => {
    setGameState("menu");
    setSelectedPromos([]);
    setCurrentRoundData(null);
    setSelectedChoice(null);
    setRoundResult(null);
    setError("");
    setGameMode(null);
    setGameId(null); // Reset gameId
    setCompetitiveTotalScore(0); // Reset total score
    setCompetitiveCurrentRoundNumber(0); // Reset round number
    setEndlessScore({ correct: 0, total: 0, points: 0 }); // Reset endless score
    setImageLoaded(false); // Reset image loaded state
    setTimerStarted(false); // Reset timer started state
  }, []);

  const backToPromoSelection = useCallback(() => {
    setGameState("promoSelection");
    setCurrentRoundData(null);
    setSelectedChoice(null);
    setRoundResult(null);
    setError("");
    setGameId(null); // Reset gameId if going back to promo selection
    setCompetitiveTotalScore(0);
    setCompetitiveCurrentRoundNumber(0);
    setEndlessScore({ correct: 0, total: 0, points: 0 });
    setImageLoaded(false); // Reset image loaded state
    setTimerStarted(false); // Reset timer started state
  }, []);

  if (error) {
    return (
      <div className="cekilui-game">
        <div className="cekilui-game__error">
          <h3>Erreur</h3>
          <p>{error}</p>
          <div className="cekilui-game__actions">
            <button
              onClick={backToMenu}
              className="cekilui-btn cekilui-btn--secondary"
            >
              Retour au menu
            </button>
            <button
              onClick={onBackToMenu}
              className="cekilui-btn cekilui-btn--cancel"
            >
              Quitter le jeu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === "menu") {
    return (
      <div className="cekilui-game cekilui-game--clean">
        <div className="cekilui-game-container">
          <div className="cekilui-game__simple-menu">
            <div className="cekilui-game__title">
              <h2>🎯 Cékilui</h2>
              <p>Devinez qui est sur la photo !</p>
            </div>

            <div className="cekilui-game__mode-buttons">
              <button
                className="cekilui-game__mode-btn cekilui-game__mode-btn--competitive"
                onClick={() => showPromoSelection("competitive")}
              >
                <Trophy className="cekilui-game__mode-icon" size={24} />
                <span className="cekilui-game__mode-label">
                  Mode Compétitif
                </span>
              </button>
              <button
                className="cekilui-game__mode-btn cekilui-game__mode-btn--endless"
                onClick={() => showPromoSelection("endless")}
              >
                <Infinity className="cekilui-game__mode-icon" size={24} />
                <span className="cekilui-game__mode-label">Mode Sans Fin</span>
              </button>
            </div>

            <button onClick={onBackToMenu} className="cekilui-game__back-link">
              <ArrowLeft clas size={16} />
              <span>Retour</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === "promoSelection") {
    return (
      <div className="cekilui-game">
        <div className="cekilui-game-container">
          <PromoSelector
            onStartGame={startGameWithPromos}
            onCancel={backToMenu}
            gameMode={gameMode} // Pass gameMode to PromoSelector
          />
        </div>
      </div>
    );
  }

  if (gameState === "playing") {
    return (
      <div className="cekilui-game cekilui-game--new-design">
        <div className="cekilui-game-container">
          {/* Header fixe avec score et progression */}
          <div className="cekilui-game__header-new">
            <button onClick={backToMenu} className="cekilui-game__back-btn">
              <ArrowLeft size={20} />
            </button>
            <div className="cekilui-game__score-display">
              {gameMode === "competitive"
                ? `${competitiveTotalScore} pts`
                : `${endlessScore.correct}/${endlessScore.total}`}
            </div>
            {gameMode === "competitive" && (
              <div className="cekilui-game__progress-dots">
                {Array.from({ length: MAX_COMPETITIVE_ROUNDS }, (_, index) => (
                  <div
                    key={index}
                    className={`cekilui-game__progress-dot ${
                      index < competitiveCurrentRoundNumber - 1
                        ? roundProgress[index] === "correct"
                          ? "correct"
                          : "incorrect"
                        : index === competitiveCurrentRoundNumber - 1
                        ? "current"
                        : "upcoming"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Zone de jeu principale */}
          <div className="cekilui-game__main-area">
            {gamePhase === "ready" && currentRoundData ? (
              /* État "Ready" - Gros bouton Go */
              <div className="cekilui-game__ready-state">
                <div className="cekilui-game__photo-container">
                  <img
                    src={`${process.env.REACT_APP_URL_BACK}${currentRoundData.photoUrl}`}
                    alt="Photo mystère"
                    className="cekilui-game__photo-img"
                    onError={(e) => {
                      console.error(
                        "Erreur de chargement de l'image:",
                        e.target.src
                      );
                      e.target.style.backgroundColor = "#f0f0f0";
                      e.target.style.border = "2px dashed #ccc";
                    }}
                    onLoad={handleImageLoad}
                    crossOrigin="use-credentials"
                  />
                  <div className="cekilui-game__go-overlay">
                    <button
                      className="cekilui-game__go-button"
                      onClick={() => {
                        if (
                          imageLoaded &&
                          (gameMode !== "competitive" || timerStarted)
                        ) {
                          setGamePhase("playing");
                        }
                      }}
                      disabled={
                        !imageLoaded ||
                        (gameMode === "competitive" && !timerStarted)
                      }
                    >
                      <Play size={20} />
                    </button>
                    <p className="cekilui-game__go-text">À toi de jouer</p>
                  </div>
                </div>
              </div>
            ) : gamePhase === "playing" && currentRoundData ? (
              /* État "Playing" - Photo + choix */
              <div className="cekilui-game__playing-state">
                <div className="cekilui-game__photo-container">
                  <img
                    src={`${process.env.REACT_APP_URL_BACK}${currentRoundData.photoUrl}`}
                    alt="Photo mystère"
                    className="cekilui-game__photo-img"
                    crossOrigin="use-credentials"
                  />
                  {gameMode === "competitive" && (
                    <div className="cekilui-game__timer-ring">
                      <svg
                        className="cekilui-game__timer-svg"
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#ffd700"
                          strokeWidth="4"
                          strokeDasharray="283"
                          strokeDashoffset={283 - (283 * timer) / 5000}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="cekilui-game__choices-new">
                  {currentRoundData.choices.map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => submitAnswer(choice.id)}
                      disabled={selectedChoice !== null || isLoading}
                      className={`cekilui-game__choice-new ${
                        selectedChoice === choice.id ? "selected" : ""
                      }`}
                    >
                      {choice.displayName}
                    </button>
                  ))}
                </div>
              </div>
            ) : gamePhase === "answered" && roundResult ? (
              /* État "Answered" - Affichage intégré du résultat */
              <div className="cekilui-game__answered-state">
                <div className="cekilui-game__photo-container">
                  <img
                    src={`${process.env.REACT_APP_URL_BACK}${currentRoundData.photoUrl}`}
                    alt="Photo révélée"
                    className="cekilui-game__photo-img"
                    crossOrigin="use-credentials"
                  />
                </div>

                <div
                  className={`cekilui-game__result-integrated ${
                    roundResult.correct ? "correct" : "incorrect"
                  }`}
                >
                  <div className="cekilui-game__result-status">
                    <span className="cekilui-game__result-emoji">
                      {roundResult.correct ? "✅" : "❌"}
                    </span>
                    <span className="cekilui-game__result-message">
                      {roundResult.correct ? "Correct !" : "Incorrect"}
                    </span>
                    {gameMode === "competitive" && roundResult.correct && (
                      <span className="cekilui-game__result-points">
                        +{roundResult.scoreGainedThisRound} pts
                      </span>
                    )}
                  </div>

                  <div className="cekilui-game__correct-answer-display">
                    <span className="cekilui-game__answer-label">
                      Réponse :
                    </span>
                    <span className="cekilui-game__answer-name">
                      {roundResult.correctAnswer.displayName}
                    </span>
                  </div>

                  <div className="cekilui-game__next-round-countdown">
                    <div className="cekilui-game__countdown-bar"></div>
                    <span className="cekilui-game__countdown-text">
                      Round suivant...
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* État de chargement */
              <div className="cekilui-game__loading">
                <p>Chargement du round...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === "gameover") {
    return (
      <div className="cekilui-game cekilui-game--new-design">
        <div className="cekilui-game-container">
          <div className="cekilui-game__gameover-new">
            <div className="cekilui-game__final-score-container">
              <div className="cekilui-game__score-emoji">
                {competitiveTotalScore >= 500
                  ? "😄"
                  : competitiveTotalScore >= 300
                  ? "😊"
                  : "😐"}
              </div>
              <div className="cekilui-game__final-score-card">
                <h2 className="cekilui-game__final-title">Ton score</h2>
                <div className="cekilui-game__final-points">
                  {competitiveTotalScore}pts
                </div>
                <p className="cekilui-game__final-message">
                  {competitiveTotalScore >= 500
                    ? "Excellent ! Tu maîtrises parfaitement !"
                    : competitiveTotalScore >= 300
                    ? "Bien joué ! Continue comme ça !"
                    : "Tu n'as pas battu ton meilleur score mais persévère !"}
                </p>
              </div>
            </div>

            <div className="cekilui-game__final-actions">
              <button
                onClick={() => {
                  // Restart game with same promos
                  setGameState("playing");
                  setGamePhase("ready");
                  setCompetitiveTotalScore(0);
                  setCompetitiveCurrentRoundNumber(0);
                  setRoundProgress([]);
                  loadNextRound(gameId, true); // Mark as first round when restarting
                }}
                className="cekilui-game__final-btn cekilui-game__final-btn--primary"
              >
                Rejouer
              </button>
              <button
                onClick={backToMenu}
                className="cekilui-game__final-btn cekilui-game__final-btn--secondary"
              >
                Consulter le classement
              </button>
              <button
                onClick={onBackToMenu}
                className="cekilui-game__final-link"
              >
                Retourner à l'accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default CekiluiGame;
