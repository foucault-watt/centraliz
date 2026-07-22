const authMiddleware = require('./auth');

// Ce middleware combine l'authentification et la vérification des droits d'administrateur de la bibliothèque.
const bibliAdminMiddleware = (req, res, next) => {
  // 1. D'abord, on s'assure que l'utilisateur est bien authentifié
  authMiddleware(req, res, () => {
    // 2. Ensuite, on vérifie si l'utilisateur a les droits d'admin pour la bibliothèque
    if (req.session.user && req.session.user.is_bibli_admin === true) {
      // L'utilisateur est authentifié et est un admin de la bibliothèque, on peut continuer.
      next();
    } else {
      // L'utilisateur n'a pas les droits nécessaires.
      res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    }
  });
};

module.exports = bibliAdminMiddleware;