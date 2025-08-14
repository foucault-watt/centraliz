import { useCallback, useEffect, useState } from "react";

const PromoSelector = ({ onStartGame, onCancel }) => {
  const [promos, setPromos] = useState([]);
  const [selectedPromos, setSelectedPromos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Charger les statistiques des promos au montage du composant
  useEffect(() => {
    loadPromosStats();
  }, []);

  const loadPromosStats = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/ceki/promos-stats`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (data.success) {
        setPromos(data.promos);
        // Sélectionner toutes les promos par défaut
        setSelectedPromos(data.promos.map((promo) => promo.group));
      } else {
        setError(data.error || "Erreur lors du chargement des promos");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des promos:", error);
      setError("Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromoToggle = useCallback((promoGroup) => {
    setSelectedPromos((prev) => {
      if (prev.includes(promoGroup)) {
        return prev.filter((group) => group !== promoGroup);
      } else {
        return [...prev, promoGroup];
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPromos(promos.map((promo) => promo.group));
  }, [promos]);

  const handleDeselectAll = useCallback(() => {
    setSelectedPromos([]);
  }, []);

  const handleStartGame = useCallback(() => {
    if (selectedPromos.length === 0) {
      setError("Veuillez sélectionner au moins une promo");
      return;
    }

    // Calculer le nombre total de personnes dans les promos sélectionnées
    const totalPeople = promos
      .filter((promo) => selectedPromos.includes(promo.group))
      .reduce((sum, promo) => sum + promo.count, 0);

    if (totalPeople < 4) {
      setError(
        "Il faut au moins 4 personnes avec des photos dans les promos sélectionnées"
      );
      return;
    }

    onStartGame(selectedPromos);
  }, [selectedPromos, promos, onStartGame]);

  if (isLoading) {
    return (
      <div className="promo-selector">
        <div className="promo-selector__loading">
          <p>Chargement des promos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="promo-selector">
        <div className="promo-selector__error">
          <h3>Erreur</h3>
          <p>{error}</p>
          <div className="promo-selector__actions">
            <button
              onClick={loadPromosStats}
              className="cekilui-btn cekilui-btn--primary"
            >
              Réessayer
            </button>
            <button
              onClick={onCancel}
              className="cekilui-btn cekilui-btn--cancel"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalSelectedPeople = promos
    .filter((promo) => selectedPromos.includes(promo.group))
    .reduce((sum, promo) => sum + promo.count, 0);

  return (
    <div className="promo-selector">
      <div className="promo-selector__header">
        <h3>Sélectionner les promos</h3>
        <p>Choisissez avec quelles promos vous voulez jouer</p>
      </div>

      <div className="promo-selector__controls">
        <button
          onClick={handleSelectAll}
          className="promo-selector__control-btn"
          disabled={selectedPromos.length === promos.length}
        >
          Tout sélectionner
        </button>
        <button
          onClick={handleDeselectAll}
          className="promo-selector__control-btn"
          disabled={selectedPromos.length === 0}
        >
          Tout désélectionner
        </button>
      </div>

      <div className="promo-selector__list">
        {promos.map((promo) => (
          <div
            key={promo.group}
            className={`promo-selector__item ${
              selectedPromos.includes(promo.group) ? "selected" : ""
            }`}
            onClick={() => handlePromoToggle(promo.group)}
          >
            <div className="promo-selector__checkbox">
              <input
                type="checkbox"
                checked={selectedPromos.includes(promo.group)}
                onChange={() => handlePromoToggle(promo.group)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="promo-selector__info">
              <span className="promo-selector__name">{promo.group}</span>
              <span className="promo-selector__count">
                {promo.count} personne{promo.count > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="promo-selector__summary">
        <p>
          <strong>{selectedPromos.length}</strong> promo
          {selectedPromos.length > 1 ? "s" : ""} sélectionnée
          {selectedPromos.length > 1 ? "s" : ""} ({totalSelectedPeople} personne
          {totalSelectedPeople > 1 ? "s" : ""})
        </p>
        {totalSelectedPeople < 4 && (
          <p className="promo-selector__warning">
            ⚠️ Il faut au moins 4 personnes pour jouer
          </p>
        )}
      </div>

      <div className="promo-selector__actions">
        <button
          onClick={handleStartGame}
          className="cekilui-btn cekilui-btn--primary"
          disabled={selectedPromos.length === 0 || totalSelectedPeople < 4}
        >
          Commencer le jeu
        </button>
        <button
          onClick={onCancel}
          className="cekilui-btn cekilui-btn--secondary"
        >
          Annuler
        </button>
      </div>
    </div>
  );
};

export default PromoSelector;
