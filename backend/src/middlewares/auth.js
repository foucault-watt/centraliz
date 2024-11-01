// backend/src/middlewares/auth.js
module.exports = (req, res, next) => {
  if (!req.session.user) {
    console.warn(`[Auth Middleware] Accès non autorisé depuis IP: ${req.ip}`);
    return res.status(401).json({ error: 'Non authentifié' });
  }
  console.log(`[Auth Middleware] Requête authentifiée pour l'utilisateur: ${req.session.user.userName}`);
  next();
};