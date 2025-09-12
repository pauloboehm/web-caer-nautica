const CACHE_NAME = "rastreador-gpx-v1";
const URLS_TO_CACHE = [
  "/",
  "/rastreador3.html",
  "/firedb.js",
  "/appinstall.js",
  "/circuitcanvas.js",
  "/icons/nautica192.png",
  "/icons/nautica512.png"
];

// Instala e guarda os arquivos no cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

// Intercepta requisições e serve do cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
