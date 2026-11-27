import { describe, expect, it } from "vitest";
import { createFrameCache } from "./frameCache";

function setup(limit = 3) {
  let n = 0;
  const revoked = [];
  const cache = createFrameCache({ limit, createUrl: () => `blob:${(n += 1)}`, revokeUrl: (url) => revoked.push(url) });
  return { cache, revoked };
}

describe("cache des images du flux", () => {
  it("réaffiche une image déjà reçue sans la retélécharger", () => {
    const { cache, revoked } = setup();
    expect(cache.put("A", "a")).toBe("blob:1");
    expect(cache.put("B", "b")).toBe("blob:2");
    expect(cache.get("a")).toBe("blob:1");
    expect(cache.get("b")).toBe("blob:2");
    expect(revoked).toEqual([]);
  });

  it("renvoie une chaîne vide pour une image inconnue", () => {
    const { cache } = setup();
    expect(cache.get("x")).toBe("");
  });

  it("libère la plus ancienne au-delà de la limite, mais jamais l'image affichée", () => {
    const { cache, revoked } = setup(2);
    cache.put("A", "a");
    cache.put("B", "b");
    cache.get("a"); // a redevient la plus récente
    cache.put("C", "c"); // b sort du cache
    expect(revoked).toEqual(["blob:2"]);
    expect(cache.get("b")).toBe("");
    expect(cache.size()).toBe(2);
  });

  it("libère l'image sans identifiant (mode secours) quand une autre la remplace", () => {
    const { cache, revoked } = setup();
    cache.put("A");
    cache.put("B");
    expect(revoked).toEqual(["blob:1"]);
  });

  it("vide tout au démontage", () => {
    const { cache, revoked } = setup();
    cache.put("A", "a");
    cache.put("B");
    cache.clear();
    expect(revoked.sort()).toEqual(["blob:1", "blob:2"]);
  });
});
