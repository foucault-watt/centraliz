import { render, screen, waitFor } from "@testing-library/react";
import { fetchApi } from "../utils/api";

vi.mock("../utils/api", () => ({
  fetchApi: vi.fn(), clearStoredUserSecretSalt: vi.fn(), storeUserSecretSalt: vi.fn(), syncUserSecretSalt: vi.fn(), getStoredUserSecretSalt: vi.fn(),
}));
vi.mock("./Musee", () => ({ default: () => <div>Jeu public du Musée</div> }));

let App;
beforeAll(async () => {
  // App reads the build flag when it is imported.
  process.env.REACT_APP_MUSEE_ENABLED = "true";
  App = (await import("../App")).default;
});

afterEach(() => window.history.replaceState({}, "", "/"));

test("the shared URL renders without requesting a login session", async () => {
  window.history.replaceState({}, "", "/musee");
  render(<App />);
  expect(await screen.findByText("Jeu public du Musée")).toBeInTheDocument();
  expect(fetchApi).not.toHaveBeenCalled();
});

test("the app's own page survives a reload: logged in, with the menu, on /le-musee", async () => {
  fetchApi.mockResolvedValue({ ok: true, json: async () => ({ authenticated: true, user: {} }) });
  window.history.replaceState({}, "", "/le-musee");
  render(<App />);
  expect(await screen.findByText("Jeu public du Musée")).toBeInTheDocument();
  expect(fetchApi).toHaveBeenCalledWith("/api/auth/status");
  expect(screen.getByRole("link", { name: "Le Musée" })).toHaveAttribute("href", "/le-musee");
});

test("reaching /musee from inside the app does not switch to the public page on re-render", async () => {
  fetchApi.mockResolvedValue({ json: async () => ({ authenticated: false }) });
  window.history.replaceState({}, "", "/");
  const { rerender } = render(<App />);
  await waitFor(() => expect(fetchApi).toHaveBeenCalled());
  window.history.pushState({}, "", "/musee");
  rerender(<App />);
  expect(screen.queryByText(/Chargement du Musée|Jeu public du Musée/)).not.toBeInTheDocument();
});
