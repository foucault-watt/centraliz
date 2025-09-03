import { useEffect, useState } from "react";
import CekiluiGame from "./CekiluiGame";
import PhotoUploader from "./PhotoUploader";
import CekiluiAdmin from "./CekiluiAdmin";
import CekiluiLeaderboard from "./CekiluiLeaderboard";
import { Shield, Trophy } from "lucide-react";

function Cekilui() {
  const [photoStatus, setPhotoStatus] = useState({
    hasPhoto: false,
    photoName: null,
    loading: true,
  });
  const [showUploader, setShowUploader] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false); // État pour l'interface admin
  const [isAdmin, setIsAdmin] = useState(false); // TODO: Récupérer dynamiquement
  const [message, setMessage] = useState("");

  // Vérifier le statut de la photo et le statut admin au chargement
  useEffect(() => {
    checkPhotoStatus();
  }, []);

  const checkPhotoStatus = async () => {
    try {
      setPhotoStatus((prev) => ({ ...prev, loading: true }));

      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/ceki/photo-status`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const result = await response.json();

      if (result.success) {
        setPhotoStatus({
          hasPhoto: result.hasPhoto,
          photoName: result.photoName,
          loading: false,
        });
        setIsAdmin(result.isAdmin || false); // Définir le statut admin depuis l'API
      } else {
        console.error(
          "Erreur lors de la vérification du statut:",
          result.error
        );
        setPhotoStatus({
          hasPhoto: false,
          photoName: null,
          loading: false,
        });
      }
    } catch (error) {
      console.error(
        "Erreur lors de la vérification du statut de la photo:",
        error
      );
      setPhotoStatus({
        hasPhoto: false,
        photoName: null,
        loading: false,
      });
    }
  };

  const handleUploadSuccess = (result) => {
    setMessage("Photo uploadée avec succès !");
    setShowUploader(false);
    setPhotoStatus({
      hasPhoto: true,
      photoName: result.photoName,
      loading: false,
    });

    // Effacer le message après 3 secondes
    setTimeout(() => setMessage(""), 3000);
  };

  const handleShowUploader = () => {
    setShowUploader(true);
    setMessage("");
  };

  const handleCancelUpload = () => {
    setShowUploader(false);
    setMessage("");
  };

  const handleReplacePhoto = () => {
    setShowUploader(true);
    setShowGame(false);
    setMessage("");
  };

  const handleStartGame = () => {
    setShowGame(true);
    setShowUploader(false);
    setMessage("");
  };

  const handleBackToMenu = () => {
    setShowGame(false);
    setShowUploader(false);
    setShowLeaderboard(false);
    setMessage("");
  };

  const handleShowAdmin = () => {
   setShowAdmin(true);
   setShowGame(false);
   setShowUploader(false);
   setMessage("");
 };

 const handleBackToMenuFromAdmin = () => {
   setShowAdmin(false);
 };

 const handleShowLeaderboard = () => {
   setShowLeaderboard(true);
   setShowGame(false);
   setShowUploader(false);
   setMessage("");
 };

 if (photoStatus.loading) {
   return (
     <div className="max-w-md mx-auto">
        <div className="bg-background-module rounded-game shadow-game-default p-6 animate-scale-in">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-secondary font-medium">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Message de feedback */}
      {message && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-4 animate-scale-in">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-success font-medium">{message}</p>
          </div>
        </div>
      )}

      <div className="bg-background-module rounded-game shadow-game-default p-6 animate-scale-in">
        {showAdmin ? (
         <CekiluiAdmin onBack={handleBackToMenuFromAdmin} />
        ) : showLeaderboard ? (
          <CekiluiLeaderboard onBack={handleBackToMenu} />
        ) : showGame ? (
          <CekiluiGame onBackToMenu={handleBackToMenu} onShowLeaderboard={handleShowLeaderboard} />
        ) : showUploader ? (
          <PhotoUploader
            onUploadSuccess={handleUploadSuccess}
            onCancel={handleCancelUpload}
          />
        ) : (
          <div className="text-center space-y-6">
            {photoStatus.hasPhoto ? (
              <>
                {/* État avec photo */}
                <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl">✅</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-secondary">
                    Vous avez une photo de profil
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Vous pouvez maintenant jouer au jeu Cékilui !
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={handleStartGame}
                    className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl"
                  >
                    🎯 Jouer à Cékilui
                  </button>
                  <button
                    onClick={handleReplacePhoto}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-secondary py-3 px-6 rounded-xl font-medium transition-all duration-300 border border-gray-200"
                  >
                    Changer ma photo
                  </button>
                  <button
                    onClick={handleShowLeaderboard}
                    className="w-full flex items-center justify-center space-x-2 bg-secondary hover:bg-secondary-dark text-white py-3 px-6 rounded-xl font-medium transition-all duration-300"
                  >
                    <Trophy size={20} />
                    <span>Classement</span>
                  </button>
                  {isAdmin && (
                   <button
                     onClick={handleShowAdmin}
                     className="w-full flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white py-3 px-6 rounded-xl font-medium transition-all duration-300"
                   >
                     <Shield size={20} />
                     <span>Modération</span>
                   </button>
                 )}
                </div>
              </>
            ) : (
              <>
                {/* État sans photo */}
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl">📷</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-secondary">
                    Aucune photo de profil
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Vous devez ajouter une photo pour pouvoir jouer au jeu
                    Cékilui.
                  </p>
                </div>
                <button
                  onClick={handleShowUploader}
                  className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl"
                >
                  Ajouter une photo
                </button>
                {isAdmin && (
                 <button
                   onClick={handleShowAdmin}
                   className="w-full flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white py-3 px-6 rounded-xl font-medium transition-all duration-300"
                 >
                   <Shield size={20} />
                   <span>Modération</span>
                 </button>
               )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Cekilui;
