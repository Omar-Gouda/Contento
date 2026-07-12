const CACHE_NAME = "contento-shell-v4";
const OFFLINE_URL = "/offline.html";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const SHELL_ASSETS = [
  OFFLINE_URL,
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

function isLocalDevelopment() {
  return LOCAL_HOSTNAMES.has(self.location.hostname);
}

function isNextOrActionRequest(request, url) {
  return (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    request.headers.has("Next-Action") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Accept")?.includes("text/x-component")
  );
}

function shouldBypassRequest(request, url) {
  return (
    isLocalDevelopment() ||
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    isNextOrActionRequest(request, url)
  );
}

async function fetchNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function fetchStaticAsset(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.status === 200 && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("contento-") && key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (shouldBypassRequest(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetchNavigation(request));
    return;
  }

  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(fetchStaticAsset(request));
  }
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
