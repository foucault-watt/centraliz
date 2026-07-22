// backend/src/services/casService.js
const axios = require("axios");
const loginService = require('./loginService');
const supabase = require('../utils/supabaseClient');
const tokenService = require('./tokenService');

const casBaseURL = "https://cas.centralelille.fr";
const serviceURL = `${process.env.URL_BACK}/api/auth/callback`;

exports.login = (req, res) => {
  const loginUrl = `${casBaseURL}/login?service=${encodeURIComponent(serviceURL)}`;
  res.redirect(loginUrl);
};

exports.callback = async (req, res) => {
  const { ticket } = req.query;

  if (!ticket) {
    console.warn("[CAS Service] Ticket CAS manquant dans la requête");
    return res.status(400).send("Erreur : ticket CAS manquant.");
  }

  try {
    const validateUrl = `${casBaseURL}/p3/serviceValidate?service=${encodeURIComponent(serviceURL)}&ticket=${ticket}`;
    const response = await axios.get(validateUrl);

    // Amélioration de l'extraction des données XML
    const xmlData = response.data;
    const userName = xmlData.match(/<cas:user>(.*?)<\/cas:user>/)?.[1];
    
    // Nouvelle méthode pour extraire displayName depuis les attributs
    const displayName = xmlData.match(/<cas:displayName>(.*?)<\/cas:displayName>/)?.[1];

    if (!userName) {
      console.error("[CAS Service] Nom d'utilisateur non trouvé dans la réponse CAS");
      return res.status(401).send("Échec de l'authentification CAS.");
    }

    // Sauvegarde ou mise à jour des informations utilisateur dans Supabase
    const { data, error } = await supabase
      .from('users')
      .upsert({
        username: userName,
        display_name: displayName || null
      }, { onConflict: 'username' });

    if (error) {
      console.error("[CAS Service] Erreur lors de la mise à jour de l'utilisateur:", error);
    } else {
      console.log("[CAS Service] Utilisateur mis à jour:", data);
    }

    // Récupérer l'enregistrement utilisateur complet depuis Supabase
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*') // On sélectionne tout !
      .eq('username', userName)
      .single();

    if (fetchError || !user) {
      console.error("[CAS Service] Erreur lors de la récupération de l'utilisateur complet:", fetchError);
      return res.status(500).send("Erreur lors de la récupération des informations utilisateur.");
    }

    // Créer la session avec les données complètes de la BDD
    req.session.user = {
      userName: user.username, // Rétablir l'ancien format pour la compatibilité
      displayName: user.display_name,
      icalLink: user.ical_link,
      group: user.group,
      is_admin: user.is_admin,
      is_bibli_admin: user.is_bibli_admin // Le champ crucial !
    };

    if (req.session.rememberMe) {
      const token = await tokenService.generateToken(userName);
      if (token) {
        res.cookie('remember_me', token, {
          httpOnly: true,
          secure: process.env.SECURE === 'true',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }
    }

    loginService.addLogin(userName);
    res.redirect(process.env.URL_FRONT);

  } catch (error) {
    console.error("[CAS Service] Erreur complète:", error);
    console.error("[CAS Service] Réponse CAS:", error.response?.data);
    res.status(500).send("Erreur lors de la validation CAS.");
  }
};
