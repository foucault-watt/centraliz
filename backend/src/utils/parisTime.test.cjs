const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parisHour,
  parisWeekday,
  parisPeriodKey,
} = require("./parisTime");

test("l'heure est celle de Paris, heure d'hiver (UTC+1) comme d'été (UTC+2)", () => {
  assert.equal(parisHour("2026-11-26T11:30:00Z"), 12);
  assert.equal(parisHour("2026-07-02T10:30:00Z"), 12);
});

test("un événement à 0h30 à Paris compte pour le bon jour", () => {
  // 23h30 UTC le 25 = 0h30 à Paris le 26 (hiver).
  assert.equal(parisPeriodKey("2026-11-25T23:30:00Z"), "2026-11-26");
  assert.equal(parisWeekday("2026-11-25T23:30:00Z"), "jeudi");
});

test("semaine et mois sont calculés sur la date parisienne", () => {
  // Dimanche 29 novembre 23h30 UTC = lundi 30 novembre à Paris.
  assert.equal(parisPeriodKey("2026-11-29T23:30:00Z", "week"), "2026-11-30");
  assert.equal(parisPeriodKey("2026-11-29T12:00:00Z", "week"), "2026-11-23");
  // 31 décembre 23h30 UTC = 1er janvier à Paris.
  assert.equal(parisPeriodKey("2026-12-31T23:30:00Z", "month"), "2027-01");
});

test("une date invalide donne null", () => {
  assert.equal(parisHour("pas une date"), null);
  assert.equal(parisPeriodKey(undefined), null);
});
