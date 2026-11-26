const { parisPeriodKey } = require("../utils/parisTime");

const DAY_MS = 24 * 60 * 60 * 1000;
const pct = (count, total) => (total ? Math.round((count / total) * 100) : 0);

// Acquisition et configuration des comptes, à partir de :
// - users : comptes (emploi du temps = ical_link, couleur = theme_color) ;
// - logins : user_logins (première connexion enregistrée = arrivée) ;
// - passwords : mots de passe ENT enregistrés (par ent_username).
function buildAcquisition({
  users = [],
  logins = [],
  passwords = [],
  excluded = [],
  rangeStart,
  groupBy = "day",
  range = "30d",
  now = new Date(),
}) {
  const excludedSet = new Set(excluded);
  const entWithPassword = new Set(
    passwords.map((entry) => entry.ent_username).filter(Boolean),
  );

  const firstLogin = new Map();
  const lastLogin = new Map();
  logins.forEach(({ username, login_time: loginTime }) => {
    const time = new Date(loginTime).getTime();
    if (!username || Number.isNaN(time)) return;
    if (!firstLogin.has(username) || time < firstLogin.get(username)) {
      firstLogin.set(username, time);
    }
    if (!lastLogin.has(username) || time > lastLogin.get(username)) {
      lastLogin.set(username, time);
    }
  });

  const rows = users
    .filter((user) => user.username && !excludedSet.has(user.username))
    .map((user) => ({
      username: user.username,
      displayName: user.display_name || user.username,
      group: user.group || "Non renseigné",
      hasIcal: Boolean(String(user.ical_link || "").trim()),
      hasEntPassword: Boolean(
        user.ent_username && entWithPassword.has(user.ent_username),
      ),
      hasThemeColor: Boolean(user.theme_color),
      firstLoginAt: firstLogin.has(user.username)
        ? new Date(firstLogin.get(user.username)).toISOString()
        : null,
      lastLoginAt: lastLogin.has(user.username)
        ? new Date(lastLogin.get(user.username)).toISOString()
        : null,
    }));

  const start = rangeStart.getTime();
  const isNew = (row) =>
    row.firstLoginAt && new Date(row.firstLoginAt).getTime() >= start;
  const isActive = (row) =>
    row.lastLoginAt && new Date(row.lastLoginAt).getTime() >= start;
  const newUsers = rows.filter(isNew);
  const activeUsers = rows.filter(isActive);

  // Toutes les périodes de la plage, même vides, pour un graphique continu.
  const periods = [];
  for (let time = start; time <= now.getTime(); time += DAY_MS) {
    const key = parisPeriodKey(time, groupBy);
    if (periods[periods.length - 1] !== key) periods.push(key);
  }
  const nowKey = parisPeriodKey(now, groupBy);
  if (periods[periods.length - 1] !== nowKey) periods.push(nowKey);

  const newByPeriod = new Map();
  const newWithIcalByPeriod = new Map();
  newUsers.forEach((row) => {
    const key = parisPeriodKey(row.firstLoginAt, groupBy);
    newByPeriod.set(key, (newByPeriod.get(key) || 0) + 1);
    if (row.hasIcal) {
      newWithIcalByPeriod.set(key, (newWithIcalByPeriod.get(key) || 0) + 1);
    }
  });
  let cumulative = rows.filter(
    (row) => row.firstLoginAt && new Date(row.firstLoginAt).getTime() < start,
  ).length;
  const timeline = periods.map((period) => {
    const count = newByPeriod.get(period) || 0;
    cumulative += count;
    return {
      period,
      newUsers: count,
      newWithIcal: newWithIcalByPeriod.get(period) || 0,
      totalUsers: cumulative,
    };
  });

  const total = rows.length;
  const withIcal = rows.filter((row) => row.hasIcal).length;
  const withEnt = rows.filter((row) => row.hasEntPassword).length;
  const withTheme = rows.filter((row) => row.hasThemeColor).length;

  const groups = new Map();
  rows.forEach((row) => {
    const group = groups.get(row.group) || {
      group: row.group,
      users: 0,
      withIcal: 0,
      withEnt: 0,
      newUsers: 0,
    };
    group.users += 1;
    group.withIcal += Number(row.hasIcal);
    group.withEnt += Number(row.hasEntPassword);
    group.newUsers += Number(Boolean(isNew(row)));
    groups.set(row.group, group);
  });

  const byDateDesc = (field) => (a, b) =>
    new Date(b[field]).getTime() - new Date(a[field]).getTime();

  return {
    range,
    groupBy,
    totals: {
      users: total,
      newUsers: newUsers.length,
      newWithIcal: newUsers.filter((row) => row.hasIcal).length,
      activeUsers: activeUsers.length,
      activeWithoutIcal: activeUsers.filter((row) => !row.hasIcal).length,
      withIcal,
      withIcalRate: pct(withIcal, total),
      withEnt,
      withEntRate: pct(withEnt, total),
      withTheme,
      withThemeRate: pct(withTheme, total),
      neverLogged: rows.filter((row) => !row.firstLoginAt).length,
    },
    timeline,
    funnel: [
      { key: "accounts", label: "Comptes créés", count: total },
      { key: "ical", label: "Emploi du temps ajouté", count: withIcal },
      { key: "ent", label: "Mot de passe ENT enregistré", count: withEnt },
      { key: "theme", label: "Couleur choisie", count: withTheme },
    ].map((step) => ({ ...step, rate: pct(step.count, total) })),
    byGroup: [...groups.values()]
      .map((group) => ({
        ...group,
        withIcalRate: pct(group.withIcal, group.users),
        withEntRate: pct(group.withEnt, group.users),
      }))
      .sort((a, b) => b.users - a.users || a.group.localeCompare(b.group)),
    recentUsers: [...newUsers].sort(byDateDesc("firstLoginAt")).slice(0, 50),
    activeWithoutIcal: activeUsers
      .filter((row) => !row.hasIcal)
      .sort(byDateDesc("lastLoginAt"))
      .slice(0, 50),
  };
}

module.exports = { buildAcquisition };
