const axios = require("axios");

const MGBA_HTTP_BASE_URL =
  process.env.MGBA_HTTP_BASE_URL || "http://localhost:5000";
const REQUEST_TIMEOUT_MS = 3000;

const createClient = () =>
  axios.create({
    baseURL: MGBA_HTTP_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      Accept: "application/json, text/plain, */*",
    },
  });

const normalizeError = (error, fallbackMessage) => {
  const normalized = new Error(fallbackMessage);
  normalized.status = error.response?.status || 503;
  normalized.details =
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.message ||
    fallbackMessage;
  return normalized;
};

async function getHealth() {
  try {
    const client = createClient();
    const response = await client.get("/");

    return {
      ok: true,
      baseUrl: MGBA_HTTP_BASE_URL,
      statusCode: response.status,
    };
  } catch (error) {
    throw normalizeError(
      error,
      "Impossible de joindre mGBA-http. Vérifiez que le service est démarré dans WSL."
    );
  }
}

async function sendButton(button) {
  try {
    const client = createClient();
    const response = await client.post("/mgba-http/button/tap", null, {
      params: { button },
    });

    return {
      ok: true,
      button,
      statusCode: response.status,
      data: response.data,
    };
  } catch (error) {
    throw normalizeError(
      error,
      `Impossible d'envoyer le bouton ${button} à mGBA-http.`
    );
  }
}

async function requestScreenshot(outputPath) {
  try {
    const client = createClient();
    const response = await client.post("/core/screenshot", null, {
      params: { path: outputPath },
    });

    return {
      ok: true,
      outputPath,
      statusCode: response.status,
      data: response.data,
    };
  } catch (error) {
    throw normalizeError(
      error,
      "Impossible de déclencher une capture d'écran depuis mGBA-http."
    );
  }
}

module.exports = {
  MGBA_HTTP_BASE_URL,
  getHealth,
  requestScreenshot,
  sendButton,
};
