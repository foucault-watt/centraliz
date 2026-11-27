import React from "react";
import { render, screen } from "@testing-library/react";
import Links from "./Links";
import { links } from "../data/links";

vi.mock("../utils/analytics", () => ({ trackProductEvent: vi.fn() }));

// Le nom accessible des liens principaux inclut aussi leur description.
const hrefOf = (name) =>
  screen.getByRole("link", { name: new RegExp(`^${name}`) }).getAttribute("href");

describe("Links", () => {
  it("affiche chaque lien une seule fois", () => {
    render(<Links />);

    expect(screen.getAllByRole("link")).toHaveLength(links.length);
    links.forEach((service) => {
      expect(hrefOf(service.name)).toBe(service.link);
    });
  });

  it("pointe vers les groupes de la promo 2029", () => {
    render(<Links />);

    expect(hrefOf("Promo 2029")).toBe("https://www.facebook.com/groups/1061936216399360/");
    expect(hrefOf("Sans Trash 2029")).toBe("https://www.facebook.com/groups/2086936738577246/");
    expect(hrefOf("Black-Out 2029")).toBe("https://www.facebook.com/groups/2539235173168062/");
    expect(links.some((service) => service.name.includes("2028"))).toBe(false);
  });

  it("remplace Rézoléo par Matos Le Clap, avec le logo du Clap", () => {
    render(<Links />);

    expect(hrefOf("Matos Le Clap")).toBe("https://matos.le-clap.fr/");
    expect(screen.queryByRole("link", { name: "Rézoléo" })).toBeNull();

    const clap = links.find((service) => service.name === "Le Clap");
    const matos = links.find((service) => service.name === "Matos Le Clap");
    expect(matos.image).toBe(clap.image);
  });
});
