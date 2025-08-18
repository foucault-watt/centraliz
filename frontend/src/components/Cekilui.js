import { useEffect, useState } from "react";
import "../styles/Cekilui.scss";
import CekiluiGame from "./CekiluiGame";
import PhotoUploader from "./PhotoUploader";

function Cekilui() {
  const [photoStatus, setPhotoStatus] = useState({
    hasPhoto: false,
    photoName: null,
    loading: true,
  });
  const [showUploader, setShowUploader] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [message, setMessage] = useState("");

  // Vérifier le statut de la photo au chargement du composant
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
    setMessage("");
  };

  if (photoStatus.loading) {
    return (
      <div className="div-bibli">
        <div className="container">
          <div className="cekilui-loading">
            <p>Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="div-cekilui">
      {message && (
        <div className="cekilui-message cekilui-message--success">
          {message}
        </div>
      )}

      <div className="cekilui-content">
        {showGame ? (
          <CekiluiGame onBackToMenu={handleBackToMenu} />
        ) : showUploader ? (
          <PhotoUploader
            onUploadSuccess={handleUploadSuccess}
            onCancel={handleCancelUpload}
          />
        ) : (
          <div className="cekilui-status">
            {photoStatus.hasPhoto ? (
              <div className="cekilui-has-photo">
                <div className="cekilui-status-icon">✅</div>
                <h3>Vous avez une photo de profil</h3>
                <p>Vous pouvez maintenant jouer au jeu Cékilui !</p>
                <div className="cekilui-actions">
                  <button
                    onClick={handleStartGame}
                    className="cekilui-btn cekilui-btn--primary"
                  >
                    🎯 Jouer à Cékilui
                  </button>
                  <button
                    onClick={handleReplacePhoto}
                    className="cekilui-btn cekilui-btn--secondary"
                  >
                    Changer ma photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="cekilui-no-photo">
                <div className="cekilui-status-icon">📷</div>
                <h3>Aucune photo de profil</h3>
                <p>
                  Vous devez ajouter une photo pour pouvoir jouer au jeu
                  Cékilui.
                </p>
                <button
                  onClick={handleShowUploader}
                  className="cekilui-btn cekilui-btn--primary"
                >
                  Ajouter une photo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Cekilui;
