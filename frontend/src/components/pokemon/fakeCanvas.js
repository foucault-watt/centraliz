// Outils de test : jsdom n'a ni canvas ni createImageBitmap.
//
// Le faux contexte 2D enregistre chaque drawImage et tient une description
// de ce que montre l'écran : une image entière remplace tout
// ("image-a"), un rectangle s'ajoute par-dessus ("image-a+rect-b@10,20").
// Une copie de l'écran (createImageBitmap(canvas)) reprend cette description.
//
// Les images décodées portent le contenu de leur blob comme libellé : les
// tests envoient "image-<id>" pour une image entière, "rect-<id>" pour un
// rectangle. En mode manuel, chaque décodage attend que le test le termine.
import { vi } from "vitest";

export function installFakeCanvas() {
  const contexts = new WeakMap();
  const state = { draws: [], decodes: [], manual: false, closed: [] };

  const contextFor = (canvas) => {
    if (!contexts.has(canvas)) {
      const context = {
        canvas,
        screen: "",
        drawImage: vi.fn((bitmap, x, y) => {
          state.draws.push({ label: bitmap.label, x, y });
          context.screen = bitmap.full ? bitmap.label : `${context.screen}+${bitmap.label}@${x},${y}`;
        }),
      };
      contexts.set(canvas, context);
    }
    return contexts.get(canvas);
  };

  const bitmap = (label, full) => {
    const result = { label, full };
    result.close = vi.fn(() => state.closed.push(label));
    return result;
  };

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function getContext() {
    return contextFor(this);
  });

  globalThis.createImageBitmap = vi.fn(async (source) => {
    if (source instanceof HTMLCanvasElement) return bitmap(contextFor(source).screen, true);
    const label = (await source.text()).trim();
    const make = () => bitmap(label, label.startsWith("image"));
    if (!state.manual) return make();
    return new Promise((resolve, reject) => {
      state.decodes.push({ label, finish: () => resolve(make()), fail: () => reject(new Error("illisible")) });
    });
  });

  return {
    state,
    // Ce que montre l'écran du jeu.
    screen: () => {
      const canvas = document.querySelector("canvas");
      return canvas ? contextFor(canvas).screen : null;
    },
    uninstall: () => {
      delete globalThis.createImageBitmap;
    },
  };
}
