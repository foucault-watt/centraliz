import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Pokemon from "./Pokemon";
import { buttonForKey, isTypingTarget } from "./pokemon/controls";
import { computeStats } from "./pokemon/usePokemonStream";
import { fetchApi } from "../utils/api";
import { installFakeCanvas } from "./pokemon/fakeCanvas";

vi.mock("../utils/api", () => ({ fetchApi: vi.fn() }));

// Recharts mesure son conteneur ; jsdom n'a pas ResizeObserver.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const frameResponse = () => ({ ok: true, blob: async () => new Blob(["image-http"]) });
const okResponse = () => ({ ok: true, json: async () => ({ success: true }) });

const inputCalls = () =>
  fetchApi.mock.calls
    .filter(([url]) => url === "/api/pokemon/input")
    .map(([, options]) => JSON.parse(options.body).button);

let canvas;

beforeEach(() => {
  canvas = installFakeCanvas();
  vi.useFakeTimers();
  fetchApi.mockReset();
  global.URL.createObjectURL = vi.fn(() => "blob:frame");
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  canvas.uninstall();
  vi.useRealTimers();
});

const renderLive = async () => {
  fetchApi.mockImplementation(async (url) =>
    url.startsWith("/api/pokemon/frame?") ? frameResponse() : okResponse()
  );
  render(<Pokemon />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
};

describe("Pokemon", () => {
  it("applique la vitesse partagée depuis le curseur admin", async () => {
    let speed = 1;
    fetchApi.mockImplementation(async (url, options) => {
      if (url.startsWith("/api/pokemon/frame?")) return frameResponse();
      if (url !== "/api/pokemon/speed") return okResponse();
      if (options?.method === "PUT") speed = JSON.parse(options.body).speed;
      return { ok: true, json: async () => ({ available: true, speed }) };
    });
    render(<Pokemon user={{ is_admin: true }} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const slider = screen.getByRole("slider", { name: "Vitesse du jeu" });
    expect(slider).toHaveAttribute("aria-valuetext", "×1");
    fireEvent.change(slider, { target: { value: "1.5" } });
    expect(speed).toBe(1);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Appliquer" })); });
    expect(speed).toBe(1.5);
    expect(screen.getByText("×1,5 pour toute la partie")).toBeInTheDocument();
  });

  it("affiche l'écran en direct et une manette sans jargon technique", async () => {
    await renderLive();

    expect(screen.getByRole("img", { name: "Écran du jeu Pokémon en direct" })).toBeVisible();
    // Mode secours (interrogation) : image entière dessinée en (0, 0).
    expect(canvas.state.draws.at(-1)).toEqual({ label: "image-http", x: 0, y: 0 });
    expect(canvas.screen()).toBe("image-http");
    expect(screen.getByText("En direct")).toBeInTheDocument();
    ["Haut", "Bas", "Gauche", "Droite", "A, valider", "B, retour", "Start, menu"].forEach((name) => {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    });
    expect(screen.queryByText(/mgba|backend|webp/i)).toBeNull();
    expect(screen.queryByRole("slider", { name: "Vitesse du jeu" })).toBeNull();
  });

  it("envoie le bouton dès l'appui", async () => {
    await renderLive();

    const a = screen.getByRole("button", { name: "A, valider" });
    await act(async () => {
      fireEvent.pointerDown(a, { button: 0, pointerId: 1 });
      await vi.advanceTimersByTimeAsync(0);
      fireEvent.pointerUp(a, { pointerId: 1 });
    });

    expect(inputCalls()).toEqual(["A"]);
  });

  it("répète une direction tant qu'on garde le doigt dessus", async () => {
    await renderLive();

    const up = screen.getByRole("button", { name: "Haut" });
    await act(async () => {
      fireEvent.pointerDown(up, { button: 0, pointerId: 1 });
      await vi.advanceTimersByTimeAsync(800);
      fireEvent.pointerUp(up, { pointerId: 1 });
      await vi.advanceTimersByTimeAsync(800);
    });

    const ups = inputCalls().filter((b) => b === "UP");
    expect(ups.length).toBeGreaterThanOrEqual(3);
    expect(ups.length).toBeLessThanOrEqual(5);
  });

  it("ne répète pas A", async () => {
    await renderLive();

    const a = screen.getByRole("button", { name: "A, valider" });
    await act(async () => {
      fireEvent.pointerDown(a, { button: 0, pointerId: 1 });
      await vi.advanceTimersByTimeAsync(1000);
      fireEvent.pointerUp(a, { pointerId: 1 });
    });

    expect(inputCalls()).toEqual(["A"]);
  });

  it("se joue au clavier", async () => {
    await renderLive();

    await act(async () => {
      fireEvent.keyDown(window, { key: "x" });
      await vi.advanceTimersByTimeAsync(0);
      fireEvent.keyUp(window, { key: "x" });
      fireEvent.keyDown(window, { key: "Enter" });
      await vi.advanceTimersByTimeAsync(0);
      fireEvent.keyUp(window, { key: "Enter" });
    });

    expect(inputCalls()).toEqual(["A", "START"]);
  });

  it("ouvre les nouveautés sans détourner Entrée vers la manette", async () => {
    await renderLive();

    const summary = screen.getByText("Nouveautés").closest("summary");
    const panel = summary.parentElement;
    expect(panel).not.toHaveAttribute("open");
    expect(fireEvent.keyDown(summary, { key: "Enter" })).toBe(true);
    expect(inputCalls()).toEqual([]);

    fireEvent.click(summary);
    expect(panel).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: /Première version/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Image en direct · v1\.1/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Partie en vitesse ×2 · v1.2/ })).toBeInTheDocument();
    expect(summary).toHaveTextContent("v1.2");
    expect(screen.getByRole("heading", { name: "À venir" })).toBeInTheDocument();

    fireEvent.click(summary);
    expect(panel).not.toHaveAttribute("open");
  });

  it("propose de réessayer quand le jeu ne répond pas, et bloque la manette", async () => {
    fetchApi.mockResolvedValue({ ok: false, status: 503 });
    render(<Pokemon />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(screen.getByText("Le jeu ne répond pas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Haut" })).toBeDisabled();

    fetchApi.mockImplementation(async () => frameResponse());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText("En direct")).toBeInTheDocument();
  });

  it("signale une commande refusée", async () => {
    fetchApi.mockImplementation(async (url) =>
      url.startsWith("/api/pokemon/frame?") ? frameResponse() : { ok: false, status: 503 }
    );
    render(<Pokemon />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const b = screen.getByRole("button", { name: "B, retour" });
    await act(async () => {
      fireEvent.pointerDown(b, { button: 0, pointerId: 1 });
      await vi.advanceTimersByTimeAsync(0);
      fireEvent.pointerUp(b, { pointerId: 1 });
    });

    expect(screen.getByText(/La commande n'est pas passée/)).toBeInTheDocument();
  });
});

describe("contrôles clavier", () => {
  it("couvre flèches, ZQSD, WASD, X/C et Entrée", () => {
    expect(buttonForKey("ArrowUp")).toBe("UP");
    expect(buttonForKey("Z")).toBe("UP");
    expect(buttonForKey("q")).toBe("LEFT");
    expect(buttonForKey("a")).toBe("LEFT");
    expect(buttonForKey("x")).toBe("A");
    expect(buttonForKey("c")).toBe("B");
    expect(buttonForKey("Enter")).toBe("START");
    expect(buttonForKey("p")).toBeNull();
  });

  it("ignore le clavier dans un champ de saisie", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
  });
});

