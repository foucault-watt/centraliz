import React, { useState, useRef, useCallback } from 'react';
import AvatarEditor from 'react-avatar-editor';

const PhotoUploader = ({ onUploadSuccess, onCancel }) => {
  const [image, setImage] = useState(null);
  const [scale, setScale] = useState(1.2);
  const [rotate, setRotate] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      // Vérifier le type de fichier
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Type de fichier non autorisé. Seuls JPG, PNG et WEBP sont acceptés.');
        return;
      }

      // Vérifier la taille du fichier (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Le fichier est trop volumineux (maximum 10MB).');
        return;
      }

      setError('');
      setImage(file);
    }
  }, []);

  const handleScaleChange = useCallback((e) => {
    setScale(parseFloat(e.target.value));
  }, []);

  const handleRotateLeft = useCallback(() => {
    setRotate(prev => prev - 90);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotate(prev => prev + 90);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!editorRef.current || !image) return;

    setIsUploading(true);
    setError('');

    try {
      // Obtenir l'image éditée sous forme de canvas
      const canvas = editorRef.current.getImage();
      
      // Convertir le canvas en blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.9);
      });

      // Créer un FormData pour l'upload
      const formData = new FormData();
      formData.append('photo', blob, 'profile-photo.jpg');

      // Envoyer la requête d'upload
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/upload-photo`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        onUploadSuccess && onUploadSuccess(result);
      } else {
        setError(result.error || 'Erreur lors de l\'upload');
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      setError('Erreur lors de l\'upload de la photo');
    } finally {
      setIsUploading(false);
    }
  }, [image, onUploadSuccess]);

  const handleSelectFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReset = useCallback(() => {
    setImage(null);
    setScale(1.2);
    setRotate(0);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="photo-uploader">
      <div className="photo-uploader__header">
        <h3>Ajouter une photo de profil</h3>
      </div>

      {error && (
        <div className="photo-uploader__error">
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleImageChange}
        style={{ display: 'none' }}
      />

      {!image ? (
        <div className="photo-uploader__select">
          <div className="photo-uploader__select-area" onClick={handleSelectFile}>
            <div className="photo-uploader__select-icon">📷</div>
            <p>Cliquez pour sélectionner une photo</p>
            <p className="photo-uploader__select-hint">
              JPG, PNG ou WEBP - Maximum 10MB
            </p>
          </div>
        </div>
      ) : (
        <div className="photo-uploader__editor">
          <div className="photo-uploader__canvas">
            <AvatarEditor
              ref={editorRef}
              image={image}
              width={300}
              height={300}
              border={20}
              borderRadius={150}
              color={[255, 255, 255, 0.6]}
              scale={scale}
              rotate={rotate}
              backgroundColor="#f0f0f0"
            />
          </div>

          <div className="photo-uploader__controls">
            <div className="photo-uploader__control-group">
              <label>Zoom:</label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={scale}
                onChange={handleScaleChange}
                className="photo-uploader__slider"
              />
            </div>

            <div className="photo-uploader__control-group">
              <label>Rotation:</label>
              <div className="photo-uploader__rotation-buttons">
                <button
                  type="button"
                  onClick={handleRotateLeft}
                  className="photo-uploader__rotate-btn"
                  disabled={isUploading}
                >
                  ↺
                </button>
                <button
                  type="button"
                  onClick={handleRotateRight}
                  className="photo-uploader__rotate-btn"
                  disabled={isUploading}
                >
                  ↻
                </button>
              </div>
            </div>
          </div>

          <div className="photo-uploader__actions">
            <button
              type="button"
              onClick={handleReset}
              className="photo-uploader__btn photo-uploader__btn--secondary"
              disabled={isUploading}
            >
              Changer de photo
            </button>
            <button
              type="button"
              onClick={handleUpload}
              className="photo-uploader__btn photo-uploader__btn--primary"
              disabled={isUploading}
            >
              {isUploading ? 'Upload en cours...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      <div className="photo-uploader__footer">
        <button
          type="button"
          onClick={onCancel}
          className="photo-uploader__btn photo-uploader__btn--cancel"
          disabled={isUploading}
        >
          Annuler
        </button>
      </div>
    </div>
  );
};

export default PhotoUploader;