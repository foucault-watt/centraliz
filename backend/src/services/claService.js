// backend/src/services/claService.js
const axios = require("axios");
const supabase = require("../utils/supabaseClient");
const tokenService = require("./tokenService");
const loginService = require("./loginService");
const bdsWhitelist = require("../config/bdsWhitelist");
const analyticsService = require("./analyticsService");

// Remplacez par vos variables d'environnement
const claAuthHost = process.env.CLA_AUTH_HOST;
const claAuthIdentifier = process.env.CLA_AUTH_IDENTIFIER;

const normalizeAssociationRoles = (associationRoles) => {
  if (!Array.isArray(associationRoles)) {
    return [];
  }

  return associationRoles
    .filter(
      (entry) =>
        entry && entry.associationSlug && entry.associationName && entry.role,
    )
    .map((entry) => ({
      association_slug: String(entry.associationSlug),
      association_name: String(entry.associationName),
      role: String(entry.role),
    }));
};

const syncUserAssociations = async (
  username,
  hasAssociationRole,
  associationRoles,
) => {
  const normalizedRoles = normalizeAssociationRoles(associationRoles);
  const finalHasAssociationRole =
    Boolean(hasAssociationRole) || normalizedRoles.length > 0;

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({ has_association_role: finalHasAssociationRole })
    .eq("username", username);

  if (userUpdateError) {
    throw userUpdateError;
  }

  const { error: deleteError } = await supabase
    .from("user_associations")
    .delete()
    .eq("username", username);

  if (deleteError) {
    throw deleteError;
  }

  if (normalizedRoles.length > 0) {
    const rows = normalizedRoles.map((item) => ({
      username,
      association_slug: item.association_slug,
      association_name: item.association_name,
      role: item.role,
      synced_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("user_associations")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  return {
    has_association_role: finalHasAssociationRole,
    association_roles: normalizedRoles,
  };
};

exports.login = (req, res) => {
  const url = `${claAuthHost}/authentification/${claAuthIdentifier}`;
  res.redirect(url);
};

exports.callback = async (req, res) => {
  const { ticket } = req.query;
  if (!ticket) {
    return res.status(400).send("Erreur : ticket CLA manquant.");
  }

  try {
    // 1. Valider le ticket auprès de la plateforme CLA
    const validationUrl = `${claAuthHost}/authentification/${claAuthIdentifier}/${encodeURIComponent(
      ticket,
    )}`;
    const { data: response } = await axios.get(validationUrl);

    if (!response || !response.success) {
      console.error(
        "[CLA Service] La réponse du serveur d'authentification est invalide",
        response,
      );
      return res.status(401).send("Échec de l'authentification CLA.");
    }

    console.log(
      "[CLA Service] Réponse du serveur d'authentification CLA:",
      response,
    );
    const {
      username: cla_username,
      firstName,
      lastName,
      emailSchool,
      cursus,
      hasAssociationRole = false,
      associationRoles = [],
    } = response.payload;

    console.log("[CLA Service] Rôles d'association reçus:", associationRoles);

    // Traiter le groupe/cursus : enlever le P à la fin si présent
    let group = cursus;
    if (group && group.endsWith("P")) {
      group = group.slice(0, -1);
    }

    // 2. Chercher si un mapping existe pour cet utilisateur
    const { data: mapping, error: mappingError } = await supabase
      .from("user_mapping")
      .select("cas_username")
      .eq("cla_username", cla_username)
      .single();

    let final_username;

    if (mapping) {
      // L'utilisateur est déjà mappé, on utilise son ancien username (cas_username)
      final_username = mapping.cas_username;

      // On en profite pour mettre à jour son profil dans la table 'users'
      await supabase
        .from("users")
        .update({
          first_name: firstName,
          last_name: lastName,
          group: group,
          email_school: emailSchool,
        })
        .eq("username", final_username);
    } else {
      // Nouvel utilisateur ou utilisateur pas encore mappé.
      // On suppose que le cla_username peut être utilisé directement,
      // mais idéalement il faudrait le mapper à un ancien compte si possible.
      // Pour l'instant, on crée un nouvel utilisateur avec le cla_username.

      // ATTENTION : Cette partie crée un NOUVEL utilisateur.
      // Le script de migration manuel est là pour éviter ce cas.
      final_username = cla_username;

      const { data: newUser, error: newUserError } = await supabase
        .from("users")
        .upsert(
          {
            username: final_username,
            display_name: `${firstName} ${lastName}`,
            first_name: firstName,
            last_name: lastName,
            group: group,
            email_school: emailSchool,
          },
          { onConflict: "username" },
        );

      if (newUserError) throw newUserError;
    }

    const associationData = await syncUserAssociations(
      final_username,
      hasAssociationRole,
      associationRoles,
    );

    // 3. Récupérer l'utilisateur complet et créer la session
    const { data: user, error: fetchError } =
      await loginService.getUser(final_username);
    if (fetchError || !user) {
      throw new Error(
        "Impossible de récupérer l'utilisateur après l'authentification CLA.",
      );
    }

    // Gérer le parrainage BDS (Referral)
    const bdsReferral = req.cookies.bds_referral;
    if (bdsReferral && bdsWhitelist.includes(bdsReferral)) {
      await supabase
        .from("users")
        .update({ support_bds: bdsReferral })
        .eq("username", user.username);

      res.clearCookie("bds_referral");
      // Mettre à jour l'objet user en mémoire pour la session
      user.support_bds = bdsReferral;
    }

    req.session.user = {
      userName: user.username,
      displayName: user.display_name,
      icalLink: user.ical_link,
      is_admin: user.is_admin,
      is_bibli_admin: user.is_bibli_admin,
      ent_username: user.ent_username,
      support_bds: user.support_bds,
      has_association_role: associationData.has_association_role,
      association_roles: associationData.association_roles,
    };

    // Gérer le "Remember Me"
    if (req.session.rememberMe) {
      const token = await tokenService.generateToken(user.username);
      if (token) {
        res.cookie("remember_me", token, {
          httpOnly: true,
          secure: process.env.SECURE === "true",
          sameSite: process.env.COOKIE_SAMESITE || "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }
    }

    await loginService.addLogin(user.username);
    analyticsService.trackEvent({
      req,
      userUsername: user.username,
      eventName: "user_logged_in",
      module: "auth",
      eventType: "system",
      source: "backend",
      properties: {
        remember_me: Boolean(req.session.rememberMe),
        has_association_role: Boolean(associationData.has_association_role),
      },
    });
    res.redirect(process.env.URL_FRONT);
  } catch (error) {
    console.error("[CLA Service] Erreur lors du callback:", error);
    res.status(500).send("Erreur interne lors de l'authentification.");
  }
};
