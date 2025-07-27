const CACHE_NAME = "tipply-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/images/1dollar.png",
  "/images/5dollars.png",
  "/images/10dollars.png",
  "/images/20dollars.png",
  "/images/50dollars.png",
  "/images/100dollars.png",
  "/sound/cashRegisterSound.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
