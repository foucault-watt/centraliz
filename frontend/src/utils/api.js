/**
 * Un "wrapper" autour de l'API fetch standard pour centraliser la logique d'appel.
 * - Ajoute automatiquement l'URL du backend.
 * - Ajoute les credentials pour l'authentification.
 * - Ajoute l'en-tête pour contourner l'avertissement ngrok en développement.
 *
 * @param {string} endpoint - Le chemin de l'API à appeler (ex: '/api/auth/status').
 * @param {object} [options={}] - Les options fetch standard (method, headers, body, etc.).
 * @returns {Promise<Response>} La promesse retournée par fetch.
 */
export const fetchApi = (endpoint, options = {}) => {
  const apiUrl = process.env.REACT_APP_URL_BACK;

  // Fusionne les headers par défaut avec ceux fournis en option
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Pour contourner l'avertissement ngrok
    ...options.headers,
  };

  // Fusionne les options par défaut avec celles fournies
  const config = {
    ...options,
    headers,
    credentials: 'include', // Important pour envoyer/recevoir les cookies
  };

  return fetch(`${apiUrl}${endpoint}`, config);
};