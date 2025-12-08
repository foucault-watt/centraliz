const fs = require("fs");
const path = require("path");
const puppeteer = require("../utils/puppeteer");
const ZimbraService = require("./zimbraService");
const supabase = require("../utils/supabaseClient");

exports.downloadCSV = async (req, res) => {
  if (!req.session || !req.session.user) {
    console.warn("[CSVService] Tentative d'accès sans session utilisateur");
    return res.status(401).json({ success: false, error: "Non authentifié" });
  }
  const username = req.session.user.userName;
  let { ent_username, password, rememberMe } = req.body || {};

  try {
    // If ent_username not provided, try to get linked ent_username
    if (!ent_username) {
      ent_username = await ZimbraService.getEntUsername(username);
    }

    // If password is not provided, try to use stored password associated with ent_username
    if (!password) {
      if (!ent_username) {
        return res.status(400).json({
          success: false,
          error: "ent_username et mot de passe requis",
        });
      }
      try {
        const encryptedPassword = await ZimbraService.getStoredPassword(
          ent_username
        );
        password = ZimbraService.decryptPassword(
          ent_username,
          encryptedPassword
        );
      } catch (err) {
        // No stored password
        return res.status(400).json({
          success: false,
          error: "Mot de passe ENT non fourni et aucun mot de passe stocké",
        });
      }
    }
    // Use ENT username for puppeteer login (Aurion)
    const csvPath = await puppeteer.downloadCSV(ent_username, password);

    // Incrémenter le compteur de téléchargements pour cet utilisateur dans Supabase
    const { data, error } = await supabase
      .from("users")
      .select("notes_count")
      .eq("username", username)
      .single();

    if (error) {
      console.error("Error fetching user notes count:", error);
    } else {
      const newCount = (data?.notes_count || 0) + 1;
      const { error: updateError } = await supabase
        .from("users")
        .update({ notes_count: newCount })
        .eq("username", username);

      if (updateError) {
        console.error("Error updating user notes count:", updateError);
      } else {
        console.log(
          `Compteur de téléchargement incrémenté pour ${username}: ${newCount}`
        );
      }
    }

    // Link ent_username with the Supabase user account
    if (ent_username) {
      try {
        await ZimbraService.linkEntUsername(username, ent_username);
      } catch (linkErr) {
        console.warn("Failed to link ent_username to user:", linkErr.message);
      }
    }

    // If rememberMe is true, save the encrypted password for this ent_username
    if (rememberMe && ent_username) {
      try {
        await ZimbraService.storeEncryptedPassword(ent_username, password);
      } catch (storeErr) {
        console.warn("Failed to store encrypted password:", storeErr.message);
      }
    }

    res.json({ success: true, filePath: csvPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCSVData = (req, res) => {
  const csvPath = req.query.path;

  if (!csvPath) {
    return res.status(400).json({ error: "Chemin du CSV non fourni" });
  }

  fs.readFile(csvPath, "utf8", (err, data) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Erreur lors de la lecture du fichier CSV" });
    }
    res.send(data);
  });
};
