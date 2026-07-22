// backend/src/services/zimbraService.js
const axios = require("axios");
const https = require("https");
const crypto = require("crypto");
const { simpleParser } = require("mailparser"); // Importer le module mailparser
const supabase = require("../utils/supabaseClient");

class ZimbraService {
  static createServiceError(
    message,
    { statusCode = 500, code = "ENT_SERVICE_ERROR", action = null, details = null } = {}
  ) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    error.action = action;
    error.details = details;
    return error;
  }

  static buildErrorPayload(error) {
    const payload = {
      error: error.message || "Erreur serveur",
    };

    if (error.code) {
      payload.code = error.code;
    }

    if (error.action) {
      payload.action = error.action;
    }

    if (error.details) {
      payload.details = error.details;
    }

    return payload;
  }

  static buildLegacyKey(entUsername) {
    return crypto.createHash("sha256").update(entUsername).digest();
  }

  static deriveEncryptionKey({ entUsername, userKey }) {
    const serverSecret = process.env.SECRET_KEY_CENTRALIZ;

    if (!serverSecret) {
      throw this.createServiceError("Configuration de chiffrement incomplete", {
        statusCode: 500,
        code: "ENT_SERVICE_MISCONFIGURED",
      });
    }

    if (!userKey) {
      throw this.createServiceError("Cle utilisateur manquante", {
        statusCode: 428,
        code: "USER_KEY_MISSING",
        action: "retry_with_local_key",
      });
    }

    return crypto
      .createHmac("sha256", serverSecret)
      .update(`${userKey}:${String(entUsername).toLowerCase()}`)
      .digest();
  }

  static isV2EncryptedPassword(encryptedPassword) {
    return String(encryptedPassword || "").startsWith("v2:");
  }

  static getEncryptionVersion(encryptedPassword) {
    return this.isV2EncryptedPassword(encryptedPassword) ? "v2" : "v1";
  }

  /**
   * Authentifie l'utilisateur auprès de Zimbra et récupère le flux RSS.
   * @param {string} username - Nom d'utilisateur Zimbra.
   * @param {string} password - Mot de passe Zimbra.
   * @returns {Promise<string>} - Contenu XML RSS des mails.
   */
  static async authenticate(username, password) {
    const authString = Buffer.from(`${username}:${password}`).toString(
      "base64"
    );
    const url = "https://mail.centralelille.fr/home/~/inbox.json?auth=ba";

    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false, // **Attention : Désactive la vérification SSL (utiliser uniquement pour le développement)**
      });

      const response = await axios.get(url, {
        headers: {
          Authorization: `Basic ${authString}`,
        },
        httpsAgent, // Utiliser l'agent HTTPS configuré
        timeout: 10000, // Timeout de 10 secondes
      });

      if (response.status === 200) {
        return response.data; // Retourne le contenu JSON
      } else {
        console.error(
          `[ZimbraService] Échec de l'accès aux mails pour ${username}: Status ${response.status}`
        );
        throw this.createServiceError("Échec de l'accès aux mails", {
          statusCode: 502,
          code: "ENT_UPSTREAM_UNAVAILABLE",
          action: "show_temporary_outage",
        });
      }
    } catch (error) {
      if (error.response) {
        console.error(
          `[ZimbraService] Réponse d'erreur de Zimbra: Status ${error.response.status} - ${error.response.statusText}`
        );

        if (error.response.status === 401 || error.response.status === 403) {
          throw this.createServiceError("Identifiants ENT invalides", {
            statusCode: 401,
            code: "ENT_CREDENTIALS_INVALID",
            action: "prompt_ent_password",
          });
        }
      } else if (error.request) {
        console.error(
          `[ZimbraService] Aucun réponse reçue de Zimbra pour ${username}:`,
          error.message
        );
        throw this.createServiceError("Service ENT temporairement indisponible", {
          statusCode: 503,
          code: "ENT_UPSTREAM_UNAVAILABLE",
          action: "show_temporary_outage",
        });
      } else {
        console.error(
          `[ZimbraService] Erreur lors de la configuration de la requête Zimbra pour ${username}:`,
          error.message
        );
      }
      throw error.statusCode
        ? error
        : this.createServiceError("Échec de l'authentification ENT", {
            statusCode: 502,
            code: "ENT_UPSTREAM_UNAVAILABLE",
            action: "show_temporary_outage",
          });
    }
  }

  /**
   * Parse le flux RSS XML et retourne une liste d'emails.
   * @param {string} xmlData - Données XML RSS des mails.
   * @returns {Promise<Array>} - Liste des mails.
   */
  static async parseMails(jsonData) {
    const mails = jsonData.m; // Récupérer le tableau de mails
    return mails.map((mail) => ({
      id: mail.id,
      title: mail.su || "(Pas de sujet)",
      description: mail.fr || "",
      author: mail.e.find((e) => e.t === "f")?.p || "Inconnu",
      pubDate: new Date(mail.d).toISOString(),
      content: mail.fr || "",
      // Ajouter d'autres champs si nécessaire
    }));
  }

  /**
   * Récupère les mails à partir d'un token stocké dans la session.
   * @param {string} zimbraToken - Token d'authentification Zimbra encodé en base64.
   * @returns {Promise<Array>} - Liste des mails.
   */
  static async getMailsFromToken(zimbraToken) {
    const decoded = Buffer.from(zimbraToken, "base64").toString("ascii");
    const [username, password] = decoded.split(":");

    const jsonData = await this.authenticate(username, password);
    const mails = await this.parseMails(jsonData);
    return mails;
  }

  static encryptPassword({ entUsername, password, userKey }) {
    const key = this.deriveEncryptionKey({ entUsername, userKey });
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(password, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `v2:${iv.toString("hex")}:${encrypted}`;
  }

  static decryptPassword({ entUsername, encryptedPassword, userKey }) {
    try {
      const isV2 = this.isV2EncryptedPassword(encryptedPassword);
      const parts = String(encryptedPassword || "").split(":");
      const [ivHex, encrypted] = isV2 ? parts.slice(1) : parts;
      const iv = Buffer.from(ivHex, "hex");
      const key = isV2
        ? this.deriveEncryptionKey({ entUsername, userKey })
        : this.buildLegacyKey(entUsername);
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      console.error(
        "[ZimbraService] Erreur lors du déchiffrement du mot de passe:",
        error.message
      );

      if (this.isV2EncryptedPassword(encryptedPassword)) {
        throw this.createServiceError("Cle utilisateur invalide", {
          statusCode: 401,
          code: "USER_KEY_INVALID",
          action: "relogin_sso",
        });
      }

      throw this.createServiceError("Erreur lors du déchiffrement du mot de passe", {
        statusCode: 500,
        code: "STORED_PASSWORD_DECRYPTION_FAILED",
      });
    }
  }

  static async getEntUsername(username) {
    const { data, error } = await supabase
      .from("users")
      .select("ent_username")
      .eq("username", username)
      .single();

    if (error) {
      console.error(
        "[ZimbraService] Erreur lors de la récupération du ent_username:",
        error.message
      );
      return null;
    }
    return data?.ent_username;
  }

  static async linkEntUsername(username, ent_username) {
    const { error } = await supabase
      .from("users")
      .update({ ent_username: ent_username })
      .eq("username", username);

    if (error) {
      console.error(
        "[ZimbraService] Erreur lors de la liaison du ent_username:",
        error.message
      );
      throw this.createServiceError("Erreur lors de la liaison du compte ENT");
    }
  }

  static async upsertStoredPassword(entUsername, encryptedPassword) {
    const { error } = await supabase.from("passwords").upsert(
      {
        ent_username: entUsername,
        encrypted_password: encryptedPassword,
        creation_date: new Date().toISOString(),
      },
      { onConflict: "ent_username" }
    );

    if (error) {
      console.error(
        "[ZimbraService] Erreur lors de la sauvegarde du mot de passe:",
        error.message
      );
      throw this.createServiceError("Erreur lors de la sauvegarde du mot de passe");
    }
  }

  static async storeEncryptedPassword(ent_username, password, userKey) {
    const encryptedPassword = this.encryptPassword({
      entUsername: ent_username,
      password,
      userKey,
    });

    await this.upsertStoredPassword(ent_username, encryptedPassword);
  }

  static async hasStoredPassword(username) {
    const ent_username = await this.getEntUsername(username);
    if (!ent_username) return false;

    const { data, error } = await supabase
      .from("passwords")
      .select("ent_username")
      .eq("ent_username", ent_username)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return false;
      }
      console.error(
        "[ZimbraService] Erreur lors de la vérification du mot de passe stocké:",
        error.message
      );
      return false;
    }
    return !!data;
  }

  static async getStoredPassword(ent_username) {
    const { data, error } = await supabase
      .from("passwords")
      .select("encrypted_password")
      .eq("ent_username", ent_username)
      .single();

    if (error) {
      console.error(
        "[ZimbraService] Erreur lors de la récupération du mot de passe stocké:",
        error.message
      );
      throw this.createServiceError("Erreur lors de la récupération du mot de passe stocké");
    }
    if (!data) {
      throw this.createServiceError("Aucun mot de passe stocké pour cet utilisateur", {
        statusCode: 404,
        code: "STORED_PASSWORD_NOT_FOUND",
        action: "prompt_ent_password",
      });
    }
    return data.encrypted_password;
  }

  static async upgradeStoredPasswordIfLegacy({
    entUsername,
    encryptedPassword,
    password,
    userKey,
  }) {
    if (this.getEncryptionVersion(encryptedPassword) !== "v1") {
      return;
    }

    try {
      const nextEncryptedPassword = this.encryptPassword({
        entUsername,
        password,
        userKey,
      });
      await this.upsertStoredPassword(entUsername, nextEncryptedPassword);
    } catch (error) {
      throw this.createServiceError("Migration du mot de passe stocke impossible", {
        statusCode: 409,
        code: "STORED_PASSWORD_LEGACY_MIGRATION_FAILED",
        action: "prompt_ent_password",
      });
    }
  }

  static async resolveStoredCredentials(username, userKey) {
    const ent_username = await this.getEntUsername(username);
    if (!ent_username) {
      throw this.createServiceError("Aucun compte ENT lié", {
        statusCode: 404,
        code: "STORED_PASSWORD_NOT_FOUND",
        action: "prompt_ent_password",
      });
    }

    const encryptedPassword = await this.getStoredPassword(ent_username);
    const password = this.decryptPassword({
      entUsername: ent_username,
      encryptedPassword,
      userKey,
    });

    return {
      entUsername: ent_username,
      encryptedPassword,
      password,
      version: this.getEncryptionVersion(encryptedPassword),
    };
  }

  static async authenticateWithStoredPassword(username, userKey) {
    const credentials = await this.resolveStoredCredentials(username, userKey);
    const jsonData = await this.authenticate(
      credentials.entUsername,
      credentials.password
    );

    await this.upgradeStoredPasswordIfLegacy({
      entUsername: credentials.entUsername,
      encryptedPassword: credentials.encryptedPassword,
      password: credentials.password,
      userKey,
    });

    return jsonData;
  }

  static async getTokenFromUsername(username, userKey) {
    const credentials = await this.resolveStoredCredentials(username, userKey);
    return Buffer.from(
      `${credentials.entUsername}:${credentials.password}`
    ).toString("base64");
  }

  static async getRawMailContent(zimbraToken, mailId) {
    const decoded = Buffer.from(zimbraToken, "base64").toString("ascii");
    const [username, password] = decoded.split(":");
    const url = `https://mail.centralelille.fr/home/~/inbox?id=${mailId}&fmt=raw`;

    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });

      const response = await axios.get(url, {
        headers: {
          Authorization: `Basic ${zimbraToken}`,
        },
        httpsAgent,
        timeout: 10000,
        responseType: "stream", // Récupérer la réponse en tant que flux
      });

      if (response.status === 200) {
        // Parser le mail pour extraire le contenu HTML
        const parsedMail = await simpleParser(response.data);
        const htmlContent =
          parsedMail.html || parsedMail.textAsHtml || parsedMail.text;
        return htmlContent;
      } else {
        throw this.createServiceError("Échec de la récupération du contenu du mail", {
          statusCode: 502,
          code: "ENT_UPSTREAM_UNAVAILABLE",
          action: "show_temporary_outage",
        });
      }
    } catch (error) {
      console.error(
        "[ZimbraService] Erreur lors de la récupération du contenu brut:",
        error.message
      );
      throw error.statusCode
        ? error
        : this.createServiceError("Erreur lors de la récupération du mail", {
            statusCode: 502,
            code: "ENT_UPSTREAM_UNAVAILABLE",
            action: "show_temporary_outage",
          });
    }
  }
}

module.exports = ZimbraService;
