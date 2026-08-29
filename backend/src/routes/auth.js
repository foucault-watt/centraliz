const express = require("express");
const router = express.Router();
const claService = require("../services/claService");
const tokenService = require("../services/tokenService");
const loginService = require("../services/loginService");
const cookieParser = require("cookie-parser");
const supabase = require("../utils/supabaseClient");
const bdsWhitelist = require("../config/bdsWhitelist");
const analyticsService = require("../services/analyticsService");
const ZimbraService = require("../services/zimbraService");
const { createUserSecretSalt } = require("../utils/userSecret");

const getUserAssociations = async (username) => {
  const { data, error } = await supabase
    .from("user_associations")
    .select("association_slug, association_name, role")
    .eq("username", username)
    .order("association_name", { ascending: true });

  if (error) {
    console.error(
      "[Auth Status] Impossible de récupérer les associations:",
      error,
    );
    return [];
  }

  return (data || []).map((entry) => ({
    association_slug: entry.association_slug,
    association_name: entry.association_name,
    role: entry.role,
  }));
};

// Middleware pour parser les cookies, nécessaire pour lire le cookie remember_me
router.use(cookieParser());
router.get("/status", async (req, res) => {
  let userFromSession = req.session.user;
  let fullUser = null;

  if (userFromSession) {
    // Si une session existe, on tente de récupérer les infos complètes de l'utilisateur depuis la BDD
    const { data, error } = await loginService.getUser(
      userFromSession.userName,
    );
    if (error || !data) {
      console.error(
        "[Auth Status] Erreur: impossible de récupérer l'utilisateur complet pour la session existante",
        error,
      );
      // Si on ne peut pas récupérer l'utilisateur, on invalide la session
      req.session.destroy();
      res.clearCookie("remember_me");
      return res.json({ authenticated: false, user: null });
    }
    fullUser = data;
  } else {
    // Si pas de session, on vérifie le cookie remember_me
    const rememberMeToken = req.cookies.remember_me;
    if (!rememberMeToken) {
      return res.json({ authenticated: false, user: null });
    }

    const validatedUser = await tokenService.validateToken(rememberMeToken);
    if (!validatedUser) {
      res.clearCookie("remember_me");
      return res.json({ authenticated: false, user: null });
    }

    // Le token est valide, on récupère les infos complètes de l'utilisateur
    const { data, error } = await loginService.getUser(validatedUser.username);
    if (error || !data) {
      console.error(
        "[Auth Status] Erreur: impossible de récupérer l'utilisateur complet pour la session remember_me",
        error,
      );
      res.clearCookie("remember_me");
      return res.json({ authenticated: false, user: null });
    }
    fullUser = data;
  }

  if (fullUser) {
    const [associationRoles, hasMailPassword, setupStepFlags] = await Promise.all([
      getUserAssociations(fullUser.username),
      ZimbraService.hasStoredPassword(fullUser.username),
      analyticsService.getUserStepEventFlags(fullUser.username),
    ]);

    // Check for BDS referral cookie
    const bdsReferral = req.cookies.bds_referral;
    if (bdsReferral && bdsWhitelist.includes(bdsReferral)) {
      await supabase
        .from("users")
        .update({ support_bds: bdsReferral })
        .eq("username", fullUser.username);

      res.clearCookie("bds_referral");
      // Optionally update fullUser object if we were using it for response,
      // but currently we construct session user manually below.
    }

    // Créer/Mettre à jour la session avec les données complètes et correctes
    req.session.user = {
      userName: fullUser.username,
      displayName: fullUser.display_name,
      icalLink: fullUser.ical_link,
      group: fullUser.group,
      is_admin: fullUser.is_admin,
      is_bibli_admin: fullUser.is_bibli_admin,
      ent_username: fullUser.ent_username,
      support_bds: fullUser.support_bds,
      theme_color: fullUser.theme_color,
      theme_color_dark: fullUser.theme_color_dark,
      has_association_role: Boolean(fullUser.has_association_role),
      association_roles: associationRoles,
      userSecretSalt: createUserSecretSalt(fullUser.username),
      has_mail_password: hasMailPassword,
      has_cekilui_photo: Boolean(fullUser.hasPhoto),
      has_read_mail: setupStepFlags.hasReadMail,
      has_used_links: setupStepFlags.hasUsedLinks,
      has_viewed_calendar_event: setupStepFlags.hasViewedCalendarEvent,
      has_played_ceki_round: setupStepFlags.hasPlayedCekiRound,
    };
    return res.json({ authenticated: true, user: req.session.user });
  }

  res.clearCookie("remember_me");
  return res.json({ authenticated: false, user: null });
});

router.get("/login", (req, res, next) => {
  req.session.rememberMe = req.query.remember === "true";
  claService.login(req, res, next); // <- CHANGEMENT ICI
});

router.get("/endpoint", claService.callback); // <- CHANGEMENT ICI

router.post("/logout", async (req, res) => {
  analyticsService.trackEvent({
    req,
    eventName: "user_logged_out",
    module: "auth",
    eventType: "system",
    source: "backend",
  });

  const rememberMeToken = req.cookies.remember_me;
  if (rememberMeToken) {
    await tokenService.deleteToken(rememberMeToken);
  }
  res.clearCookie("remember_me");
  req.session.destroy();
  res.status(200).send("Logged out");
});

module.exports = router;
