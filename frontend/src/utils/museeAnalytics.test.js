import { createMuseeTracker } from "./museeAnalytics";
import { fetchApi } from "./api";
vi.mock("./api", () => ({ fetchApi: vi.fn() }));

beforeEach(() => {
  fetchApi.mockReset().mockResolvedValue({ ok: true });
  Object.defineProperty(window, "crypto", { configurable: true, value: { randomUUID: () => "00000000-0000-4000-8000-000000000001" } });
});

test("accepts only the expected iframe and same-origin game messages", () => {
  const tracker = createMuseeTracker();
  const iframe = { contentWindow: {} };
  const data = { channel: "le-musee", version: 1, eventName: "musee_level_started", properties: { level_id: "ch1_1", attempt_id: "a" } };
  tracker.play();
  tracker.message({ origin: "https://untrusted.test", source: iframe.contentWindow, data }, iframe);
  tracker.message({ origin: window.location.origin, source: {}, data }, iframe);
  expect(fetchApi).toHaveBeenCalledTimes(1);
  tracker.message({ origin: window.location.origin, source: iframe.contentWindow, data }, iframe);
  tracker.message({ origin: window.location.origin, source: iframe.contentWindow, data }, iframe);
  expect(fetchApi).toHaveBeenCalledTimes(2);
  const payload = JSON.parse(fetchApi.mock.calls[1][1].body);
  expect(payload.properties.level_id).toBe("ch1_1");
  expect(payload.properties.session_id).toBeTruthy();
});

test("does not resend cumulative state on repeated pagehide or throw on tracking failures", () => {
  fetchApi.mockRejectedValue(new Error("offline"));
  const tracker = createMuseeTracker();
  const iframe = { contentWindow: {} };
  tracker.play();
  tracker.message({ origin: window.location.origin, source: iframe.contentWindow,
    data: { channel: "le-musee", version: 1, eventName: "musee_level_started", properties: { level_id: "ch1_1", attempt_id: "a" } } }, iframe);
  tracker.close(); tracker.close();
  expect(fetchApi).toHaveBeenCalledTimes(3);
});
