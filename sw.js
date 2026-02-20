const CACHE_NAME = 'im-ready-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './icon-192x192.png',
  './icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'
];

// Install — cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.log('Cache addAll failed, caching individually');
        return caches.open(CACHE_NAME).then(cache => {
          return Promise.allSettled(
            ASSETS_TO_CACHE.map(url => cache.add(url).catch(() => console.log('Failed to cache:', url)))
          );
        });
      })
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API calls (Gemini, ElevenLabs, etc.)
  const url = new URL(event.request.url);
  if (url.hostname.includes('googleapis.com') && url.pathname.includes('/v1beta/')) return;
  if (url.hostname.includes('elevenlabs.io')) return;
  if (url.hostname.includes('api.anthropic.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then(cached => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
