const admin = require("../data/admin");

const adminCheck = (req, res, next) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  if (!admin.includes(req.session.user.userName)) {
    return res.status(403).json({ error: "Accès refusé" });
  }

  next();
};

module.exports = adminCheck;
