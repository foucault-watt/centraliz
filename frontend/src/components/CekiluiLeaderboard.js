import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import '../styles/CekiluiLeaderboard.scss';

const CekiluiLeaderboard = ({ onBack }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [promos, setPromos] = useState([]);
  const [selectedGameType, setSelectedGameType] = useState('all_promos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = useCallback(async (gameType) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/leaderboard?type=${gameType}`, {
        method: 'GET',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setLeaderboard(result.leaderboard);
      } else {
        setError(result.error || 'Erreur lors de la récupération du classement.');
      }
    } catch (err) {
      setError('Impossible de contacter le serveur pour le classement.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPromos = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/promos-stats`, {
        method: 'GET',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setPromos(result.promos);
      }
    } catch (err) {
      console.error("Impossible de charger les promos:", err);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  useEffect(() => {
    fetchLeaderboard(selectedGameType);
  }, [selectedGameType, fetchLeaderboard]);

  const handleGameTypeChange = (e) => {
    setSelectedGameType(e.target.value);
  };

  return (
    <div className="ceki-leaderboard-container animate-scale-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Classement Cékilui</h2>
        <button onClick={onBack} className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-primary">
          <ArrowLeft size={16} />
          <span>Retour</span>
        </button>
      </div>
      <div className="leaderboard-controls">
        <label htmlFor="game-type-select">Voir le classement pour :</label>
        <select id="game-type-select" value={selectedGameType} onChange={handleGameTypeChange}>
          <option value="all_promos">Toutes les promos</option>
          {promos.map(promo => (
            <option key={promo.group} value={promo.group}>{promo.group}</option>
          ))}
        </select>
      </div>

      {loading && <div className="loader">Chargement...</div>}
      {error && <div className="error-message">{error}</div>}

      {!loading && !error && (
        <div className="leaderboard-table-container">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rang</th>
                <th>Nom</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length > 0 ? (
                leaderboard.map((player, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{player.displayName}</td>
                    <td>{player.score}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3">Aucun score pour cette catégorie.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CekiluiLeaderboard;