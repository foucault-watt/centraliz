import { fetchApi } from "./api";

export const trackProductEvent = (
  eventName,
  module,
  properties = {},
  { eventType = "interaction", isAutomatic = false } = {},
) => {
  if (!eventName || !module) return;

  fetchApi("/api/analytics/track", {
    method: "POST",
    keepalive: true,
    body: JSON.stringify({
      eventName,
      module,
      eventType,
      isAutomatic,
      properties,
    }),
  }).catch((error) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Analytics] Tracking ignored:", error);
    }
  });
};
