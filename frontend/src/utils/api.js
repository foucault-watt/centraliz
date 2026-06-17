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
export const USER_SECRET_SALT_STORAGE_KEY = "centraliz.userSecretSalt";

const ENT_ENDPOINT_PREFIXES = [
  "/api/zimbra",
  "/api/grades",
  "/api/download-csv",
  "/api/csv-data",
];

export const getStoredUserSecretSalt = () =>
  window.localStorage.getItem(USER_SECRET_SALT_STORAGE_KEY) || "";

export const storeUserSecretSalt = (userSecretSalt) => {
  if (!userSecretSalt) {
    window.localStorage.removeItem(USER_SECRET_SALT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(USER_SECRET_SALT_STORAGE_KEY, userSecretSalt);
};

export const clearStoredUserSecretSalt = () => {
  window.localStorage.removeItem(USER_SECRET_SALT_STORAGE_KEY);
};

const shouldAttachUserKey = (endpoint) =>
  ENT_ENDPOINT_PREFIXES.some((prefix) => endpoint.startsWith(prefix));

export const fetchApi = (endpoint, options = {}) => {
  const apiUrl = process.env.REACT_APP_URL_BACK;
  const userSecretSalt = shouldAttachUserKey(endpoint)
    ? getStoredUserSecretSalt()
    : "";

  // Fusionne les headers par défaut avec ceux fournis en option
  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true", // Pour contourner l'avertissement ngrok
    ...options.headers,
  };

  if (userSecretSalt && !headers["X-User-Key"]) {
    headers["X-User-Key"] = userSecretSalt;
  }

  // Fusionne les options par défaut avec celles fournies
  const config = {
    ...options,
    headers,
    credentials: "include", // Important pour envoyer/recevoir les cookies
  };

  return fetch(`${apiUrl}${endpoint}`, config);
};
