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
  const userKey =
    typeof req.userKey === "string" && req.userKey.trim()
      ? req.userKey.trim()
      : "";

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
        password = ZimbraService.decryptPassword({
          entUsername: ent_username,
          encryptedPassword,
          userKey,
        });
      } catch (err) {
        // No stored password
        const payload = ZimbraService.buildErrorPayload(
          err.statusCode
            ? err
            : ZimbraService.createServiceError(
                "Mot de passe ENT non fourni et aucun mot de passe stocké",
                {
                  statusCode: 404,
                  code: "STORED_PASSWORD_NOT_FOUND",
                  action: "prompt_ent_password",
                }
              )
        );
        return res.status(err.statusCode || 404).json({
          success: false,
          ...payload,
        });
      }
    }

    if (rememberMe && !userKey) {
      const error = ZimbraService.createServiceError(
        "Cle utilisateur manquante",
        {
          statusCode: 428,
          code: "USER_KEY_MISSING",
          action: "retry_with_local_key",
        }
      );
      return res.status(error.statusCode).json({
        success: false,
        ...ZimbraService.buildErrorPayload(error),
      });
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
        await ZimbraService.storeEncryptedPassword(ent_username, password, userKey);
      } catch (storeErr) {
        console.warn("Failed to store encrypted password:", storeErr.message);
      }
    }

    res.json({ success: true, filePath: csvPath });
  } catch (error) {
    const payload = ZimbraService.buildErrorPayload(
      error.statusCode
        ? error
        : ZimbraService.createServiceError(error.message || "Erreur serveur")
    );
    res.status(error.statusCode || 500).json({ success: false, ...payload });
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
