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
