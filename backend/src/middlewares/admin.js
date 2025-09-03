const supabase = require('../utils/supabaseClient');

/**
 * Middleware pour vérifier si l'utilisateur est un administrateur en consultant la base de données.
 */
const adminMiddleware = async (req, res, next) => {
  try {
    // Vérifier si un utilisateur est connecté
    if (!req.session || !req.session.user || !req.session.user.userName) {
      return res.status(401).json({
        success: false,
        error: "Authentification requise.",
      });
    }

    const { userName } = req.session.user;

    // Interroger la base de données pour vérifier le statut admin
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('username', userName)
      .single();

    if (error) {
      console.error("Erreur lors de la vérification du statut admin:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la vérification des autorisations.",
      });
    }

    // Si l'utilisateur est bien un admin, continuer
    if (data && data.is_admin) {
      return next();
    }

    // Sinon, refuser l'accès
    return res.status(403).json({
      success: false,
      error: "Accès non autorisé. Seuls les administrateurs peuvent accéder à cette ressource.",
    });

  } catch (error) {
    console.error("Erreur inattendue dans le middleware admin:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur serveur interne.",
    });
  }
};

module.exports = adminMiddleware;