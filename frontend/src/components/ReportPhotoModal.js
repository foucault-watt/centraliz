import { useState } from "react";
import { X } from "lucide-react";

const ReportPhotoModal = ({ isOpen, onClose, onSubmit }) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError("Veuillez sélectionner une raison.");
      return;
    }
    if (reason === 'other' && !details) {
        setError("Veuillez fournir des précisions.");
        return;
    }
    
    setError("");
    setIsSubmitting(true);
    await onSubmit({ reason, details });
    // Le parent gère la fermeture et le feedback
    setIsSubmitting(false);
  };

  const handleClose = () => {
    // Réinitialiser l'état à la fermeture
    setReason("");
    setDetails("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md animate-scale-in relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fermer"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold text-secondary mb-4">Signaler la photo</h2>
        <p className="text-gray-600 mb-6">
          Votre signalement aide à maintenir la qualité du jeu. Il sera examiné par un administrateur.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-secondary font-semibold">Raison du signalement</label>
            <div className="mt-2 space-y-2">
              {[
                { value: 'not_the_person', label: 'Ne représente pas la bonne personne' },
                { value: 'inappropriate', label: 'Contenu inapproprié (sexuel, violent...)' },
                { value: 'low_quality', label: 'Photo de mauvaise qualité / illisible' },
                { value: 'other', label: 'Autre (précisez ci-dessous)' },
              ].map((option) => (
                <label key={option.value} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span className="ml-3 text-secondary">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {reason === 'other' && (
            <div className="animate-fade-in">
              <label htmlFor="details" className="text-secondary font-semibold">
                Précisions
              </label>
              <textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Veuillez fournir plus de détails..."
                className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary transition"
                rows="3"
                required
              />
            </div>
          )}
          
          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="bg-gray-100 hover:bg-gray-200 text-secondary py-2 px-5 rounded-xl font-medium transition-all duration-300"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="bg-primary hover:bg-primary-dark text-white py-2 px-5 rounded-xl font-medium transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50"
              disabled={!reason || isSubmitting}
            >
              {isSubmitting ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportPhotoModal;