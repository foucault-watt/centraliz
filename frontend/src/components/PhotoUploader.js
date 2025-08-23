import React, { useState, useRef, useCallback, useEffect } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { ArrowLeft, UploadCloud } from 'lucide-react';

const PhotoUploader = ({ onUploadSuccess, onCancel }) => {
  const [image, setImage] = useState(null);
  const [scale, setScale] = useState(1.2);
  const [rotate, setRotate] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(true); // New state for loading existing photo
  const [isEditingExisting, setIsEditingExisting] = useState(false); // Track if we're editing the existing photo
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch existing photo status on component mount
  useEffect(() => {
    const fetchPhotoStatus = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/photo-status`, {
          method: 'GET',
          credentials: 'include',
        });
        const result = await response.json();
        if (result.success && result.hasPhoto && result.photoName) {
          setExistingPhotoUrl(`${process.env.REACT_APP_URL_BACK}/api/ceki/photo/${result.photoName}`);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération du statut de la photo:", err);
        setError("Impossible de charger la photo existante.");
      } finally {
        setIsLoadingPhoto(false);
      }
    };
    fetchPhotoStatus();
  }, []);


  // Handle image change from file input or drag and drop
  const handleFileChange = useCallback((file) => {
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
      setExistingPhotoUrl(null); // Clear existing photo when new one is selected
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
    setExistingPhotoUrl(null); // Reset existing photo URL as well
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  }, [handleFileChange]);

  return (
    <div className="space-y-6 animate-scale-in">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-secondary">📷 Ajouter une photo de profil</h3>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-danger rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm">!</span>
            </div>
            <p className="text-danger font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => handleFileChange(e.target.files[0])}
        className="hidden"
      />

      {isLoadingPhoto ? (
        <div className="text-center text-secondary font-medium">Chargement de la photo...</div>
      ) : (
        <>
          {!image && !existingPhotoUrl ? (
            /* Zone de sélection de fichier / Drag & Drop */
            <div
              className={`border-2 border-dashed rounded-xl p-8 md:p-12 cursor-pointer transition-all duration-300 ${
                isDragOver
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-300 hover:border-primary bg-gray-50 hover:bg-gray-100'
              }`}
              onClick={handleSelectFile}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <UploadCloud className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg md:text-xl font-medium text-secondary">
                    {isDragOver ? 'Déposez votre photo ici' : 'Cliquez ou glissez-déposez une photo'}
                  </p>
                  <p className="text-sm md:text-base text-gray-500">
                    JPG, PNG ou WEBP - Maximum 10MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Éditeur de photo */
            <div className="space-y-6">
              {/* Canvas de l'éditeur */}
              <div className="flex justify-center">
                <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg">
                  <AvatarEditor
                    ref={editorRef}
                    image={image || existingPhotoUrl} // Use existingPhotoUrl if no new image is selected
                    width={280}
                    height={280}
                    border={15}
                    borderRadius={140}
                    color={[255, 255, 255, 0.6]}
                    scale={scale}
                    rotate={rotate}
                    backgroundColor="#f0f0f0"
                  />
                </div>
              </div>

              {/* Contrôles */}
              <div className="space-y-4">
                {/* Contrôle de zoom */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-secondary">
                    Zoom: {scale.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={scale}
                    onChange={handleScaleChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    disabled={isUploading}
                  />
                </div>

                {/* Contrôles de rotation */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-secondary">
                    Rotation:
                  </label>
                  <div className="flex space-x-3 justify-center">
                    <button
                      type="button"
                      onClick={handleRotateLeft}
                      disabled={isUploading}
                      className="w-12 h-12 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-secondary rounded-lg font-bold text-xl transition-all duration-300 active:scale-95"
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      onClick={handleRotateRight}
                      disabled={isUploading}
                      className="w-12 h-12 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-secondary rounded-lg font-bold text-xl transition-all duration-300 active:scale-95"
                    >
                      ↻
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions de l'éditeur */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isUploading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-secondary py-3 px-6 rounded-xl font-medium transition-all duration-300"
                >
                  Changer de photo
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl"
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Upload en cours...</span>
                    </div>
                  ) : (
                    'Sauvegarder'
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer avec bouton annuler */}
      <div className="pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="w-full text-gray-600 hover:text-secondary disabled:text-gray-400 py-3 transition-colors duration-300"
        >
          <ArrowLeft className="inline-block w-5 h-5 mr-2" /> Annuler
        </button>
      </div>
    </div>
  );
};

export default PhotoUploader;
