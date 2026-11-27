import { act, fireEvent, render, screen } from "@testing-library/react";
import Musee from "./Musee";

let media;
beforeEach(() => {
  media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  window.matchMedia = vi.fn(query => (query.includes("display-mode") ? { matches: false } : media));
});

test("downloads the game only after the player chooses to play", () => {
  render(<Musee />);
  expect(screen.queryByTitle("Le Musée — jeu")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
  expect(screen.getByTitle("Le Musée — jeu")).toHaveAttribute("src", "/games/le-musee/index.html");
  expect(screen.getByRole("button", { name: "Plein écran" })).toBeInTheDocument();
});

describe("on a phone or tablet", () => {
  const supportFullscreen = () => {
    document.fullscreenEnabled = true;
    Element.prototype.requestFullscreen = vi.fn(() => Promise.resolve());
  };
  beforeEach(() => { media.matches = true; });
  afterEach(() => {
    delete document.fullscreenEnabled;
    delete Element.prototype.requestFullscreen;
    document.body.style.overflow = "";
  });

  test("the game opens in fullscreen from the tap on Jouer", () => {
    supportFullscreen();
    render(<Musee />);
    expect(screen.queryByTitle("Le Musée — jeu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
    const player = screen.getByTitle("Le Musée — jeu").parentElement;
    expect(player).toHaveClass("musee-player--immersive");
    expect(Element.prototype.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(Element.prototype.requestFullscreen.mock.instances[0]).toBe(player);
  });

  test("without the Fullscreen API the player still covers the page and explains why", () => {
    render(<Musee />);
    expect(screen.getByText(/ne propose pas le vrai plein écran/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
    expect(screen.getByTitle("Le Musée — jeu").parentElement).toHaveClass("musee-player--immersive");
    expect(screen.queryByRole("button", { name: "Plein écran" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  test("a refused fullscreen keeps the game running and says so on a retry", async () => {
    supportFullscreen();
    Element.prototype.requestFullscreen.mockImplementation(() => Promise.reject(new Error("denied")));
    render(<Musee />);
    fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
    expect(screen.getByTitle("Le Musée — jeu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Plein écran" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Plein écran indisponible");
    expect(screen.getByTitle("Le Musée — jeu")).toBeInTheDocument();
  });

  test("leaving native fullscreen offers it again", () => {
    supportFullscreen();
    render(<Musee />);
    fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
    document.fullscreenElement = document.body;
    fireEvent(document, new Event("fullscreenchange"));
    expect(screen.queryByRole("button", { name: "Plein écran" })).not.toBeInTheDocument();
    delete document.fullscreenElement;
    fireEvent(document, new Event("fullscreenchange"));
    expect(screen.getByRole("button", { name: "Plein écran" })).toBeInTheDocument();
  });

  test("Quitter unloads the game and gives the page back", () => {
    render(<Musee />);
    fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitter" }));
    expect(screen.queryByTitle("Le Musée — jeu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jouer" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});

test("a format change during a game keeps the same iframe running", () => {
  render(<Musee />);
  fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
  const game = screen.getByTitle("Le Musée — jeu");
  const update = media.addEventListener.mock.calls[0][1];
  media.matches = true;
  act(() => update());
  expect(screen.getByTitle("Le Musée — jeu")).toBe(game);
  expect(game.parentElement).toHaveClass("musee-player--immersive");
  media.matches = false;
  act(() => update());
  expect(screen.getByTitle("Le Musée — jeu")).toBe(game);
  expect(game.parentElement).not.toHaveClass("musee-player--immersive");
});

test("offers a new tab on the same page when fullscreen is unavailable", async () => {
  window.history.replaceState({}, "", "/le-musee");
  render(<Musee />);
  fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
  fireEvent.click(screen.getByRole("button", { name: "Plein écran" }));
  expect(await screen.findByRole("status")).toHaveTextContent("plein écran est indisponible");
  expect(screen.getByRole("link", { name: "Nouvel onglet" })).toHaveAttribute("href", "/le-musee");
  window.history.replaceState({}, "", "/");
});
