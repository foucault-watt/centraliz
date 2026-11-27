import { describe, expect, it } from "vitest";
import { createFrameCache } from "./frameCache";

function setup(limit = 3) {
  const released = [];
  const cache = createFrameCache({ limit, release: (bitmap) => released.push(bitmap) });
  return { cache, released };
}

describe("cache des images du flux", () => {
  it("réaffiche une image déjà reçue sans la retélécharger", () => {
    const { cache, released } = setup();
    cache.put("a", "A");
    cache.put("b", "B");
    expect(cache.get("a")).toBe("A");
    expect(cache.get("b")).toBe("B");
    expect(released).toEqual([]);
  });

  it("renvoie null pour une image inconnue", () => {
    const { cache } = setup();
    expect(cache.get("x")).toBeNull();
  });

  it("libère la plus ancienne au-delà de la limite", () => {
    const { cache, released } = setup(2);
    cache.put("a", "A");
    cache.put("b", "B");
    cache.get("a"); // a redevient la plus récente
    cache.put("c", "C"); // b sort du cache
    expect(released).toEqual(["B"]);
    expect(cache.get("b")).toBeNull();
    expect(cache.size()).toBe(2);
  });

  it("remplace et libère l'ancienne image d'un même identifiant", () => {
    const { cache, released } = setup();
    cache.put("a", "A1");
    cache.put("a", "A2");
    expect(released).toEqual(["A1"]);
    expect(cache.get("a")).toBe("A2");
  });

  it("libère tout de suite une image sans identifiant (mode secours)", () => {
    const { cache, released } = setup();
    cache.put(null, "A");
    expect(released).toEqual(["A"]);
    expect(cache.size()).toBe(0);
  });

  it("vide tout au démontage", () => {
    const { cache, released } = setup();
    cache.put("a", "A");
    cache.put("b", "B");
    cache.clear();
    expect(released.sort()).toEqual(["A", "B"]);
    expect(cache.size()).toBe(0);
  });
});
