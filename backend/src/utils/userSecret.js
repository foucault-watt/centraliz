const crypto = require("crypto");

const createUserSecretSalt = (username) => {
  const serverSecret = process.env.SECRET_KEY_CENTRALIZ;

  if (!serverSecret) {
    throw new Error("SECRET_KEY_CENTRALIZ manquante");
  }

  if (!username) {
    throw new Error("username manquant pour generer le userSecretSalt");
  }

  return crypto
    .createHmac("sha256", serverSecret)
    .update(String(username))
    .digest("hex");
};

module.exports = {
  createUserSecretSalt,
};
