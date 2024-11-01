// backend/src/services/zimbraService.js
const axios = require("axios");
const xml2js = require("xml2js");
const https = require("https");

class ZimbraService {
  /**
   * Authentifie l'utilisateur auprès de Zimbra et récupère le flux RSS.
   * @param {string} username - Nom d'utilisateur Zimbra.
   * @param {string} password - Mot de passe Zimbra.
   * @returns {Promise<string>} - Contenu XML RSS des mails.
   */
  static async authenticate(username, password) {
    const authString = Buffer.from(`${username}:${password}`).toString("base64");
    const url = "https://mail.centralelille.fr/home/~/inbox.rss?auth=ba";

    console.log(`[ZimbraService] Tentative d'authentification pour l'utilisateur: ${username}`);

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

      console.log(`[ZimbraService] Réponse de Zimbra: Status ${response.status}`);

      if (response.status === 200) {
        console.log(`[ZimbraService] Authentification réussie pour ${username}`);
        return response.data; // Retourne le contenu RSS
      } else {
        console.error(`[ZimbraService] Échec de l'accès aux mails pour ${username}: Status ${response.status}`);
        throw new Error("Échec de l'accès aux mails");
      }
    } catch (error) {
      if (error.response) {
        console.error(`[ZimbraService] Réponse d'erreur de Zimbra: Status ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        console.error(`[ZimbraService] Aucun réponse reçue de Zimbra pour ${username}:`, error.message);
      } else {
        console.error(`[ZimbraService] Erreur lors de la configuration de la requête Zimbra pour ${username}:`, error.message);
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
    console.log("[ZimbraService] Début du parsing du RSS");

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
      console.error("[ZimbraService] Erreur lors du parsing du RSS:", error.message);
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

    console.log(`[ZimbraService] Authentification depuis token pour l'utilisateur: ${username}`);

    const xmlData = await this.authenticate(username, password);
    const mails = await this.parseRSS(xmlData);
    return mails;
  }
}

module.exports = ZimbraService;