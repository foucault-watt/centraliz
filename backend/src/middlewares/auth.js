// backend/src/middlewares/auth.js
module.exports = (req, res, next) => {
  // Helpful debug logs and optional dev bypass
  const sessionUser = req.session && req.session.user;
  if (!sessionUser) {
    console.warn(`[Auth Middleware] Accès non autorisé depuis IP: ${req.ip}`);
    // debug-info
    try {
      console.debug(
        `Auth Debug: sessionID=${req.sessionID || "none"} cookie=${
          req.headers.cookie || "none"
        }`
      );
    } catch (err) {
      // ignore debug errors
    }

    // Dev bypass (ENABLE by set DEV_AUTH_BYPASS=true in .env) - ONLY for local development
    const devBypass = process.env.DEV_AUTH_BYPASS === "true";
    const devIp =
      req.ip === "127.0.0.1" ||
      req.ip === "::1" ||
      req.ip === "::ffff:127.0.0.1";
    if (devBypass && devIp) {
      console.warn(
        "[Auth Middleware] DEV_AUTH_BYPASS active: autorisation de la requête pour le développement local"
      );
      // Attach a minimal session user so downstream handlers work
      req.session = req.session || {};
      req.session.user = req.session.user || {
        userName: process.env.DEV_USER || "dev",
      };
      return next();
    }

    return res.status(401).json({ error: "Non authentifié" });
  }
  // Session utilisateur existe, autoriser la route
  next();
};
