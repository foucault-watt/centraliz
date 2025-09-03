import { ArrowLeft, Infinity, Trophy, Flag, XCircle, Home } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import PromoSelector from "./PromoSelector";
import ReportPhotoModal from "./ReportPhotoModal";

const CekiluiGame = ({ onBackToMenu, onShowLeaderboard }) => {
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
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportFeedback, setReportFeedback] = useState("");
  const timerRef = useRef(null);

  // Constants
  const MAX_COMPETITIVE_ROUNDS = 10; // For UI display only, backend controls the actual limit

  const showPromoSelection = useCallback((mode) => {
    setGameMode(mode);
    setGameState("promoSelection");
  }, []);

  // Timer for competitive mode UI
  useEffect(() => {
    if (gameState === "playing" && gameMode === "competitive" && timerStarted && !isReportModalOpen) {
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
  }, [gameState, gameMode, timerStarted, isReportModalOpen]);

  // Timer for feedback messages
  useEffect(() => {
   let timer;
   if (reportFeedback) {
     timer = setTimeout(() => setReportFeedback(""), 3000);
   }
   return () => clearTimeout(timer);
  }, [reportFeedback]);

  const loadNextRound = useCallback(
    async (currentLoadedGameId = gameId, isFirstRound = false) => {
      setIsLoading(true);
      setError("");
      setSelectedChoice(null);
      setRoundResult(null);

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
          setImageLoaded(false);
          setTimerStarted(false);
          setGamePhase("playing");

          if (gameMode === "competitive") {
            setCompetitiveTotalScore(data.totalScore);
            setCompetitiveCurrentRoundNumber(data.currentRound);
          }
        } else {
          setError(data.error || "Erreur lors du chargement du round");
          setGameState(gameMode === "competitive" ? "gameover" : "menu");
        }
      } catch (error) {
        console.error("Erreur lors du chargement du round:", error);
        setError("Erreur de connexion");
        setGameState(gameMode === "competitive" ? "gameover" : "menu");
      } finally {
        setIsLoading(false);
      }
    },
    [gameMode, gameId, selectedPromos]
  );

  const startGameWithPromos = useCallback(
    async (promos) => {
      setSelectedPromos(promos);
      setCompetitiveTotalScore(0);
      setCompetitiveCurrentRoundNumber(0);

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
            await loadNextRound(data.gameId, true);
          } else {
            setError(data.error || "Erreur lors du démarrage du jeu compétitif.");
            setGameState("menu");
          }
        } catch (err) {
          console.error("Erreur lors du démarrage du jeu compétitif:", err);
          setError("Erreur de connexion lors du démarrage du jeu.");
          setGameState("menu");
        } finally {
          setIsLoading(false);
        }
      } else {
        setGameState("playing");
        await loadNextRound(null, true);
      }
    },
    [gameMode, loadNextRound]
  );

  const startServerTimer = useCallback(async () => {
    if (gameMode !== "competitive" || !gameId || !currentRoundData || timerStarted) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/game/start-timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gameId, roundId: currentRoundData.roundId }),
      });
      const data = await response.json();
      if (data.success) {
        setTimerStarted(true);
        setTimer(0);
      } else {
        console.error("Erreur lors du démarrage du chrono serveur:", data.error);
      }
    } catch (error) {
      console.error("Erreur lors du démarrage du chrono serveur:", error);
    }
  }, [gameMode, gameId, currentRoundData, timerStarted]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    if (gameMode === "competitive") {
      startServerTimer();
    }
  }, [gameMode, startServerTimer]);

  const submitAnswer = useCallback(
    async (choiceId) => {
      if (!currentRoundData || selectedChoice !== null) return;

      clearInterval(timerRef.current);
      setSelectedChoice(choiceId);
      setIsLoading(true);

      try {
        const body = { roundId: currentRoundData.roundId, choiceId };
        if (gameMode === "competitive" && gameId) {
          body.gameId = gameId;
        } else if (gameMode === "endless") {
          body.timeElapsed = timer;
        }

        const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/game/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const data = await response.json();

        if (data.success) {
          setRoundResult(data);
          if (gameMode === "competitive") {
            setCompetitiveTotalScore(data.totalScore);
            setCompetitiveCurrentRoundNumber(data.currentRound);
            setRoundProgress((prev) => {
              const newProgress = [...prev];
              const currentIndex = data.currentRound - 2;
              if (currentIndex >= 0) newProgress[currentIndex] = data.correct ? "correct" : "incorrect";
              return newProgress;
            });
            // Toujours passer par la phase "answered" pour montrer le résultat
            setGamePhase("answered");
          } else {
            setEndlessScore((prev) => ({
              correct: prev.correct + (data.correct ? 1 : 0),
              total: prev.total + 1,
              points: prev.points + (data.scoreGainedThisRound || 0),
            }));
            setGamePhase("answered");
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
  
  const backToMenu = useCallback(() => {
    setGameState("menu");
    setSelectedPromos([]);
    setCurrentRoundData(null);
    setSelectedChoice(null);
    setRoundResult(null);
    setError("");
    setGameMode(null);
    setGameId(null);
    setCompetitiveTotalScore(0);
    setCompetitiveCurrentRoundNumber(0);
    setEndlessScore({ correct: 0, total: 0, points: 0 });
    setImageLoaded(false);
    setTimerStarted(false);
    setReportFeedback("");
  }, []);

  const handleReportSubmit = async ({ reason, details }) => {
    if (!currentRoundData) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/report-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          photoName: currentRoundData.photoUrl.split('/').pop(),
          reason,
          details,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setReportFeedback("Signalement envoyé. Merci !");
      } else {
        setReportFeedback(result.error || "Erreur lors de l'envoi.");
      }
    } catch (err) {
      setReportFeedback("Erreur de connexion.");
    } finally {
      setIsReportModalOpen(false);
    }
  };

  // --- Countdown to next round or game over ---
  useEffect(() => {
    let nextRoundTimer;
    if (gamePhase === 'answered' && !isReportModalOpen) {
      nextRoundTimer = setTimeout(() => {
        // Après avoir montré le résultat, vérifier si le jeu est terminé
        if (roundResult && roundResult.isGameOver) {
          setGameState("gameover");
        } else {
          loadNextRound();
        }
      }, 3000); // Wait 3 seconds
    }
    return () => clearTimeout(nextRoundTimer);
  }, [gamePhase, isReportModalOpen, loadNextRound, roundResult]);
  // --- End Countdown Logic ---

  if (error) {
    return (
      <div className="text-center space-y-6 animate-scale-in">
        <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto"><span className="text-3xl">⚠️</span></div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-danger">Erreur</h3>
          <p className="text-gray-600 leading-relaxed">{error}</p>
        </div>
        <div className="space-y-3">
          <button onClick={backToMenu} className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95">Retour au menu</button>
          <button onClick={onBackToMenu} className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-secondary py-3 px-6 rounded-xl font-medium transition-all duration-300 border border-gray-200"><XCircle size={16} /><span>Quitter le jeu</span></button>
        </div>
      </div>
    );
  }

  if (gameState === "menu") {
    return (
      <div className="space-y-8 animate-scale-in">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-secondary">🎯 Cékilui</h2>
          <p className="text-gray-600 text-lg leading-relaxed">Devinez qui est sur la photo !</p>
        </div>
        <div className="space-y-4">
          <button className="w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95" onClick={() => showPromoSelection("competitive")}>
            <div className="flex items-center justify-center space-x-3"><Trophy className="w-6 h-6" /> <span className="text-lg font-semibold">Mode Compétitif</span></div>
            <p className="text-sm opacity-90 mt-2">10 rounds • Score basé sur la vitesse</p>
          </button>
          <button className="w-full bg-gradient-to-r from-secondary to-gray-700 hover:from-gray-700 hover:to-secondary text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95" onClick={() => showPromoSelection("endless")}>
            <div className="flex items-center justify-center space-x-3"><Infinity className="w-6 h-6" /> <span className="text-lg font-semibold">Mode Sans Fin</span></div>
            <p className="text-sm opacity-90 mt-2">Entraînement • Pas de limite de temps</p>
          </button>
        </div>
        <button onClick={onBackToMenu} className="w-full flex items-center justify-center space-x-2 text-gray-600 hover:text-secondary py-3 transition-colors duration-300"><ArrowLeft className="w-4 h-4" /><span>Retour</span></button>
      </div>
    );
  }

  if (gameState === "promoSelection") {
    return <PromoSelector onStartGame={startGameWithPromos} onCancel={backToMenu} gameMode={gameMode} />;
  }

  if (gameState === "playing") {
    return (
      <div>
        <header className="sticky top-0 z-10 bg-background-module/95 backdrop-blur-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 pb-2 -pt-6">
            <button onClick={backToMenu} className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-300"><ArrowLeft size={20} className="text-secondary" /></button>
            <div className="text-center">
              <div className="text-lg font-bold text-secondary">{gameMode === "competitive" ? `${competitiveTotalScore} pts` : `${endlessScore.correct}/${endlessScore.total}`}</div>
              {gameMode === "competitive" && <div className="text-xs text-gray-500">Round {competitiveCurrentRoundNumber}/{MAX_COMPETITIVE_ROUNDS}</div>}
            </div>
            {gameMode === "competitive" && (
              <div className="flex space-x-1">
                {Array.from({ length: MAX_COMPETITIVE_ROUNDS }, (_, index) => (
                  <div key={index} className={`w-2 h-2 rounded-full ${index < competitiveCurrentRoundNumber - 1 ? (roundProgress[index] === "correct" ? "bg-game-correct" : "bg-danger") : index === competitiveCurrentRoundNumber - 1 ? "bg-primary animate-pulse-soft" : "bg-gray-300"}`} />
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="max-w-md mx-auto pt-2 pb-safe ">
          {gamePhase === "playing" && currentRoundData ? (
            <div className="space-y-6 animate-scale-in flex flex-col items-center align-middle">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 w-3/4">
                <button onClick={() => setIsReportModalOpen(true)} className="absolute top-2 right-2 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors" title="Signaler la photo"><Flag size={16} className="text-white" /></button>
                <img src={`${process.env.REACT_APP_URL_BACK}${currentRoundData.photoUrl}`} alt="Photo mystère" className="w-full h-full object-cover mx-auto" onError={(e) => { e.target.style.backgroundColor = "#f0f0f0"; e.target.style.border = "2px dashed #ccc"; }} onLoad={handleImageLoad} crossOrigin="use-credentials" />
                {gameMode === "competitive" && timerStarted && (
                  <div className="absolute w-full h-full mx-auto inset-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                      <circle cx="50" cy="50" r="49" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="308" strokeDashoffset={308 - (308 * timer) / 5000} className="transition-all duration-100" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-col space-y-4 items-center w-5/6">
                {currentRoundData.choices.map((choice) => (
                  <button key={choice.id} onClick={() => submitAnswer(choice.id)} disabled={selectedChoice !== null || isLoading} className={`p-3 rounded-xl font-medium transition-all duration-200 active:scale-95 border-2 w-3/4 ${selectedChoice === choice.id ? "bg-primary text-white border-primary shadow-lg" : "bg-white hover:bg-gray-50 text-secondary border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg"} ${(selectedChoice !== null || isLoading) && selectedChoice !== choice.id ? "opacity-50" : ""}`}>
                    {choice.displayName}
                  </button>
                ))}
              </div>
            </div>
          ) : gamePhase === "answered" && roundResult ? (
            <div className="space-y-6 animate-scale-in flex flex-col align-middle items-center">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 border-4 border-game-photo-border w-3/4">
                <button onClick={() => setIsReportModalOpen(true)} className="absolute top-2 right-2 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors" title="Signaler la photo"><Flag size={16} className="text-white" /></button>
                <img src={`${process.env.REACT_APP_URL_BACK}${currentRoundData.photoUrl}`} alt="Photo révélée" className="w-full h-full object-cover mx-auto" crossOrigin="use-credentials" />
                <div className={`absolute w-full h-full mx-auto inset-0 flex items-center justify-center ${roundResult.correct ? "bg-success/50" : "bg-danger/50"}`}>
                  <div className="text-center space-y-4">
                    <div className="text-white font-bold text-xl">{roundResult.correct ? "Correct 🤗" : "Incorrect 😓"}</div>
                    {gameMode === "competitive" && roundResult.correct && <div className="text-white font-semibold text-lg">+{roundResult.scoreGainedThisRound} pts</div>}
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-lg w-5/6">
                <div className="text-center space-y-2">
                  <p className="text-gray-600 text-sm">Réponse :</p>
                  <p className="text-secondary font-semibold text-lg">{roundResult.correctAnswer.displayName}</p>
                </div>
              </div>
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden w-full">
                <div key={currentRoundData.roundId} className="bg-primary h-full animate-countdown" style={{ animationPlayState: isReportModalOpen ? 'paused' : 'running' }}></div>
              </div>
              <p className="text-center text-gray-600 text-sm">Round suivant...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-scale-in">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-secondary font-medium text-lg">Chargement du round...</p>
            </div>
          )}
        </main>
        <ReportPhotoModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onSubmit={handleReportSubmit} />
        {reportFeedback && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-secondary text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-out">{reportFeedback}</div>}
      </div>
    );
  }

  if (gameState === "gameover") {
    return (
      <div className="text-center space-y-8 animate-scale-in">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto"><span className="text-4xl">{competitiveTotalScore >= 500 ? "😄" : competitiveTotalScore >= 300 ? "😊" : "😐"}</span></div>
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-secondary">Ton score</h2>
            <div className="text-5xl font-bold text-primary">{competitiveTotalScore}<span className="text-2xl text-gray-500">pts</span></div>
            <p className="text-gray-600 leading-relaxed">{competitiveTotalScore >= 500 ? "Excellent ! Tu maîtrises parfaitement !" : competitiveTotalScore >= 300 ? "Bien joué ! Continue comme ça !" : "Tu n'as pas battu ton meilleur score mais persévère !"}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-game-correct">{roundProgress.filter((r) => r === "correct").length}</div>
              <div className="text-xs text-gray-500">Correctes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-danger">{roundProgress.filter((r) => r === "incorrect").length}</div>
              <div className="text-xs text-gray-500">Incorrectes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{Math.round((roundProgress.filter((r) => r === "correct").length / MAX_COMPETITIVE_ROUNDS) * 100)}%</div>
              <div className="text-xs text-gray-500">Précision</div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <button onClick={() => { setGameState("playing"); setGamePhase("ready"); setCompetitiveTotalScore(0); setCompetitiveCurrentRoundNumber(0); setRoundProgress([]); loadNextRound(gameId, true); }} className="w-full bg-primary hover:bg-primary-dark text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl">🔄 Rejouer</button>
          <button onClick={onShowLeaderboard} className="w-full bg-gradient-to-r from-secondary to-gray-700 hover:from-gray-700 hover:to-secondary text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl">📊 Consulter le classement</button>
          <button onClick={onBackToMenu} className="w-full flex items-center justify-center space-x-2 text-gray-600 hover:text-secondary py-3 transition-colors duration-300"><Home size={16} /><span>Retourner à l'accueil</span></button>
        </div>
      </div>
    );
  }

  return null;
};

export default CekiluiGame;
