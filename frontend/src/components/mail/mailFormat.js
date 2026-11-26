import DOMPurify from "dompurify";

export const zimbraUrl = (mailId) =>
  `https://mail.centralelille.fr/modern/email/Inbox/conversation/-${mailId}`;

// Garde le fragment utile (copier-coller Outlook) et retire scripts/styles.
export const sanitizeMailContent = (rawContent) => {
  if (!rawContent) return "";
  const match = rawContent.match(
    /<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i,
  );
  const fragment = match ? match[1] : rawContent;
  return DOMPurify.sanitize(fragment, {
    FORBID_TAGS: ["style", "script"],
    FORBID_ATTR: ["style", "onerror", "onload"],
    ALLOW_DATA_ATTR: false,
  });
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const daysAgo = (date, now) =>
  Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

// "14:32", "Hier", "lun.", "12 nov."
export const formatShortDate = (dateString, now = new Date()) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const diff = daysAgo(date, now);
  if (diff === 0) {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diff === 1) return "Hier";
  if (diff > 1 && diff < 7) {
    return date.toLocaleDateString("fr-FR", { weekday: "short" });
  }
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

export const formatLongDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Groupes de la liste : Aujourd'hui, Hier, Cette semaine, puis par mois.
export const groupLabel = (dateString, now = new Date()) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Plus ancien";
  const diff = daysAgo(date, now);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff < 7) return "Cette semaine";
  const label = date.toLocaleDateString("fr-FR", {
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Nom lisible depuis "Prénom Nom <adresse@...>" ou "adresse@...".
export const displayName = (author) => {
  const text = String(author || "").trim();
  const named = text.replace(/\s*<[^>]*>\s*$/, "").replace(/^"|"$/g, "").trim();
  if (named && !/^\S+@\S+$/.test(named)) return named;
  const address = text.replace(/[<>]/g, "");
  return address.split("@")[0] || "Inconnu";
};

export const initials = (author) => {
  const words = displayName(author)
    .replace(/[^\p{L}\p{N}\s.-]/gu, "")
    .split(/[\s.-]+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const second = words.length > 1 ? words[words.length - 1][0] : words[0][1];
  return `${first}${second || ""}`.toUpperCase();
};

const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-indigo-100 text-indigo-700",
];

// Couleur stable par expéditeur.
export const avatarColor = (author) => {
  const key = displayName(author);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const matchesQuery = (mail, query) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [mail.author, mail.title, mail.description]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle));
};
