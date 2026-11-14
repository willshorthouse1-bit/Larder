// Service worker: works offline and sends background reminders where supported.

const VERSION = 'larder-v1';
const DATA_CACHE = 'larder-data';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'src/app.js',
  'src/store.js',
  'src/dates.js',
  'src/inventory.js',
  'src/shelfLife.js',
  'src/recipes.js',
  'src/ui/util.js',
  'src/ui/kitchen.js',
  'src/ui/recipesView.js',
  'src/ui/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first for the app's own files so updates arrive; cache when offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});

/* ---------- Background reminder (installed Chromium apps) ---------- */

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(iso, today) {
  const utc = (s) => Date.UTC(...s.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
  return Math.round((utc(iso) - utc(today)) / 86400000);
}

async function backgroundRemind() {
  const cache = await caches.open(DATA_CACHE);
  const today = isoToday();
  const notified = await (await cache.match('notified'))?.json();
  if (notified === today) return;
  const digest = await (await cache.match('digest'))?.json();
  if (!digest?.notify) return;
  const soon = digest.items
    .filter((i) => i.location !== 'freezer')
    .filter((i) => {
      const d = daysUntil(i.expiresOn, today);
      return d >= 0 && d <= 2;
    })
    .map((i) => i.name.toLowerCase());
  if (!soon.length) return;
  const names = soon.slice(0, 4);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  await self.registration.showNotification('Food to use up', {
    body: `Use the ${list}${soon.length > 4 ? ` and ${soon.length - 4} more` : ''} soon.`,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'larder-daily',
  });
  await cache.put('notified', new Response(JSON.stringify(today)));
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'larder-daily') event.waitUntil(backgroundRemind());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windows) => {
      const open = windows.find((w) => 'focus' in w);
      return open ? open.focus() : self.clients.openWindow('./');
    }),
  );
});
