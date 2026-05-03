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
    noPhotoCompetitiveGamesPlayed: 0,
    remainingFreeCompetitiveGames: 0,
    canPlayCompetitiveWithoutPhoto: false,
    loading: true,
  });
  const [showUploader, setShowUploader] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false); // État pour l'interface admin
  const [isAdmin, setIsAdmin] = useState(false); // TODO: Récupérer dynamiquement
  const [message, setMessage] = useState("");
  const [launchQuickCompetitive, setLaunchQuickCompetitive] = useState(false);

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
        const nextPhotoStatus = {
          hasPhoto: result.hasPhoto,
          photoName: result.photoName,
          noPhotoCompetitiveGamesPlayed:
            result.noPhotoCompetitiveGamesPlayed || 0,
          remainingFreeCompetitiveGames:
            result.remainingFreeCompetitiveGames || 0,
          canPlayCompetitiveWithoutPhoto:
            result.canPlayCompetitiveWithoutPhoto || false,
          loading: false,
        };
        setPhotoStatus(nextPhotoStatus);
        setIsAdmin(result.isAdmin || false); // Définir le statut admin depuis l'API

      } else {
        console.error(
          "Erreur lors de la vérification du statut:",
          result.error
        );
        setPhotoStatus({
          hasPhoto: false,
          photoName: null,
          noPhotoCompetitiveGamesPlayed: 0,
          remainingFreeCompetitiveGames: 0,
          canPlayCompetitiveWithoutPhoto: false,
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
        noPhotoCompetitiveGamesPlayed: 0,
        remainingFreeCompetitiveGames: 0,
        canPlayCompetitiveWithoutPhoto: false,
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
      noPhotoCompetitiveGamesPlayed: photoStatus.noPhotoCompetitiveGamesPlayed,
      remainingFreeCompetitiveGames: photoStatus.remainingFreeCompetitiveGames,
      canPlayCompetitiveWithoutPhoto:
        photoStatus.canPlayCompetitiveWithoutPhoto,
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
    setShowLeaderboard(false);
    setLaunchQuickCompetitive(false);
    setMessage("");
  };

  const handleQuickStartGame = () => {
    setShowGame(true);
    setShowUploader(false);
    setShowLeaderboard(false);
    setLaunchQuickCompetitive(true);
    setMessage("");
  };

  const handleRequirePhoto = () => {
    setShowGame(false);
    setShowUploader(true);
    setLaunchQuickCompetitive(false);
    setMessage("Ajoute une photo pour continuer à jouer à Cékilui.");
    checkPhotoStatus();
  };

  const handleBackToMenu = () => {
    setShowGame(false);
    setShowUploader(false);
    setShowLeaderboard(false);
    setLaunchQuickCompetitive(false);
    setMessage("");
  };

  const handleShowAdmin = () => {
   setShowAdmin(true);
   setShowGame(false);
   setShowUploader(false);
   setLaunchQuickCompetitive(false);
   setMessage("");
 };

 const handleBackToMenuFromAdmin = () => {
   setShowAdmin(false);
 };

 const handleShowLeaderboard = () => {
   setShowLeaderboard(true);
   setShowGame(false);
   setShowUploader(false);
   setLaunchQuickCompetitive(false);
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
    <div className="max-w-md md:max-w-3xl mx-auto transition-all duration-300">
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
          <CekiluiGame
            onBackToMenu={handleBackToMenu}
            onShowLeaderboard={handleShowLeaderboard}
            onRequirePhoto={handleRequirePhoto}
            hasPhoto={photoStatus.hasPhoto}
            remainingFreeCompetitiveGames={
              photoStatus.remainingFreeCompetitiveGames
            }
            quickStartTrial={
              !photoStatus.hasPhoto &&
              photoStatus.remainingFreeCompetitiveGames > 0
            }
            quickStartCompetitive={launchQuickCompetitive}
          />
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
                <div className="pt-3 mt-2 border-t border-gray-200">
                  <button
                    onClick={handleQuickStartGame}
                    className="w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary text-white py-4 px-6 rounded-2xl font-semibold transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl"
                  >
                    <div className="flex items-center justify-center space-x-3">
                      <span className="text-xl">⚡</span>
                      <span>Lancer une partie rapide</span>
                    </div>
                    <p className="text-sm opacity-90 mt-2">
                      Mode compétitif • 1 clic pour jouer
                    </p>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* État sans photo */}
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                    photoStatus.remainingFreeCompetitiveGames > 0
                      ? "bg-primary/10"
                      : "bg-gray-100"
                  }`}
                >
                  <span className="text-3xl">
                    {photoStatus.remainingFreeCompetitiveGames > 0 ? "🎯" : "📷"}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-secondary">
                    {photoStatus.remainingFreeCompetitiveGames > 0
                      ? "Essai gratuit disponible"
                      : "Aucune photo de profil"}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {photoStatus.remainingFreeCompetitiveGames > 0
                      ? `Vous pouvez tester Cékilui sur 2 parties compétitives toutes promos avant d'ajouter votre photo. Il vous reste ${photoStatus.remainingFreeCompetitiveGames} partie${
                          photoStatus.remainingFreeCompetitiveGames > 1
                            ? "s"
                            : ""
                        }.`
                      : "Vous avez utilisé vos 2 parties d'essai. Ajoutez une photo pour continuer à jouer à Cékilui."}
                  </p>
                </div>
                <div className="space-y-3">
                  {photoStatus.remainingFreeCompetitiveGames > 0 && (
                    <button
                      onClick={handleStartGame}
                      className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl"
                    >
                      Jouer tout de suite
                    </button>
                  )}
                  <button
                    onClick={handleShowUploader}
                    className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 border ${
                      photoStatus.remainingFreeCompetitiveGames > 0
                        ? "bg-gray-100 hover:bg-gray-200 text-secondary border-gray-200"
                        : "bg-primary hover:bg-primary-dark text-white border-primary shadow-lg hover:shadow-xl"
                    }`}
                  >
                    Ajouter une photo
                  </button>
                </div>
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
