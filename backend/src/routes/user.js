const express = require("express");
const router = express.Router();
const supabase = require("../utils/supabaseClient");
const authMiddleware = require("../middlewares/auth");
const setupStatusService = require("../services/setupStatusService");

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * POST /api/user/theme-color
 * Sauvegarde la couleur d'accent personnelle de l'utilisateur connecté.
 * Champ entièrement séparé de support_bds (voir bds.js) : ne touche ni la
 * colonne, ni la route, ni le cookie de parrainage BDS.
 */
router.post("/theme-color", authMiddleware, async (req, res) => {
  try {
    const { themeColor, themeColorDark } = req.body;

    if (!themeColor || !HEX_COLOR_REGEX.test(themeColor)) {
      return res.status(400).json({ success: false, error: "Couleur invalide" });
    }
    if (themeColorDark && !HEX_COLOR_REGEX.test(themeColorDark)) {
      return res.status(400).json({ success: false, error: "Couleur foncée invalide" });
    }

    const { userName } = req.session.user;
    const { error } = await supabase
      .from("users")
      .update({
        theme_color: themeColor,
        theme_color_dark: themeColorDark || null,
      })
      .eq("username", userName);

    if (error) {
      console.error("[User] Erreur lors de la sauvegarde de theme_color:", error);
      return res
        .status(500)
        .json({ success: false, error: "Erreur lors de l'enregistrement" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[User] Exception theme-color:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

/**
 * GET /api/user/setup-stats
 * Pourcentage d'utilisateurs ayant entièrement terminé leur configuration
 * (mot de passe mail, emploi du temps, mails lus, liens utilisés, détail
 * d'événement calendrier vu, partie jouée au jeu des photos, photo ajoutée).
 * La couleur personnelle n'est pas comptée comme une étape.
 */
router.get("/setup-stats", authMiddleware, async (req, res) => {
  try {
    const percentage = await setupStatusService.getSetupCompletionPercentage();
    res.json({ success: true, percentage });
  } catch (error) {
    console.error("[User] Erreur lors du calcul des stats de configuration:", error);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

module.exports = router;
