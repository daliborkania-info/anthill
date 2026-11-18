// Service worker pro nainstalovanou aplikaci (PWA).
// Když je server dostupný, bere se čerstvá verze ze sítě a uloží se do mezipaměti; bez sítě se použije poslední uložená.
const CACHE = 'mraveniste-1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  // každý soubor zvlášť, ať jeden chybějící nezmaří instalaci
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => { })))));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method != 'GET' || new URL(r.url).origin != location.origin) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || (r.mode == 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
