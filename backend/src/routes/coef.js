const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const fs = require("fs");
const path = require("path");
const supabase = require("../utils/supabaseClient");

router.get("/", authMiddleware, async (req, res) => {
  try {
    // Charger les données utilisateur depuis Supabase
    const { data: user, error } = await supabase
      .from("users")
      .select("group")
      .ilike("username", req.session.user.userName)
      .single();

    if (error || !user || !user.group) {
      return res
        .status(404)
        .json({ error: "Utilisateur ou groupe non trouvé" });
    }

    const userGroup = user.group.toUpperCase();

    // Charger les coefficients
    const coefsPath = path.join(__dirname, "../data/coef.json");
    const coefs = JSON.parse(fs.readFileSync(coefsPath, "utf-8"));

    if (!coefs.groups[userGroup]) {
      return res
        .status(404)
        .json({ error: "Coefficients non trouvés pour ce groupe" });
    }

    // Filtrer pour ne renvoyer que le groupe de l'utilisateur
    const userCoefs = {
      groups: {
        [userGroup]: coefs.groups[userGroup],
      },
    };

    res.json(userCoefs);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
