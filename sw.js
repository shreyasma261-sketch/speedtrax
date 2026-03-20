const CACHE = 'speedtrax-v3';
const BASE = 'https://shreyasma261-sketch.github.io/speedtrax';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  BASE + '/screenshot.png',
  BASE + '/screenshot-wide.png'
];

// ── Install: pre-cache all assets ────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(u => c.add(new Request(u, {cache: 'reload'})))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first with network fallback ──────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          if (r && r.status === 200 && (r.type === 'basic' || r.type === 'cors')) {
            cache.put(e.request, r.clone());
          }
          return r;
        }).catch(() => cache.match(BASE + '/'));
      })
    )
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'SpeedTrax', {
    body: d.body || 'New update available',
    icon: BASE + '/icon-192.png',
    badge: BASE + '/icon-192.png',
    tag: 'speedtrax-notification',
    renotify: true,
    data: {url: d.url || BASE + '/'}
  }));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || BASE + '/'));
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-trips') {
    e.waitUntil(syncTripData());
  }
});

async function syncTripData() {
  try {
    const cache = await caches.open(CACHE);
    await cache.add(new Request(BASE + '/', {cache: 'reload'}));
    const clients_ = await self.clients.matchAll();
    clients_.forEach(c => c.postMessage({type: 'SYNC_READY'}));
  } catch(e) {}
}

// ── Periodic Background Sync ──────────────────────────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'update-speedtrax') {
    e.waitUntil(syncTripData());
  }
});

// ── Share target handler ──────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.searchParams.has('share') && e.request.method === 'GET') {
    e.respondWith(Response.redirect(BASE + '/'));
  }
});
