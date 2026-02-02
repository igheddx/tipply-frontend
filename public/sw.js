const CACHE_NAME = "tipply-v7";
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const urlsToCache = [
  "/",
  "/index.html",
  "/device-setup",
  "/manifest.json",
  "/images/1dollar.png",
  "/images/5dollars.png",
  "/images/10dollars.png",
  "/images/20dollars.png",
  "/images/50dollars.png",
  "/images/100dollars.png",
  "/images/plain-button-google-pay.png",
  "/sound/cashRegisterSound.mp3",
];

// Install event - cache core assets
self.addEventListener("install", (event) => {
  console.log('[SW] Installing service worker...');
  if (IS_DEV) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(urlsToCache);
    }).then(() => {
      console.log('[SW] Skip waiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    (IS_DEV ? Promise.resolve() : caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first for device setup, cache first for assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for non-GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // In development, always go to network first and do not cache
  if (IS_DEV) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Never cache API calls - always fetch fresh from network
  if (url.pathname.startsWith('/api/') || url.href.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Network first strategy for device setup page
  if (url.pathname === '/device-setup') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache first for static assets
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          if (fetchResponse && fetchResponse.status === 200) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, fetchResponse.clone());
              return fetchResponse;
            });
          }
          return fetchResponse;
        });
      })
    );
  }
});
