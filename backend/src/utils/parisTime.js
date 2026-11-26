// Les dates sont stockées en UTC, mais les stats doivent se lire à l'heure de
// l'école : 12h à Paris = 11h UTC l'hiver et 10h UTC l'été. Tous les
// regroupements (heure, jour, jour de semaine, semaine, mois) passent par ici.
const TIME_ZONE = "Europe/Paris";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

const weekdayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
});

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// { year, month, day, hour } à Paris (nombres), ou null si date invalide.
const parisParts = (value) => {
  const date = toDate(value);
  if (!date) return null;
  const parts = {};
  partsFormatter.formatToParts(date).forEach(({ type, value: part }) => {
    if (type !== "literal") parts[type] = Number(part);
  });
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour };
};

const pad = (value) => String(value).padStart(2, "0");

const parisHour = (value) => parisParts(value)?.hour ?? null;

// "lundi" … "dimanche"
const parisWeekday = (value) => {
  const date = toDate(value);
  return date ? weekdayFormatter.format(date) : null;
};

// Clé de période à Paris : jour "2026-11-26", semaine (lundi) "2026-11-23",
// mois "2026-11".
const parisPeriodKey = (value, groupBy = "day") => {
  const parts = parisParts(value);
  if (!parts) return null;
  if (groupBy === "month") return `${parts.year}-${pad(parts.month)}`;
  if (groupBy === "week") {
    // Calcul sur la date civile parisienne, sans heure : pas d'effet de fuseau.
    const civil = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const weekday = civil.getUTCDay();
    civil.setUTCDate(civil.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
    return civil.toISOString().slice(0, 10);
  }
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

module.exports = {
  TIME_ZONE,
  parisParts,
  parisHour,
  parisWeekday,
  parisPeriodKey,
};
