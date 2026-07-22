import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

const PromoSelector = ({ onStartGame, onCancel, gameMode }) => {
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

  if (isLoading) {
    return (
      <div className="text-center space-y-6 animate-scale-in py-12">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-secondary font-medium text-lg">Chargement des promos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center space-y-6 animate-scale-in">
        {/* Icône d'erreur */}
        <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">⚠️</span>
        </div>
        
        {/* Message d'erreur */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-danger">Erreur</h3>
          <p className="text-gray-600 leading-relaxed">{error}</p>
        </div>
        
        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={loadPromosStats}
            className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95"
          >
            Réessayer
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-gray-100 hover:bg-gray-200 text-secondary py-3 px-6 rounded-xl font-medium transition-all duration-300 border border-gray-200"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  const totalSelectedPeople = promos
    .filter((promo) => selectedPromos.includes(promo.group))
    .reduce((sum, promo) => sum + promo.count, 0);

  const isCompetitiveModeValid =
    selectedPromos.length === 1 ||
    (promos.length > 0 && selectedPromos.length === promos.length);

  const minPeopleRequired = gameMode === "competitive" ? 10 : 4;

  return (
    <div className="space-y-6 animate-scale-in">
      {/* Header */}
      <div className="text-center space-y-3">
        <h3 className="text-2xl font-bold text-secondary">
          {gameMode === "competitive" ? "🏆 Mode Compétitif" : "♾️ Mode Sans Fin"}
        </h3>
        <p className="text-gray-600 leading-relaxed">
          {gameMode === "competitive"
            ? "Jouez sur une seule promo ou sur toutes les promos pour enregistrer votre score."
            : "Choisissez les promos avec lesquelles vous voulez vous entraîner."}
        </p>
      </div>

      {/* Contrôles de sélection */}
      <div className="flex space-x-3">
        <button
          onClick={handleSelectAll}
          disabled={selectedPromos.length === promos.length}
          className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-secondary py-2 px-4 rounded-lg font-medium transition-all duration-300"
        >
          Tout sélectionner
        </button>
        <button
          onClick={handleDeselectAll}
          disabled={selectedPromos.length === 0}
          className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-secondary py-2 px-4 rounded-lg font-medium transition-all duration-300"
        >
          Tout désélectionner
        </button>
      </div>

      {/* Liste des promos */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {promos.map((promo) => (
          <div
            key={promo.group}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
              selectedPromos.includes(promo.group)
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
            onClick={() => handlePromoToggle(promo.group)}
          >
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={selectedPromos.includes(promo.group)}
                onChange={() => handlePromoToggle(promo.group)}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
              />
              <div className="flex-1">
                <span className="font-medium text-secondary">{promo.group}</span>
                <span className="text-gray-600 text-sm ml-2">
                  {promo.count} personne{promo.count > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Résumé */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <p className="text-center text-secondary font-medium">
          <strong>{selectedPromos.length}</strong> promo
          {selectedPromos.length > 1 ? "s" : ""} sélectionnée
          {selectedPromos.length > 1 ? "s" : ""} ({totalSelectedPeople} personne
          {totalSelectedPeople > 1 ? "s" : ""})
        </p>
        {totalSelectedPeople < minPeopleRequired && (
          <div className="flex items-center justify-center space-x-2 text-game-warning">
            <span>⚠️</span>
            <span className="text-sm font-medium">Il faut au moins {minPeopleRequired} personnes pour jouer</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-4">
        {gameMode === "competitive" ? (
          <>
            <button
              onClick={() => onStartGame(selectedPromos)}
              disabled={!isCompetitiveModeValid || totalSelectedPeople < minPeopleRequired}
              className="w-full bg-primary hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl"
            >
              Lancer le défi ({selectedPromos.length} promo
              {selectedPromos.length > 1 ? "s" : ""})
            </button>
            {!isCompetitiveModeValid && (
              <div className="bg-game-warning/10 border border-game-warning/20 rounded-xl p-4">
                <p className="text-game-warning text-sm text-center">
                  Pour le mode compétitif, vous devez sélectionner soit{" "}
                  <strong>une seule</strong> promo, soit <strong>toutes</strong>{" "}
                  les promos.
                </p>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => onStartGame(selectedPromos)}
            disabled={selectedPromos.length === 0 || totalSelectedPeople < minPeopleRequired}
            className="w-full bg-primary hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl"
          >
            Jouer en mode sans fin
          </button>
        )}
        
        <button
          onClick={onCancel}
          className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-secondary py-3 px-6 rounded-xl font-medium transition-all duration-300 border border-gray-200"
        >
          <ArrowLeft size={16} />
          <span>Retour</span>
        </button>
      </div>
    </div>
  );
};

export default PromoSelector;
