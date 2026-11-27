import { fireEvent, render, screen } from "@testing-library/react";
import { fetchApi } from "../utils/api";
import PokemonAnalyticsPanel, { formatBytes, formatMinutes } from "./PokemonAnalyticsPanel";

vi.mock("../utils/api", () => ({ fetchApi: vi.fn() }));

// Recharts mesure son conteneur ; jsdom n'a pas ResizeObserver.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const summary = {
  range: "7d",
  days: 7,
  totals: { players: 2, activePlayers: 1, sessions: 3, watchedMinutes: 95, playedMinutes: 12.5, inputs: 340, avgSessionMinutes: 31.7 },
  daily: [
    { day: "2026-11-26", watchedMinutes: 20, playedMinutes: 2, sessions: 1, players: 1 },
    { day: "2026-11-27", watchedMinutes: 75, playedMinutes: 10.5, sessions: 2, players: 2 },
  ],
  players: [
    { username: "alice", displayName: "Alice Durand", group: "G1", sessions: 2, watchedMinutes: 80, playedMinutes: 12.5, inputs: 340, lastSeenAt: "2026-11-27T10:00:00Z", devices: ["desktop", "mobile"] },
    { username: "bob", displayName: "Bob Martin", group: "G2", sessions: 1, watchedMinutes: 15, playedMinutes: 0, inputs: 0, lastSeenAt: "2026-11-26T10:00:00Z", devices: ["mobile"] },
  ],
  technical: {
    serverBytes: 52428800, clientBytes: 50000000, serverFrames: 9000, bytesPerSession: 17476267, bytesPerMinute: 551882,
    rttAvgMs: 84, rttP95Ms: 200, rttSamples: 400, delayAvgMs: 130, fpsAvg: 7.5, sseTimeShare: 80,
    rttHistogram: [{ label: "≤ 50 ms", count: 100 }, { label: "≤ 100 ms", count: 300 }],
    modes: { sse: 2, polling: 0, mixed: 1 }, devices: { mobile: 2, desktop: 1 },
    deviceWatchedMinutes: { mobile: 40, desktop: 55 },
    buttons: [{ button: "A", count: 200, share: 59 }, { button: "UP", count: 140, share: 41 }],
  },
};

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, summary: data }) });

beforeEach(() => fetchApi.mockReset());

test("affiche indicateurs, classement et partie technique", async () => {
  fetchApi.mockResolvedValue(ok(summary));
  render(<PokemonAnalyticsPanel initialRange="7d" />);
  expect(await screen.findByText("Joueurs uniques")).toBeInTheDocument();
  expect(fetchApi).toHaveBeenCalledWith("/api/analytics/admin/pokemon/summary?range=7d&hideExcluded=true");
  expect(screen.getByText("1 h 35")).toBeInTheDocument();
  expect(screen.getByText("340", { selector: "p" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Alice Durand" })).toHaveAttribute("href", "/analytics/admin/users/alice?module=pokemon");
  expect(screen.getByText("Ordinateur, Téléphone")).toBeInTheDocument();
  expect(screen.getByText("50 Mo")).toBeInTheDocument();
  expect(screen.getByText("200 ms")).toBeInTheDocument();
  expect(screen.getByText("Flux SSE (temps regardé)")).toBeInTheDocument();

  // Tri par inputs croissants : Bob passe devant.
  const inputsHeader = screen.getByRole("button", { name: "Inputs" });
  fireEvent.click(inputsHeader);
  fireEvent.click(inputsHeader);
  const links = screen.getAllByRole("link").map((link) => link.textContent);
  expect(links).toEqual(["Bob Martin", "Alice Durand"]);
});

test("change de période et signale une route absente", async () => {
  fetchApi.mockResolvedValueOnce(ok(summary)).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
  render(<PokemonAnalyticsPanel />);
  await screen.findByText("Joueurs uniques");
  fireEvent.click(screen.getByRole("button", { name: "7 jours" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("backend doit être mis à jour");
  expect(fetchApi).toHaveBeenLastCalledWith("/api/analytics/admin/pokemon/summary?range=7d&hideExcluded=true");
});

test("formats lisibles", () => {
  expect(formatMinutes(45)).toBe("45 min");
  expect(formatMinutes(125)).toBe("2 h 05");
  expect(formatBytes(0)).toBe("0 o");
  expect(formatBytes(1536)).toBe("1,5 Ko");
});
