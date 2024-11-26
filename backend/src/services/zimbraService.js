// backend/src/services/zimbraService.js
const axios = require("axios");
const xml2js = require("xml2js");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class ZimbraService {
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
    const url = "https://mail.centralelille.fr/home/~/inbox.rss?auth=ba";

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
        return response.data; // Retourne le contenu RSS
      } else {
        console.error(
          `[ZimbraService] Échec de l'accès aux mails pour ${username}: Status ${response.status}`
        );
        throw new Error("Échec de l'accès aux mails");
      }
    } catch (error) {
      if (error.response) {
        console.error(
          `[ZimbraService] Réponse d'erreur de Zimbra: Status ${error.response.status} - ${error.response.statusText}`
        );
      } else if (error.request) {
        console.error(
          `[ZimbraService] Aucun réponse reçue de Zimbra pour ${username}:`,
          error.message
        );
      } else {
        console.error(
          `[ZimbraService] Erreur lors de la configuration de la requête Zimbra pour ${username}:`,
          error.message
        );
      }
      throw error;
    }
  }

  /**
   * Parse le flux RSS XML et retourne une liste d'emails.
   * @param {string} xmlData - Données XML RSS des mails.
   * @returns {Promise<Array>} - Liste des mails.
   */
  static async parseRSS(xmlData) {
    try {
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(xmlData);
      const items = result.rss.channel[0].item;

      console.log(`[ZimbraService] Nombre d'emails récupérés: ${items.length}`);

      return items.map((item) => ({
        title: item.title[0],
        description: item.description[0],
        author: item.author[0],
        pubDate: item.pubDate[0],
      }));
    } catch (error) {
      console.error(
        "[ZimbraService] Erreur lors du parsing du RSS:",
        error.message
      );
      throw new Error("Erreur lors du parsing du RSS");
    }
  }

  /**
   * Récupère les mails à partir d'un token stocké dans la session.
   * @param {string} zimbraToken - Token d'authentification Zimbra encodé en base64.
   * @returns {Promise<Array>} - Liste des mails.
   */
  static async getMailsFromToken(zimbraToken) {
    const decoded = Buffer.from(zimbraToken, "base64").toString("ascii");
    const [username, password] = decoded.split(":");

    const xmlData = await this.authenticate(username, password);
    const mails = await this.parseRSS(xmlData);
    return mails;
  }

  static generateKey(email) {
    return crypto.createHash('sha256').update(email).digest();
  }

  static encryptPassword(email, password) {
    const key = this.generateKey(email);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  static decryptPassword(email, encryptedPassword) {
    try {
      const key = this.generateKey(email);
      const [ivHex, encrypted] = encryptedPassword.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error("[ZimbraService] Erreur lors du déchiffrement du mot de passe:", error.message);
      throw new Error("Erreur lors du déchiffrement du mot de passe");
    }
  }

  static async storeEncryptedPassword(username, password) {
    const email = username;
    const encryptedPassword = this.encryptPassword(email, password);
    const filePath = path.join(__dirname, '../data/mdp.json');

    let data = {};
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        data = JSON.parse(fileContent);
      }
    } catch (error) {
      console.error("[ZimbraService] Erreur lors de la lecture du fichier mdp.json:", error.message);
      data = {};
    }

    data[email] = encryptedPassword;

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error("[ZimbraService] Erreur lors de l'écriture dans le fichier mdp.json:", error.message);
      throw new Error("Erreur lors de la sauvegarde du mot de passe");
    }
  }

  static async hasStoredPassword(username) {
    const email = username;
    const filePath = path.join(__dirname, '../data/mdp.json');
    if (!fs.existsSync(filePath)) {
      return false;
    }
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data.hasOwnProperty(email);
    } catch (error) {
      console.error("[ZimbraService] Erreur lors de la vérification du mot de passe stocké:", error.message);
      return false;
    }
  }

  static getStoredPassword(email) {
    const filePath = path.join(__dirname, '../data/mdp.json');
    if (!fs.existsSync(filePath)) {
      throw new Error("Fichier mdp.json introuvable");
    }
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!data.hasOwnProperty(email)) {
        throw new Error("Aucun mot de passe stocké pour cet utilisateur");
      }
      return data[email];
    } catch (error) {
      console.error("[ZimbraService] Erreur lors de la récupération du mot de passe stocké:", error.message);
      throw new Error("Erreur lors de la récupération du mot de passe stocké");
    }
  }

  static async authenticateWithStoredPassword(username) {
    const email = username;
    const encryptedPassword = this.getStoredPassword(email);
    const password = this.decryptPassword(email, encryptedPassword);
    return await this.authenticate(username, password);
  }

  static getTokenFromUsername(username) {
    const email = username;
    const encryptedPassword = this.getStoredPassword(email);
    const password = this.decryptPassword(email, encryptedPassword);
    return Buffer.from(`${username}:${password}`).toString("base64");
  }
}

module.exports = ZimbraService;