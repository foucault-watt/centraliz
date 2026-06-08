const CACHE_NAME = "centraliz-v1";
const DEFAULT_ICON = "/web-app-manifest-192x192.png";

self.addEventListener("install", () => {
  console.log("Service Worker: Installed");
});

self.addEventListener("activate", () => {
  console.log("Service Worker: Activated");
});

self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch (error) {
      return {};
    }
  })();

  const title = payload.title || "Centraliz";
  const options = {
    body: payload.body || "Nouvelle notification",
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_ICON,
    image: payload.image || undefined,
    tag: payload.tag || "centraliz-notification",
    requireInteraction: Boolean(payload.requireInteraction),
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const clickUrl = event.notification?.data?.clickUrl || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.navigate(clickUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(clickUrl);
      }

      return undefined;
    }),
  );
});
