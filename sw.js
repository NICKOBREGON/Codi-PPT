const CACHE = "trauma-team-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // {cache:"reload"} fuerza que estos archivos se pidan frescos a la red
      // al instalar el service worker, en vez de coger una copia intermedia.
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// El HTML (la app en sí) se pide siempre a la red primero, para que un
// deployment nuevo se vea al instante. Si no hay conexión, usa la copia
// guardada como respaldo. El resto (iconos, manifest) sí usa la copia
// guardada primero, para poder abrir la app offline sin esperas.
self.addEventListener("fetch", (e) => {
  const isHTML = e.request.mode === "navigate" || e.request.destination === "document";

  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
  }
});
