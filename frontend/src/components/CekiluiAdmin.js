import { useEffect, useState } from 'react';
import { Shield, Trash2, UserX, CheckCircle, ArrowLeft } from 'lucide-react';

const CekiluiAdmin = ({ onBack }) => {
  const [reportedPhotos, setReportedPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [banDurations, setBanDurations] = useState({});

  useEffect(() => {
    fetchReportedPhotos();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const fetchReportedPhotos = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/admin/reported-photos`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setReportedPhotos(data.reportedPhotos);
      } else {
        setError(data.error || 'Erreur lors de la récupération des signalements.');
      }
    } catch (err) {
      setError('Erreur de connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (action, photoName, username = null, banDuration = null) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_BACK}/api/ceki/admin/resolve-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, photoName, username, banDuration }),
      });
      const data = await response.json();
      if (data.success) {
        setFeedback(`Action '${action}' effectuée avec succès pour ${photoName}.`);
        fetchReportedPhotos(); // Refresh the list
      } else {
        setFeedback(data.error || `Erreur lors de l'action '${action}'.`);
      }
    } catch (err) {
      setFeedback('Erreur de connexion.');
    }
  };

  const handleBanDurationChange = (photoName, duration) => {
    const newDurations = { ...banDurations };
    newDurations[photoName] = duration;
    setBanDurations(newDurations);
  };
  
  if (isLoading) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-secondary font-medium">Chargement des signalements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-danger">
        <p>{error}</p>
        <button onClick={onBack} className="mt-4 text-primary underline">Retour</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-scale-in">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-secondary flex items-center">
                <Shield className="mr-3 text-primary" />
                Modération Cékilui
            </h2>
            <button onClick={onBack} className="flex items-center text-secondary hover:text-primary transition-colors">
                <ArrowLeft size={20} className="mr-1" />
                Retour
            </button>
        </div>

      {feedback && (
        <div className="bg-success/10 border border-success/20 text-success p-3 rounded-lg">{feedback}</div>
      )}

      {reportedPhotos.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <CheckCircle className="mx-auto text-success" size={48} />
          <p className="mt-4 text-lg font-semibold text-secondary">Aucune photo signalée</p>
          <p className="text-gray-500">Tout est en ordre pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reportedPhotos.map((item) => (
            <div key={item.photoName} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Colonne Image */}
                    <div className="flex flex-col items-center">
                        <img
                            src={`${process.env.REACT_APP_URL_BACK}/api/ceki/photo/${item.photoName}`}
                            alt={`Photo signalée ${item.photoName}`}
                            className="w-40 h-40 object-cover rounded-lg border"
                            crossOrigin="use-credentials"
                        />
                        <span className="text-xs text-gray-500 mt-2 break-all">{item.photoName}</span>
                    </div>

                    {/* Colonne Détails */}
                    <div className="md:col-span-2 space-y-3">
                        <h3 className="font-bold text-lg text-danger">{item.reportCount} signalement{item.reportCount > 1 ? 's' : ''}</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {item.reports.map((report, index) => (
                            <div key={index} className="bg-gray-50 p-2 rounded">
                                <p className="font-semibold text-secondary">{report.reason}</p>
                                <p className="text-sm text-gray-600">{report.details}</p>
                                <p className="text-xs text-gray-500 text-right">par {report.reportedBy}</p>
                            </div>
                        ))}
                        </div>
                    </div>
                </div>

                 {/* Actions de modération */}
                 <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4 justify-end">
                    <button onClick={() => handleResolve('delete_photo', item.photoName)} className="flex items-center bg-danger/10 text-danger hover:bg-danger/20 px-3 py-2 rounded-md text-sm font-semibold transition-colors"><Trash2 size={14} className="mr-1" /> Supprimer photo</button>
                    
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="1"
                            placeholder="Jours"
                            value={banDurations[item.photoName] || ''}
                            onChange={(e) => handleBanDurationChange(item.photoName, e.target.value)}
                            className="w-20 p-2 border border-gray-300 rounded-md text-sm"
                        />
                        <button
                            onClick={() => handleResolve('ban_user', item.photoName, null, banDurations[item.photoName])}
                            disabled={!banDurations[item.photoName] || banDurations[item.photoName] < 1}
                            className="flex items-center bg-warning/10 text-warning hover:bg-warning/20 px-3 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <UserX size={14} className="mr-1" /> Bannir
                        </button>
                    </div>

                    <button onClick={() => handleResolve('dismiss', item.photoName)} className="flex items-center bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-semibold transition-colors"><CheckCircle size={14} className="mr-1" /> Ignorer</button>
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CekiluiAdmin;