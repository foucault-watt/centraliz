import { fetchApi } from "../../utils/api";
import { recordFrame, recordRtt, resetSessionStatsForTests, sendSummary, takeSummary } from "./sessionStats";

vi.mock("../../utils/api", () => ({ fetchApi: vi.fn(() => Promise.resolve({ ok: true })) }));

beforeEach(() => {
  resetSessionStatsForTests();
  fetchApi.mockClear();
});

test("résume les mesures depuis le précédent envoi", () => {
  expect(takeSummary()).toBeNull();
  recordRtt(40);
  recordRtt(120);
  recordRtt(5000);
  recordFrame({ bytes: 1000, ageMs: 50, rttMs: 100 });
  recordFrame({ bytes: 500, ageMs: null });
  const summary = takeSummary();
  expect(summary.rttHist).toEqual([1, 0, 1, 0, 0, 0, 0, 0, 0, 1]);
  expect(summary.rttSum).toBe(5160);
  expect(summary).toMatchObject({ frames: 2, bytes: 1500, delaySum: 100, delayCount: 1 });
  expect(takeSummary()).toBeNull();
});

test("envoie par sendBeacon en text/plain, sinon par fetch", async () => {
  const beacon = vi.fn(() => true);
  Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
  recordFrame({ bytes: 10 });
  expect(sendSummary({ beacon: true })).toBe(true);
  expect(beacon).toHaveBeenCalledTimes(1);
  const [url, blob] = beacon.mock.calls[0];
  expect(url).toMatch(/\/api\/pokemon\/session-stats$/);
  expect(blob.type).toBe("text/plain");
  expect(fetchApi).not.toHaveBeenCalled();

  expect(sendSummary()).toBe(false); // rien de neuf
  recordRtt(30);
  sendSummary();
  await Promise.resolve();
  expect(fetchApi).toHaveBeenCalledWith("/api/pokemon/session-stats", expect.objectContaining({ method: "POST", keepalive: true }));
});
