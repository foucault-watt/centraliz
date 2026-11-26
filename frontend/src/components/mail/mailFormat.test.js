import {
  avatarColor,
  displayName,
  formatShortDate,
  groupLabel,
  initials,
  matchesQuery,
  sanitizeMailContent,
} from "./mailFormat";

const NOW = new Date(2026, 10, 26, 18, 0); // jeudi 26 novembre 2026

describe("mailFormat", () => {
  it("formate la date courte selon l'ancienneté", () => {
    expect(formatShortDate(new Date(2026, 10, 26, 9, 5), NOW)).toBe("09:05");
    expect(formatShortDate(new Date(2026, 10, 25, 23, 0), NOW)).toBe("Hier");
    expect(formatShortDate(new Date(2026, 10, 23, 10, 0), NOW)).toBe("lun.");
    expect(formatShortDate(new Date(2026, 10, 2, 10, 0), NOW)).toBe("2 nov.");
  });

  it("range les mails par groupe de date", () => {
    expect(groupLabel(new Date(2026, 10, 26, 8), NOW)).toBe("Aujourd'hui");
    expect(groupLabel(new Date(2026, 10, 25, 8), NOW)).toBe("Hier");
    expect(groupLabel(new Date(2026, 10, 21, 8), NOW)).toBe("Cette semaine");
    expect(groupLabel(new Date(2026, 9, 3, 8), NOW)).toBe("Octobre");
    expect(groupLabel(new Date(2025, 9, 3, 8), NOW)).toBe("Octobre 2025");
  });

  it("extrait un nom lisible et des initiales de l'expéditeur", () => {
    expect(displayName('"Marie Curie" <marie@centrale.fr>')).toBe("Marie Curie");
    expect(displayName("<scolarite@centrale.fr>")).toBe("scolarite");
    expect(initials("Marie Curie <marie@centrale.fr>")).toBe("MC");
    expect(initials("scolarite@centrale.fr")).toBe("SC");
    expect(initials("")).toBe("IN");
  });

  it("donne toujours la même couleur au même expéditeur", () => {
    expect(avatarColor("Marie Curie <a@b.fr>")).toBe(
      avatarColor("Marie Curie <autre@b.fr>"),
    );
  });

  it("filtre sur l'expéditeur, l'objet et l'aperçu", () => {
    const mail = { author: "BDE", title: "Soirée de Noël", description: "Rdv au foyer" };
    expect(matchesQuery(mail, "noël")).toBe(true);
    expect(matchesQuery(mail, "foyer")).toBe(true);
    expect(matchesQuery(mail, "partiel")).toBe(false);
    expect(matchesQuery(mail, "  ")).toBe(true);
  });

  it("retire scripts et styles du contenu", () => {
    const html = sanitizeMailContent(
      '<p style="color:red" onclick="x()">Salut</p><script>alert(1)</script>',
    );
    expect(html).toBe("<p>Salut</p>");
  });
});
