const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildAcquisition } = require("./acquisitionStats");

const users = [
  { username: "ancien", display_name: "Ancien", group: "2028", ical_link: "https://x", ent_username: "e1", theme_color: "#fff" },
  { username: "alice", display_name: "Alice", group: "2029", ical_link: "https://y", ent_username: "e2" },
  { username: "bob", display_name: "Bob", group: "2029", ical_link: "  ", ent_username: "e3" },
  { username: "admin", display_name: "Admin", group: "2029", ical_link: "https://z" },
  { username: "fantome", display_name: "Fantôme", group: "2029" },
];
const logins = [
  { username: "ancien", login_time: "2026-09-01T08:00:00Z" },
  { username: "ancien", login_time: "2026-11-20T08:00:00Z" },
  { username: "alice", login_time: "2026-11-24T23:30:00Z" }, // 25/11 à Paris
  { username: "bob", login_time: "2026-11-25T09:00:00Z" },
  { username: "bob", login_time: "2026-11-26T09:00:00Z" },
  { username: "admin", login_time: "2026-11-25T10:00:00Z" },
];

const stats = buildAcquisition({
  users,
  logins,
  passwords: [{ ent_username: "e1" }, { ent_username: "e3" }],
  excluded: ["admin"],
  rangeStart: new Date("2026-11-19T12:00:00Z"),
  now: new Date("2026-11-26T12:00:00Z"),
  range: "7d",
});

test("compte les nouveaux arrivants à partir de leur première connexion", () => {
  assert.equal(stats.totals.users, 4); // admin exclu
  assert.equal(stats.totals.newUsers, 2); // alice et bob
  assert.equal(stats.totals.newWithIcal, 1);
  assert.equal(stats.totals.neverLogged, 1);
  assert.deepEqual(stats.recentUsers.map((user) => user.username), ["bob", "alice"]);
});

test("mesure l'emploi du temps et le mot de passe ENT enregistrés", () => {
  assert.equal(stats.totals.withIcal, 2); // un ical_link vide ne compte pas
  assert.equal(stats.totals.withIcalRate, 50);
  assert.equal(stats.totals.withEnt, 2);
  assert.deepEqual(stats.funnel.map((step) => step.count), [4, 2, 2, 1]);
  assert.deepEqual(stats.activeWithoutIcal.map((user) => user.username), ["bob"]);
});

test("la courbe est continue, au jour parisien, avec le cumul", () => {
  assert.equal(stats.timeline[0].period, "2026-11-19");
  assert.equal(stats.timeline[stats.timeline.length - 1].period, "2026-11-26");
  const day25 = stats.timeline.find((point) => point.period === "2026-11-25");
  assert.equal(day25.newUsers, 2);
  assert.equal(day25.totalUsers, 3); // ancien + alice + bob
  assert.equal(stats.timeline[0].totalUsers, 1);
});

test("regroupe par promo", () => {
  const promo2029 = stats.byGroup.find((group) => group.group === "2029");
  assert.equal(promo2029.users, 3);
  assert.equal(promo2029.withIcal, 1);
  assert.equal(promo2029.withIcalRate, 33);
  assert.equal(promo2029.newUsers, 2);
});
