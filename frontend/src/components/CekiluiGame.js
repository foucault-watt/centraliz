import React, { useState, useCallback } from 'react';
import PromoSelector from './PromoSelector';

const CekiluiGame = ({ onBackToMenu }) => {
  const [gameState, setGameState] = useState('menu'); // 'menu', 'promoSelection', 'playing', 'result'
  const [selectedPromos, setSelectedPromos] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const showPromoSelection = useCallback(() => {
    setGameState('promoSelection');
  }, []);

  const startGameWithPromos = useCallback(async (promos) => {
    setSelectedPromos(promos);
    setGameState('playing');
    setScore({ correct: 0, total: 0 });
    await loadNextRound(promos);
  }, []);

  const loadNextRound = useCallback(async (promos = selectedPromos) => {
    setIsLoading(true);
    setError('');
    setSelectedChoice(null);
    setResult(null);

    try {
      // Construire l'URL avec les groupes sélectionnés
      const groupsParam = promos.length > 0 ? `?groups=${promos.join(',')}` : '';
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/game/round${groupsParam}`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setCurrentRound(data);
      } else {
        setError(data.error || 'Erreur lors du chargement du round');
      }
    } catch (error) {
      console.error('Erreur lors du chargement du round:', error);
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPromos]);

  const submitAnswer = useCallback(async (choiceId) => {
    if (!currentRound || selectedChoice !== null) return;

    setSelectedChoice(choiceId);
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/game/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          roundId: currentRound.roundId,
          choiceId: choiceId
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        setScore(prev => ({
          correct: prev.correct + (data.correct ? 1 : 0),
          total: prev.total + 1
        }));
        // Ne pas changer l'état tout de suite, laisser l'interface actuelle
        setTimeout(() => {
          setGameState('result');
        }, 100); // Petit délai pour une transition plus fluide
      } else {
        setError(data.error || 'Erreur lors de la vérification');
      }
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  }, [currentRound, selectedChoice]);

  const nextRound = useCallback(() => {
    setGameState('playing');
    loadNextRound();
  }, [loadNextRound]);

  const backToMenu = useCallback(() => {
    setGameState('menu');
    setSelectedPromos([]);
    setCurrentRound(null);
    setSelectedChoice(null);
    setResult(null);
    setError('');
    setScore({ correct: 0, total: 0 });
  }, []);

  const backToPromoSelection = useCallback(() => {
    setGameState('promoSelection');
    setCurrentRound(null);
    setSelectedChoice(null);
    setResult(null);
    setError('');
  }, []);

  if (error) {
    return (
      <div className="cekilui-game">
        <div className="cekilui-game__error">
          <h3>Erreur</h3>
          <p>{error}</p>
          <div className="cekilui-game__actions">
            <button onClick={backToMenu} className="cekilui-btn cekilui-btn--secondary">
              Retour au menu
            </button>
            <button onClick={onBackToMenu} className="cekilui-btn cekilui-btn--cancel">
              Quitter le jeu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'menu') {
    return (
      <div className="cekilui-game">
        <div className="cekilui-game__menu">
          <div className="cekilui-game__title">
            <h2>🎯 Jeu Cékilui</h2>
            <p>Devinez qui est sur la photo !</p>
          </div>
          
          <div className="cekilui-game__rules">
            <h3>Comment jouer ?</h3>
            <ul>
              <li>Une photo s'affiche</li>
              <li>Choisissez le bon nom parmi 4 propositions</li>
              <li>Gagnez des points en trouvant la bonne réponse</li>
              <li>Mode sans fin - jouez autant que vous voulez !</li>
            </ul>
          </div>

          <div className="cekilui-game__actions">
            <button onClick={showPromoSelection} className="cekilui-btn cekilui-btn--primary">
              Commencer à jouer
            </button>
            <button onClick={onBackToMenu} className="cekilui-btn cekilui-btn--secondary">
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'promoSelection') {
    return (
      <div className="cekilui-game">
        <PromoSelector
          onStartGame={startGameWithPromos}
          onCancel={backToMenu}
        />
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="cekilui-game">
        <div className="cekilui-game__header">
          <div className="cekilui-game__score">
            Score: {score.correct}/{score.total}
          </div>
          <button onClick={backToMenu} className="cekilui-btn cekilui-btn--cancel cekilui-btn--small">
            Menu
          </button>
        </div>

        {isLoading ? (
          <div className="cekilui-game__loading">
            <p>Chargement du round...</p>
          </div>
        ) : currentRound ? (
          <div className="cekilui-game__round">
            <div className="cekilui-game__question">
              <h3>Cékilui ?</h3>
              {selectedChoice && isLoading && (
                <p className="cekilui-game__waiting">Vérification en cours...</p>
              )}
            </div>

            <div className="cekilui-game__photo">
              <img
                src={`${process.env.REACT_APP_URL_BACK}${currentRound.photoUrl}`}
                alt="Photo mystère"
                className="cekilui-game__photo-img"
                onError={(e) => {
                  console.error('Erreur de chargement de l\'image:', e.target.src);
                  e.target.style.backgroundColor = '#f0f0f0';
                  e.target.style.border = '2px dashed #ccc';
                }}
                onLoad={() => {
                  console.log('Image chargée avec succès:', `${process.env.REACT_APP_URL_BACK}${currentRound.photoUrl}`);
                }}
                crossOrigin="use-credentials"
              />
            </div>

            <div className="cekilui-game__choices">
              {currentRound.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => submitAnswer(choice.id)}
                  disabled={selectedChoice !== null || isLoading}
                  className={`cekilui-game__choice ${
                    selectedChoice === choice.id ? 'selected' : ''
                  } ${
                    selectedChoice !== null && selectedChoice !== choice.id ? 'disabled' : ''
                  }`}
                >
                  {choice.displayName}
                  {selectedChoice === choice.id && isLoading && (
                    <span className="cekilui-game__choice-loading">⏳</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (gameState === 'result') {
    return (
      <div className="cekilui-game">
        <div className="cekilui-game__header">
          <div className="cekilui-game__score">
            Score: {score.correct}/{score.total}
          </div>
        </div>

        <div className="cekilui-game__result">
          <div className={`cekilui-game__result-icon ${result.correct ? 'correct' : 'incorrect'}`}>
            {result.correct ? '✅' : '❌'}
          </div>

          <h3 className={`cekilui-game__result-title ${result.correct ? 'correct' : 'incorrect'}`}>
            {result.correct ? 'Bravo !' : 'Dommage !'}
          </h3>

          <div className="cekilui-game__photo">
            <img
              src={`${process.env.REACT_APP_URL_BACK}${currentRound.photoUrl}`}
              alt="Photo révélée"
              className="cekilui-game__photo-img"
              onError={(e) => {
                console.error('Erreur de chargement de l\'image:', e.target.src);
                e.target.style.backgroundColor = '#f0f0f0';
                e.target.style.border = '2px dashed #ccc';
              }}
              crossOrigin="use-credentials"
            />
          </div>

          <div className="cekilui-game__answer">
            <p>La bonne réponse était :</p>
            <h4>{result.correctAnswer.displayName}</h4>
            {result.correctAnswer.group && (
              <p className="cekilui-game__promo">Promo : {result.correctAnswer.group}</p>
            )}
          </div>

          <div className="cekilui-game__actions">
            <button onClick={nextRound} className="cekilui-btn cekilui-btn--primary">
              Round suivant
            </button>
            <button onClick={backToMenu} className="cekilui-btn cekilui-btn--secondary">
              Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default CekiluiGame;