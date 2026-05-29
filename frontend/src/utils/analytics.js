import { fetchApi } from "./api";

const routeModules = [
  { pattern: /^\/calendars/, module: "calendars", route: "/calendars" },
  { pattern: /^\/notes/, module: "notes", route: "/notes" },
  { pattern: /^\/communication/, module: "communication", route: "/communication" },
  { pattern: /^\/links/, module: "links", route: "/links" },
  { pattern: /^\/events\/association\//, module: "events", route: "/events/association/:slug" },
  { pattern: /^\/events\/admin/, module: "events", route: "/events/admin" },
  { pattern: /^\/events\/create/, module: "events", route: "/events/create" },
  { pattern: /^\/events/, module: "events", route: "/events" },
  { pattern: /^\/cekilui/, module: "cekilui", route: "/cekilui" },
  { pattern: /^\/pokemon/, module: "pokemon", route: "/pokemon" },
  { pattern: /^\/feedback/, module: "feedback", route: "/feedback" },
  { pattern: /^\/help/, module: "help", route: "/help" },
  { pattern: /^\/bibli/, module: "bibli", route: "/bibli" },
  { pattern: /^\/campaigns\/admin/, module: "campaigns", route: "/campaigns/admin" },
  { pattern: /^\/analytics\/admin/, module: "analytics", route: "/analytics/admin" },
];

export const getRouteAnalytics = (pathname) =>
  routeModules.find((entry) => entry.pattern.test(pathname));

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