describe("réglages du flux", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("met le curseur à 30 par défaut et applique chaque préréglage à la demande suivante", async () => {
    await renderLive();
    const slider = screen.getByRole("slider", { name: "FPS cibles" });
    expect(slider).toHaveValue("30");
    expect(screen.getByRole("button", { name: "30 FPS", pressed: true })).toBeInTheDocument();

    for (const fps of [8, 15, 22, 30]) {
      const preset = screen.getByRole("button", { name: `${fps} FPS` });
      await act(async () => {
        fireEvent.click(preset);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });
      const requests = fetchApi.mock.calls.map(([url]) => url).filter((url) => url.startsWith("/api/pokemon/frame?"));
      expect(requests.at(-1)).toContain(`fps=${fps}&`);
      expect(slider).toHaveValue(String(fps));
      expect(preset).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("laisse tout le monde ouvrir et fermer les statistiques", async () => {
    await renderLive();
    const toggle = screen.getByRole("button", { name: "Stats du flux" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Debug du flux" })).toBeNull();

    expect(fireEvent.keyDown(toggle, { key: "Enter" })).toBe(true);
    expect(inputCalls()).toEqual([]);
    fireEvent.click(toggle);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Debug du flux" })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByRole("heading", { name: "Debug du flux" })).toBeNull();
  });

  it("règle la cadence avec ?debug", async () => {
    window.history.replaceState(null, "", "/pokemon?debug");
    await renderLive();
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "20" } });
    expect(screen.getByText("Cible 20 FPS")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Debug du flux" })).toBeInTheDocument();
  });
});

describe("stats du flux", () => {
  const now = 100000;
  const sample = (ago, extra) => ({ at: now - ago, ok: true, bytes: 2048, rttMs: 40, ageMs: 30, fresh: true, ...extra });

  it("sépare images nouvelles, doublons et erreurs, et estime le retard", () => {
    const samples = [
      sample(500), sample(1000), sample(1500, { fresh: false }), sample(2000, { fresh: false }),
      { at: now - 2500, ok: false, bytes: 0, rttMs: 3000, ageMs: null, fresh: false },
      sample(30000), // hors des 3 s, dans la minute
    ];
    const stats = computeStats(samples, { requests: 6, fresh: 3, bytes: 10240, errors: 1 }, [], now);

    expect(stats.requestsPerSec).toBeCloseTo(5 / 3);
    expect(stats.freshPerSec).toBeCloseTo(2 / 3);
    expect(stats.duplicateRatio).toBeCloseTo(0.5);
    expect(stats.rttMs).toBe(40);
    expect(stats.delayMs).toBe(50); // 30 ms d'âge + 40/2 de trajet
    expect(stats.minute).toEqual({ requests: 6, pushed: 0, cached: 0, fresh: 3, bytes: 5 * 2048, errors: 1, notModified: 0 });
    expect(stats.session.errors).toBe(1);
  });
});

describe("cadence demandée", () => {
  it("envoie la cadence au serveur", async () => {
    await renderLive();
    const frameUrl = fetchApi.mock.calls.map(([url]) => url).find((url) => url.startsWith("/api/pokemon/frame?"));
    expect(frameUrl).toMatch(/fps=30/);
  });

  it("le panneau montre demandé, reçu et latence", async () => {
    fetchApi.mockImplementation(async (url) =>
      url.startsWith("/api/pokemon/frame?")
        ? frameResponse()
        : { ok: true, json: async () => ({ success: true, captureFps: 12, targetFps: 12, maxFps: 30, captureMs: 15, viewers: 2 }) }
    );
    render(<Pokemon />);
    fireEvent.click(screen.getByRole("button", { name: "Stats du flux" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(screen.getByText("Demandé")).toBeInTheDocument();
    expect(screen.getByText("Reçu (nouvelles)")).toBeInTheDocument();
    expect(screen.getByText("Aller-retour")).toBeInTheDocument();
    expect(screen.getByText("12.0 img/s")).toBeInTheDocument();
    expect(screen.getByText(/2 spectateur/)).toBeInTheDocument();
  });
});

describe("joueurs en ligne", () => {
  it("montre qui joue et qui regarde, à tout le monde", async () => {
    fetchApi.mockImplementation(async (url) => {
      if (url.startsWith("/api/pokemon/frame?")) return frameResponse();
      if (url === "/api/pokemon/presence") {
        return { ok: true, json: async () => ({ playing: [{ name: "Alice Durand", lastButton: "A", secondsAgo: 4, devices: [{ type: "mobile", playing: true }, { type: "desktop", playing: false }] }], watching: [{ name: "Bob Martin", devices: [{ type: "desktop", playing: false }] }] }) };
      }
      return okResponse();
    });
    render(<Pokemon />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("Alice Durand")).toBeInTheDocument();
    expect(screen.getByText("A · il y a 4 s")).toBeInTheDocument();
    expect(screen.getByText("Bob Martin")).toBeInTheDocument();
    expect(screen.getByText("Regardent")).toBeInTheDocument();
    expect(screen.getByLabelText("téléphone (joue), ordinateur")).toBeInTheDocument();
  });

  it("invite à jouer quand personne ne joue", async () => {
    await renderLive();
    expect(screen.getByText(/Personne ne joue pour l'instant/)).toBeInTheDocument();
  });
});

describe("images inchangées", () => {
  it("renvoie l'empreinte connue et garde l'image sur un 304", async () => {
    let calls = 0;
    fetchApi.mockImplementation(async (url, options) => {
      if (!url.startsWith("/api/pokemon/frame?")) return okResponse();
      calls += 1;
      if (calls === 1) {
        return { ok: true, status: 200, headers: new Headers({ ETag: '"abc"' }), blob: async () => new Blob(["x"]) };
      }
      expect(options.headers["If-None-Match"]).toBe('"abc"');
      return { ok: false, status: 304, headers: new Headers({ ETag: '"abc"' }) };
    });
    render(<Pokemon />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(calls).toBeGreaterThan(2);
    expect(globalThis.createImageBitmap).toHaveBeenCalledTimes(1);
    expect(canvas.state.draws).toHaveLength(1);
    expect(screen.getByText("En direct")).toBeInTheDocument();
  });
});

describe("taille d'image", () => {
  it("ne compte pas les 304 vides dans la taille moyenne d'une image", () => {
    const now = 50000;
    const stats = computeStats([
      { at: now - 100, ok: true, bytes: 3000, rttMs: 20, ageMs: 10, fresh: true },
      { at: now - 200, ok: true, bytes: 0, rttMs: 20, ageMs: 10, fresh: false, unchanged: true },
      { at: now - 300, ok: true, bytes: 0, rttMs: 20, ageMs: 10, fresh: false, unchanged: true },
    ], { requests: 3, fresh: 1, bytes: 3000, errors: 0 }, [], now);
    expect(stats.bytesPerFrame).toBe(3000);
    expect(stats.notModifiedRatio).toBeCloseTo(2 / 3);
  });
});
