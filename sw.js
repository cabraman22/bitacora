/* Bitácora — service worker
   La app (index.html) va SIEMPRE a la red primero, para que al reemplazar el
   archivo la actualización llegue sola en el siguiente arranque. Si no hay
   internet, cae a la copia guardada. Los iconos sí van desde caché.
*/
const CACHE = 'bitacora-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isApp = (req, url) =>
  req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Los catálogos (RAWG, Scryfall, Open Library) y la API van directo a la red.
  if (url.origin !== self.location.origin) return;

  if (isApp(req, url)) {
    // red primero: así una versión nueva se ve al reabrir
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // el resto (iconos, manifest): caché primero, se refresca por detrás
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
