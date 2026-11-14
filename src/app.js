// Entry point: routing, re-rendering on change, reminders, offline support.

import { getState, subscribe } from './store.js';
import { toISODate } from './dates.js';
import { useSoon } from './inventory.js';
import { renderKitchen } from './ui/kitchen.js';
import { renderRecipes } from './ui/recipesView.js';
import { renderSettings } from './ui/settings.js';
import { $, listNames } from './ui/util.js';

const ROUTES = {
  kitchen: renderKitchen,
  recipes: renderRecipes,
  settings: renderSettings,
};

function currentRoute() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: ROUTES[path] ? path : 'kitchen', params: new URLSearchParams(query) };
}

function render() {
  const { name, params } = currentRoute();
  const main = $('#main');
  const scroll = window.scrollY;
  ROUTES[name](main, params);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.toggleAttribute('aria-current', a.dataset.route === name);
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page');
  });
  document.title = name === 'kitchen' ? 'Larder' : `${name[0].toUpperCase()}${name.slice(1)} · Larder`;
  window.scrollTo(0, scroll);
}

let lastRoute = '';
window.addEventListener('hashchange', () => {
  const { name } = currentRoute();
  render();
  if (name !== lastRoute) window.scrollTo(0, 0);
  lastRoute = name;
});

subscribe(() => {
  // Don't rebuild the page under an open sheet; refresh once it closes.
  if ($('#sheet').open) return;
  render();
});
$('#sheet').addEventListener('close', render);

/* ---------- Daily reminder ---------- */
// The page and the service worker share two small entries in Cache Storage:
// a digest of what's in the kitchen (so background checks can run without the
// page) and the date of the last reminder (so you get at most one a day).

const DATA_CACHE = 'larder-data';

async function cacheGet(key) {
  if (!('caches' in window)) return null;
  const response = await (await caches.open(DATA_CACHE)).match(key);
  return response ? response.json() : null;
}

async function cachePut(key, value) {
  if (!('caches' in window)) return;
  await (await caches.open(DATA_CACHE)).put(key, new Response(JSON.stringify(value)));
}

function syncDigest() {
  const { settings, items } = getState();
  cachePut('digest', {
    notify: settings.notify,
    items: items.map(({ name, expiresOn, location }) => ({ name, expiresOn, location })),
  }).catch(() => {});
}

async function remind() {
  const { settings, items } = getState();
  const today = toISODate();
  if (!settings.notify) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ((await cacheGet('notified').catch(() => null)) === today) return;
  const soon = useSoon(items, today);
  if (!soon.length) return;
  const body = `Use the ${listNames(soon.slice(0, 4).map((i) => i.name.toLowerCase()))}${soon.length > 4 ? ` and ${soon.length - 4} more` : ''} soon.`;
  const options = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'larder-daily' };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification('Food to use up', options);
    else new Notification('Food to use up', options);
    await cachePut('notified', today);
  } catch (error) {
    console.warn('Reminder failed', error);
  }
}

subscribe(syncDigest);
syncDigest();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    render(); // dates may have rolled over
    remind();
  }
});

/* ---------- Offline ---------- */

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(async (registration) => {
    // Where supported (installed Chromium PWAs), check for reminders in the background too.
    try {
      if ('periodicSync' in registration) {
        const { state } = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (state === 'granted') await registration.periodicSync.register('larder-daily', { minInterval: 12 * 60 * 60 * 1000 });
      }
    } catch {
      /* optional */
    }
  });
}

lastRoute = currentRoute().name;
render();
remind();
