import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Pokemon from "./Pokemon";
import { fetchApi } from "../utils/api";
import { installFakeCanvas } from "./pokemon/fakeCanvas";

vi.mock("../utils/api", () => ({ fetchApi: vi.fn() }));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Faux EventSource : chaque instance est gardée pour être pilotée par le test.
class FakeEventSource {
  static instances = [];
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.readyState = 0;
    this.listeners = {};
    this.closed = false;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  // size : taille du webp simulé (en octets, avant base64).
  emitFrame(id, { size } = {}) {
    const img = btoa(`image-${id}`.padEnd(size || 0));
    (this.listeners.frame || []).forEach((fn) => fn({ data: JSON.stringify({ id, ageMs: 12, img }) }));
  }
  emitDelta(id, baseId, { x = 10, y = 20, w = 16, h = 8, size } = {}) {
    const img = btoa(`rect-${id}`.padEnd(size || 0));
    (this.listeners.delta || []).forEach((fn) =>
      fn({ data: JSON.stringify({ id, baseId, x, y, w, h, ageMs: 12, img }) })
    );
  }
  emitRef(id) {
    (this.listeners.ref || []).forEach((fn) => fn({ data: JSON.stringify({ id, ageMs: 12 }) }));
  }
  fail({ closed = false } = {}) {
    this.readyState = closed ? 2 : 0;
    this.onerror?.();
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
}

const frameResponse = () => ({ ok: true, status: 200, headers: new Headers(), blob: async () => new Blob(["image-http"]) });

let canvas;

beforeEach(() => {
  canvas = installFakeCanvas();
  vi.useFakeTimers();
  fetchApi.mockReset();
  fetchApi.mockImplementation(async (url) =>
    url.startsWith("/api/pokemon/frame?") ? frameResponse() : { ok: true, json: async () => ({ success: true }) }
  );
  FakeEventSource.instances = [];
  window.EventSource = FakeEventSource;
  let n = 0;
  global.URL.createObjectURL = vi.fn(() => `blob:${(n += 1)}`);
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  canvas.uninstall();
  delete window.EventSource;
  vi.useRealTimers();
});

const pollingCalls = () => fetchApi.mock.calls.filter(([url]) => url.startsWith("/api/pokemon/frame?")).length;

describe("flux continu (SSE)", () => {
  it("affiche les images poussées, sans interroger le serveur", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    expect(source.url).toMatch(/\/api\/pokemon\/stream\?fps=30$/);
    expect(source.options).toEqual({ withCredentials: true });

    await act(async () => {
      source.emitFrame("a");
      source.emitFrame("b");
      await vi.advanceTimersByTimeAsync(10000);
    });

    const screenCanvas = screen.getByRole("img", { name: "Écran du jeu Pokémon en direct" });
    expect(screenCanvas.tagName).toBe("CANVAS");
    expect(screenCanvas).toHaveAttribute("width", "240");
    expect(screenCanvas).toHaveAttribute("height", "160");
    expect(screenCanvas.style.imageRendering).toBe("pixelated");
    expect(canvas.screen()).toBe("image-b");
    expect(canvas.state.draws.at(-1)).toEqual({ label: "image-b", x: 0, y: 0 });
    expect(screen.getByText("En direct")).toBeInTheDocument();
    expect(pollingCalls()).toBe(0);
  });

  it("réaffiche depuis le cache une image déjà reçue (animation en boucle)", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];

    await act(async () => {
      source.emitFrame("a");
      await vi.advanceTimersByTimeAsync(10);
      source.emitFrame("b");
      await vi.advanceTimersByTimeAsync(10);
      source.emitRef("a");
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(canvas.screen()).toBe("image-a");
    expect(globalThis.createImageBitmap).toHaveBeenCalledTimes(2);

    await act(async () => {
      source.emitRef("b");
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(canvas.screen()).toBe("image-b");
    expect(canvas.state.closed).toEqual([]);
    expect(source.closed).toBe(false);
  });

  it("rouvre le flux si le serveur désigne une image absente du cache", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      source.emitRef("inconnue");
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(source.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].closed).toBe(false);
  });

  it("n'affiche une image qu'une fois décodée, puis la plus récente", async () => {
    canvas.state.manual = true;
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    const decodes = canvas.state.decodes;
    await act(async () => {
      source.emitFrame("a");
      source.emitFrame("b");
      source.emitFrame("c");
      await vi.advanceTimersByTimeAsync(0);
    });
    // Décodages lancés dès la réception, rien n'est encore dessiné.
    expect(decodes.map((d) => d.label)).toEqual(["image-a", "image-b", "image-c"]);
    expect(screen.queryByRole("img", { name: "Écran du jeu Pokémon en direct" })).toBeNull();
    await act(async () => {
      decodes[2].finish();
      decodes[1].finish();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(canvas.screen()).toBe(""); // la file attend a, en cours
    await act(async () => {
      decodes[0].finish();
      await vi.advanceTimersByTimeAsync(0);
    });
    // a (en cours) et b (en attente) sont remplacées par c, la plus récente.
    expect(canvas.screen()).toBe("image-c");
    expect(canvas.state.draws.map((d) => d.label)).toEqual(["image-c"]);
    expect(screen.getByRole("img", { name: "Écran du jeu Pokémon en direct" })).toBeVisible();
    // Une image écartée reste gardée en cache pour un futur ref.
    await act(async () => {
      source.emitRef("a");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(canvas.screen()).toBe("image-a");
    expect(source.closed).toBe(false);
  });

  it("rouvre le flux continu à la cadence choisie", async () => {
    render(<Pokemon />);
    const previous = FakeEventSource.instances[0];
    fireEvent.click(screen.getByRole("button", { name: "22 FPS" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(previous.closed).toBe(true);
    expect(FakeEventSource.instances.at(-1).url).toMatch(/\/api\/pokemon\/stream\?fps=22$/);
  });

  it("plafonne aussi les admins à 30 FPS", async () => {
    render(<Pokemon user={{ is_admin: true }} />);
    expect(screen.queryByRole("button", { name: "60 FPS" })).toBeNull();
    expect(screen.getByRole("slider", { name: "FPS cibles" })).toHaveAttribute("max", "30");
    expect(FakeEventSource.instances[0].url).toMatch(/\/api\/pokemon\/stream\?fps=30$/);
  });

  it("repasse en interrogation si aucune image n'arrive", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6500);
    });
    expect(source.closed).toBe(true);
    expect(pollingCalls()).toBeGreaterThan(0);
    expect(screen.getByText("En direct")).toBeInTheDocument();
  });

  it("repasse en interrogation sur un refus définitif (session)", async () => {
    render(<Pokemon />);
    await act(async () => {
      FakeEventSource.instances[0].fail({ closed: true });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(pollingCalls()).toBeGreaterThan(0);
  });

  it("une coupure après des images se reconnecte toute seule, sans repli", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      source.fail();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText("Reconnexion…")).toBeInTheDocument();
    expect(source.closed).toBe(false);
    expect(pollingCalls()).toBe(0);

    await act(async () => {
      source.emitFrame("b");
    });
    expect(screen.getByText("En direct")).toBeInTheDocument();
  });

  it("dessine un delta en (x, y) par-dessus la bonne image", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      source.emitDelta("b", "a", { x: 32, y: 48 });
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(canvas.state.draws).toEqual([
      { label: "image-a", x: 0, y: 0 },
      { label: "rect-b", x: 32, y: 48 },
    ]);
    expect(canvas.screen()).toBe("image-a+rect-b@32,48");
    expect(canvas.state.closed).toContain("rect-b"); // rectangle libéré une fois dessiné
    expect(source.closed).toBe(false);
  });

  it("rouvre le flux si un delta ne part pas de la dernière image", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      source.emitFrame("b");
      source.emitDelta("c", "a");
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(canvas.state.draws.some((d) => d.label === "rect-c")).toBe(false);
    expect(source.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].closed).toBe(false);
  });

  it("compare la base d'un delta à la dernière image de la file, pas à celle affichée", async () => {
    canvas.state.manual = true;
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      await vi.advanceTimersByTimeAsync(0);
      canvas.state.decodes[0].finish();
      await vi.advanceTimersByTimeAsync(0);
      source.emitFrame("b"); // pas encore décodée : l'écran montre encore a
      source.emitDelta("c", "b");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(canvas.screen()).toBe("image-a");
    expect(source.closed).toBe(false);
    await act(async () => {
      canvas.state.decodes[1].finish();
      canvas.state.decodes[2].finish();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(canvas.screen()).toBe("image-b+rect-c@10,20");
  });

  it("applique les deltas dans l'ordre, même si le 2e est décodé avant le 1er", async () => {
    canvas.state.manual = true;
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    const decodes = canvas.state.decodes;
    await act(async () => {
      source.emitFrame("a");
      source.emitDelta("b", "a", { x: 1, y: 2 });
      source.emitDelta("c", "b", { x: 3, y: 4 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(decodes.map((d) => d.label)).toEqual(["image-a", "rect-b", "rect-c"]);
    await act(async () => {
      decodes[2].finish(); // c d'abord : il doit attendre b
      decodes[0].finish();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(canvas.screen()).toBe("image-a");
    await act(async () => {
      decodes[1].finish();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(canvas.state.draws.map((d) => d.label)).toEqual(["image-a", "rect-b", "rect-c"]);
    expect(canvas.screen()).toBe("image-a+rect-b@1,2+rect-c@3,4");
    expect(source.closed).toBe(false);
  });

  it("une image entière remplace les deltas en attente", async () => {
    canvas.state.manual = true;
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      source.emitDelta("b", "a");
      source.emitFrame("c");
      source.emitDelta("d", "c", { x: 2, y: 2 });
      await vi.advanceTimersByTimeAsync(0);
      canvas.state.decodes.forEach((d) => d.finish());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(canvas.state.draws.map((d) => d.label)).toEqual(["image-c", "rect-d"]);
    expect(canvas.screen()).toBe("image-c+rect-d@2,2");
    expect(source.closed).toBe(false);
  });

  it("un ref redessine l'image reconstituée après un delta", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      source.emitDelta("b", "a", { x: 5, y: 6 });
      await vi.advanceTimersByTimeAsync(10);
      source.emitFrame("z");
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(canvas.screen()).toBe("image-z");
    await act(async () => {
      source.emitRef("b");
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(canvas.state.draws.at(-1)).toEqual({ label: "image-a+rect-b@5,6", x: 0, y: 0 });
    expect(canvas.screen()).toBe("image-a+rect-b@5,6");
    // Un delta peut ensuite partir de cette image.
    await act(async () => {
      source.emitDelta("c", "b", { x: 7, y: 8 });
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(canvas.screen()).toBe("image-a+rect-b@5,6+rect-c@7,8");
    expect(source.closed).toBe(false);
  });

  it("un ref vers l'image d'un delta encore en attente passe après lui", async () => {
    canvas.state.manual = true;
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      source.emitDelta("b", "a");
      source.emitRef("b");
      await vi.advanceTimersByTimeAsync(0);
      canvas.state.decodes.forEach((d) => d.finish());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(source.closed).toBe(false);
    expect(canvas.screen()).toBe("image-a+rect-b@10,20");
  });

  it("rouvre le flux si un delta est illisible", async () => {
    canvas.state.manual = true;
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a");
      source.emitDelta("b", "a");
      source.emitDelta("c", "b");
      await vi.advanceTimersByTimeAsync(0);
      canvas.state.decodes[0].finish();
      canvas.state.decodes[1].fail();
      canvas.state.decodes[2].finish();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(canvas.state.draws.map((d) => d.label)).toEqual(["image-a"]);
    expect(source.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("le panneau compte les deltas et les octets économisés", async () => {
    render(<Pokemon />);
    fireEvent.click(screen.getByRole("button", { name: "Stats du flux" }));
    const source = FakeEventSource.instances[0];
    await act(async () => {
      source.emitFrame("a", { size: 3072 }); // 4 Ko en base64
      source.emitDelta("b", "a", { size: 768 }); // 1 Ko en base64
      source.emitDelta("c", "b", { size: 768 });
      source.emitRef("a"); // depuis le cache : ni image ni delta
      await vi.advanceTimersByTimeAsync(1500);
    });
    const stat = (label) => screen.getByText(label).parentElement;
    expect(stat("Part de deltas")).toHaveTextContent("67 %");
    expect(stat("Part de deltas")).toHaveTextContent("2 deltas / 3 images reçues");
    // Chaque delta évite 4 − 1 = 3 Ko.
    expect(stat("Octets économisés")).toHaveTextContent("6.0 Ko");
    expect(stat("Octets économisés")).toHaveTextContent("75 % de moins qu'en images entières (estimé)");
    expect(stat("Reçu en deltas")).toHaveTextContent("2.0 Ko");
    expect(stat("Reçu en deltas")).toHaveTextContent("1.0 Ko par delta");
    expect(stat("Reçu en images entières")).toHaveTextContent("4.0 Ko");
  });

  it("le panneau indique le mode flux", async () => {
    render(<Pokemon />);
    fireEvent.click(screen.getByRole("button", { name: "Stats du flux" }));
    await act(async () => {
      FakeEventSource.instances[0].emitFrame("a");
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText("Flux continu (SSE)")).toBeInTheDocument();
    expect(screen.getByText("30 connexions ouvertes, 0 requête/s")).toBeInTheDocument();
  });
});
