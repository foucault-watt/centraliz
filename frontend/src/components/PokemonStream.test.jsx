import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Pokemon from "./Pokemon";
import { fetchApi } from "../utils/api";

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
  emitFrame(id) {
    const img = btoa(`image-${id}`);
    (this.listeners.frame || []).forEach((fn) => fn({ data: JSON.stringify({ id, ageMs: 12, img }) }));
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

const frameResponse = () => ({ ok: true, status: 200, headers: new Headers(), blob: async () => new Blob(["x"]) });

beforeEach(() => {
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

    expect(screen.getByAltText("Écran du jeu Pokémon en direct")).toHaveAttribute("src", "blob:2");
    expect(screen.getByText("En direct")).toBeInTheDocument();
    expect(pollingCalls()).toBe(0);
  });

  it("réaffiche depuis le cache une image déjà reçue (animation en boucle)", async () => {
    render(<Pokemon />);
    const source = FakeEventSource.instances[0];
    const screenImg = () => screen.getByAltText("Écran du jeu Pokémon en direct");

    await act(async () => {
      source.emitFrame("a");
      source.emitFrame("b");
      source.emitRef("a");
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screenImg()).toHaveAttribute("src", "blob:1");
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);

    await act(async () => {
      source.emitRef("b");
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screenImg()).toHaveAttribute("src", "blob:2");
    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
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
    const decodes = [];
    const RealImage = global.Image;
    global.Image = class {
      decode() {
        return new Promise((resolve) => decodes.push({ src: this.src, resolve }));
      }
    };
    try {
      render(<Pokemon />);
      const source = FakeEventSource.instances[0];
      const screenImg = () => screen.queryByAltText("Écran du jeu Pokémon en direct");
      await act(async () => {
        source.emitFrame("a");
        source.emitFrame("b");
        source.emitFrame("c");
      });
      expect(decodes.map((d) => d.src)).toEqual(["blob:1"]); // une à la fois
      expect(screenImg()).toBeNull();
      await act(async () => {
        decodes[0].resolve();
      });
      expect(screenImg()).toHaveAttribute("src", "blob:1");
      expect(decodes.map((d) => d.src)).toEqual(["blob:1", "blob:3"]); // b sautée
      await act(async () => {
        decodes[1].resolve();
      });
      expect(screenImg()).toHaveAttribute("src", "blob:3");
    } finally {
      global.Image = RealImage;
    }
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

  it("essaie 60 FPS via le flux admin et revient à 30 si le flux échoue", async () => {
    render(<Pokemon user={{ is_admin: true }} />);
    const previous = FakeEventSource.instances[0];
    fireEvent.click(screen.getByRole("button", { name: "60 FPS" }));
    await act(async () => {
      previous.emitFrame("a");
      await vi.advanceTimersByTimeAsync(500);
    });
    const experimental = FakeEventSource.instances.at(-1);
    expect(experimental.url).toMatch(/\/api\/pokemon\/admin\/stream\?fps=60$/);
    await act(async () => {
      experimental.fail({ closed: true });
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(experimental.closed).toBe(true);
    expect(screen.getByRole("slider", { name: "FPS cibles" })).toHaveValue("30");
    expect(fetchApi.mock.calls.some(([url]) => url.startsWith("/api/pokemon/frame?fps=30&"))).toBe(true);
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
