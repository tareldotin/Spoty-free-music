/* ==========================================================================
   sw.js — offline app shell + thumbnail cache
   Strategy
     • navigation  → network first, fall back to cached index.html (offline shell)
     • same-origin static assets → stale-while-revalidate
     • YouTube thumbnails (i.ytimg.com) → cache first, trimmed to 300 entries
   Everything else (YouTube API, proxies, the IFrame player) is always network.
   ========================================================================== */

const VERSION = 'spotifree-v2';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';
const IMAGES = VERSION + '-images';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/util.js',
  './assets/js/db.js',
  './assets/js/api.js',
  './assets/js/store.js',
  './assets/js/player.js',
  './assets/js/i18n.js',
  './assets/js/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const IMG_MAX = 300;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.allSettled(SHELL_FILES.map((f) => c.add(new Request(f, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('spotifree-') && k !== SHELL && k !== RUNTIME && k !== IMAGES)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

async function trimImages() {
  const c = await caches.open(IMAGES);
  const keys = await c.keys();
  if (keys.length <= IMG_MAX) return;
  await Promise.all(keys.slice(0, keys.length - IMG_MAX).map((k) => c.delete(k)));
}

async function cacheFirstImage(req) {
  const c = await caches.open(IMAGES);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req, { mode: 'cors', credentials: 'omit' });
    if (res && (res.ok || res.type === 'opaque')) {
      c.put(req, res.clone()).then(trimImages).catch(() => {});
    }
    return res;
  } catch (err) {
    return hit || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // never touch the player or the live APIs
  if (url.hostname.includes('youtube.com') && !url.hostname.includes('ytimg')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('googlevideo.com')) return;

  // thumbnails
  if (url.hostname.endsWith('ytimg.com')) {
    e.respondWith(cacheFirstImage(req));
    return;
  }

  // app shell / same origin
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith((async () => {
        try {
          const fresh = await fetch(req);
          const c = await caches.open(RUNTIME);
          c.put('./index.html', fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const c = await caches.open(SHELL);
          return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
        }
      })());
      return;
    }
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = await c.match(req);
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const rc = caches.open(RUNTIME); rc.then((x) => x.put(req, res.clone())).catch(() => {}); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })());
  }
});
