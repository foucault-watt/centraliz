const readUserKey = (req) => {
  const rawValue = req.headers["x-user-key"];

  if (Array.isArray(rawValue)) {
    return rawValue[0]?.trim() || "";
  }

  return typeof rawValue === "string" ? rawValue.trim() : "";
};

const buildUserKeyMissingError = () => ({
  statusCode: 428,
  payload: {
    error: "Cle utilisateur manquante",
    code: "USER_KEY_MISSING",
    action: "retry_with_local_key",
  },
});

const requireUserKey = (req, res, next) => {
  const userKey = readUserKey(req);

  if (!userKey) {
    const error = buildUserKeyMissingError();
    return res.status(error.statusCode).json(error.payload);
  }

  req.userKey = userKey;
  return next();
};

const attachUserKey = (req, res, next) => {
  const userKey = readUserKey(req);
  if (userKey) {
    req.userKey = userKey;
  }
  return next();
};

module.exports = {
  attachUserKey,
  buildUserKeyMissingError,
  readUserKey,
  requireUserKey,
};
