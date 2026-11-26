const { parisHour, parisPeriodKey, parisWeekday } = require("../utils/parisTime");

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const WEEKEND = new Set(["samedi", "dimanche"]);
const HOURS = [...Array(24)].map((_, hour) => hour);
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_MODULES = 5;

const round1 = (value) => Math.round(value * 10) / 10;

// Temps forts, à l'heure de Paris :
// - cells : par jour de semaine × heure, événements et personnes distinctes ;
// - typicalDay : personnes distinctes en moyenne à chaque heure, un jour de
//   semaine vs un jour de week-end (moyenne sur les jours de la période) ;
// - modulesByHour : ce qui est utilisé selon l'heure (top modules).
function buildHeatmap(events, { rangeStart, now = new Date() }) {
  const cells = new Map();
  WEEKDAYS.forEach((weekday) => {
    HOURS.forEach((hour) => {
      cells.set(`${weekday}-${hour}`, { weekday, hour, count: 0, users: new Set() });
    });
  });

  const dayHourUsers = new Map(); // "2026-11-26|12" -> Set
  const moduleHours = new Map(); // module -> [24]

  events.forEach((event) => {
    const weekday = parisWeekday(event.created_at);
    const hour = parisHour(event.created_at);
    if (weekday === null || hour === null) return;
    const cell = cells.get(`${weekday}-${hour}`);
    if (!cell) return;
    cell.count += 1;
    if (event.user_username) {
      cell.users.add(event.user_username);
      const key = `${parisPeriodKey(event.created_at)}|${hour}`;
      if (!dayHourUsers.has(key)) dayHourUsers.set(key, new Set());
      dayHourUsers.get(key).add(event.user_username);
    }
    if (event.module) {
      if (!moduleHours.has(event.module)) moduleHours.set(event.module, Array(24).fill(0));
      moduleHours.get(event.module)[hour] += 1;
    }
  });

  // Nombre de jours de semaine / de week-end dans la période.
  const days = new Map(); // dateKey -> isWeekend
  for (let time = rangeStart.getTime(); time <= now.getTime(); time += DAY_MS) {
    days.set(parisPeriodKey(time), WEEKEND.has(parisWeekday(time)));
  }
  days.set(parisPeriodKey(now), WEEKEND.has(parisWeekday(now)));
  const weekdayDates = [...days].filter(([, weekend]) => !weekend).map(([date]) => date);
  const weekendDates = [...days].filter(([, weekend]) => weekend).map(([date]) => date);
  const averageAt = (dates, hour) =>
    dates.length
      ? round1(dates.reduce((sum, date) => sum + (dayHourUsers.get(`${date}|${hour}`)?.size || 0), 0) / dates.length)
      : 0;

  const topModules = [...moduleHours.entries()]
    .map(([module, hours]) => ({ module, total: hours.reduce((a, b) => a + b, 0), hours }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_MODULES);

  return {
    weekdays: WEEKDAYS,
    hours: HOURS,
    cells: [...cells.values()].map((cell) => ({
      weekday: cell.weekday,
      hour: cell.hour,
      count: cell.count,
      users: cell.users.size,
    })),
    typicalDay: HOURS.map((hour) => ({
      hour,
      weekday: averageAt(weekdayDates, hour),
      weekend: averageAt(weekendDates, hour),
    })),
    modules: topModules.map((entry) => entry.module),
    modulesByHour: HOURS.map((hour) => {
      const point = { hour };
      topModules.forEach((entry) => {
        point[entry.module] = entry.hours[hour];
      });
      return point;
    }),
  };
}

module.exports = { buildHeatmap };
