import { useCallback, useEffect, useState } from "react";

// Hook personnalisé pour les requêtes fetch avec gestion d'erreur
export const useApiFetch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fonction générique pour les appels API
  const fetchData = useCallback(async (url, options = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          ...options.headers,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Une erreur est survenue");
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchData, loading, error, setError };
};

// Hook avec mécanisme de réessai pour les requêtes critiques
export const useApiWithRetry = () => {
  const { fetchData, loading, error, setError } = useApiFetch();
  const [retrying, setRetrying] = useState(false);

  const fetchWithRetry = useCallback(
    async (url, options = {}, maxRetries = 3) => {
      let retryCount = 0;
      let lastError = null;

      while (retryCount < maxRetries) {
        try {
          return await fetchData(url, options);
        } catch (err) {
          lastError = err;
          retryCount++;

          if (retryCount < maxRetries) {
            console.log(
              `Tentative ${retryCount}/${maxRetries} échouée, nouvel essai dans 1s...`
            );
            setRetrying(true);
            // Attendre 1 seconde avant de réessayer
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      setRetrying(false);
      setError(`Échec après ${maxRetries} tentatives: ${lastError?.message}`);
      throw lastError;
    },
    [fetchData, setError]
  );

  return { fetchWithRetry, loading, error, retrying, setError };
};

// Hook pour gérer les comptes à rebours
export const useCountdown = (initialTime, onComplete) => {
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    if (!initialTime) return;

    setTime(initialTime);
    const interval = setInterval(() => {
      setTime((prevTime) => {
        if (prevTime <= 1000) {
          clearInterval(interval);
          onComplete?.();
          return null;
        }
        return prevTime - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [initialTime, onComplete]);

  return time;
};

// Fonction pour formater le temps
export const formatTime = (milliseconds) => {
  if (!milliseconds) return "--:--";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

// Hook pour gérer la sélection des points de canard
export const usePointSelection = (initialValue = 1) => {
  const [points, setPoints] = useState(initialValue);

  const isValidPoint = useCallback((value) => {
    return value >= 1 && value <= 3;
  }, []);

  const setPointValue = useCallback(
    (value) => {
      if (isValidPoint(value)) {
        setPoints(value);
        return true;
      }
      return false;
    },
    [isValidPoint]
  );

  return { points, setPointValue };
};
