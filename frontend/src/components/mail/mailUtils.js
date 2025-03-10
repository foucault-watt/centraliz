import DOMPurify from "dompurify";

/**
 * Sanitize un contenu HTML de mail pour éviter les injections XSS
 * @param {string} rawContent - Contenu HTML brut du mail
 * @return {string} - Contenu HTML nettoyé
 */
export const sanitizeMailContent = (rawContent) => {
  if (!rawContent) return "";

  // Extraire le contenu entre les balises de fragment
  const match = rawContent.match(
    /<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i
  );
  const fragment = match ? match[1] : rawContent;

  // Nettoyer le HTML avec DOMPurify
  return DOMPurify.sanitize(fragment, {
    FORBID_TAGS: ["style", "script"],
    FORBID_ATTR: ["style", "onerror", "onload"],
    ALLOW_DATA_ATTR: false,
  });
};

/**
 * Formate une date pour l'affichage
 * @param {string} dateString - La date à formater
 * @return {string} - Date formatée
 */
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Génère l'URL pour accéder au mail sur Zimbra
 * @param {string} mailId - Identifiant du mail
 * @returns {string} - URL de Zimbra
 */
export const getZimbraUrl = (mailId) => {
  return `https://mail.centralelille.fr/modern/email/Inbox/conversation/-${mailId}`;
};

/**
 * Tronque un texte à une certaine longueur
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} - Texte tronqué
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};
