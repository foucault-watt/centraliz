import { render, screen } from "@testing-library/react";
import { fetchApi } from "../utils/api";
import MuseeAnalyticsPanel from "./MuseeAnalyticsPanel";

vi.mock("../utils/api", () => ({ fetchApi: vi.fn() }));
test("renders anonymous and connected players plus the level cohort", async () => {
  fetchApi.mockResolvedValue({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ success: true, summary: {
    players: 2, accounts: 1, anonymousBrowsers: 1, sessions: 2, playClicks: 2, readySessions: 2,
    levels: [{ levelId: "ch1_1", players: 2, starts: 2, completions: 1, completionRate: 50, unfinished: 1,
      medianCompletionSeconds: 120, moves: 10, detailViews: 3, answerReveals: 1 }],
    participants: [{ account: "alice", label: "alice", levelsStarted: ["ch1_1"], levelsCompleted: ["ch1_1"], activeSeconds: 120 }],
  } }) });
  render(<MuseeAnalyticsPanel range="7d" />);
  expect(await screen.findByText("50 %")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "alice" })).toHaveAttribute("href", "/analytics/admin/users/alice?module=musee");
  expect(fetchApi).toHaveBeenCalledWith("/api/analytics/musee/summary?range=7d&hideExcluded=true");
});


test("HTML 404 from a missing backend route gives an actionable message without JSON parsing", async () => {
  const json = vi.fn().mockRejectedValue(new SyntaxError("Unexpected token '<'"));
  fetchApi.mockResolvedValue({ ok: false, status: 404, headers: { get: () => "text/html; charset=utf-8" }, json });
  render(<MuseeAnalyticsPanel />);
  expect(await screen.findByRole("alert")).toHaveTextContent("backend Centraliz doit être mis à jour");
  expect(json).not.toHaveBeenCalled();
});
