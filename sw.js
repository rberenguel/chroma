// Generated with get_cache.go — run `go run get_cache.go` to regenerate.
const CACHE_NAME = "chroma-v0.2.1";
const CACHE_FILES = [
  "./base.js",
  "./favicon.ico",
  "./fonts/Phosphor-Light.woff2",
  "./fonts/phosphor.css",
  "./icon.png",
  "./index.html",
  "./libs/pixi8.1.5.min.js",
  "./manifest.json",
  "./src/AnimationConstants.js",
  "./src/ColorLogic.js",
  "./src/ColorNames.js",
  "./src/Grid.js",
  "./src/LevelConfig.js",
  "./src/PulseSystem.js",
  "./src/Tile.js",
  "./src/haptic.js",
  "./styles.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of CACHE_FILES) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("chroma SW: failed to cache", url, err);
        }
      }
      return self.skipWaiting();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.map((n) => n !== CACHE_NAME && caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});
