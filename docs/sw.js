const CACHE_VERSION = "2026-07-29.1";
const CACHE_PREFIX = "navnestatistikk-pwa";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const SHELL_PATHS = [
  "./",
  "./index.html",
  "./styles.css",
  "./mobile-redesign.css",
  "./concept-2026.css",
  "./app.js",
  "./sw.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./vendor/plotly-2.35.2.min.js",
  "./assets/names-data.json",
  "./assets/illustrations/mobile-mascot-sprite-v1.png",
  "./assets/illustrations/botanical-sprite-v1.png",
];

const SHELL_URLS = new Set(SHELL_PATHS.map((path) => new URL(path, self.registration.scope).href));
const INDEX_URL = new URL("./index.html", self.registration.scope).href;
const NETWORK_FIRST_EXTENSIONS = new Set([".html", ".css", ".js"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL_PATHS.map((path) => new Request(new URL(path, self.registration.scope), { cache: "reload" })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(INDEX_URL, response.clone());
          return response;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(INDEX_URL)) || (await caches.match(INDEX_URL));
        }
      })(),
    );
    return;
  }

  if (!SHELL_URLS.has(url.href)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      if (shouldUseNetworkFirst(url)) {
        try {
          const response = await fetch(request);
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return (await cache.match(request)) || (await caches.match(INDEX_URL));
        }
      }
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }
      const network = await networkPromise;
      if (network) return network;
      return (await cache.match(request)) || (await caches.match(INDEX_URL));
    })(),
  );
});

function shouldUseNetworkFirst(url) {
  if (url.pathname.endsWith("/")) return true;
  return [...NETWORK_FIRST_EXTENSIONS].some((extension) => url.pathname.endsWith(extension));
}
