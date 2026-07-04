const CACHE_NAME = "contento-shell-v3";
const SHELL_ASSETS = [
  "/",
  "/offline.html",
  "/favicon.ico",
  "/favicon.svg",
  "/brand/contento-mark.svg",
  "/brand/contento-icon.svg",
  "/brand/contento-logo.svg",
  "/brand/contento-logo-dark.svg",
  "/brand/contento-logo-light.svg",
  "/android-192.png",
  "/android-512.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};

  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Contento", body: event.data.text() };
  }

  const title = payload.title || "Contento";
  const options = {
    body: payload.body || payload.message || "You have a new workspace update.",
    icon: "/android-192.png",
    badge: "/android-192.png",
    data: {
      url: payload.url || payload.link_href || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
