// Construtrack — Service Worker (funcionamento offline em campo)
const CACHE = 'construtrack-v2.1.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API e geocoding: sempre rede, nunca cache
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.host.includes('nominatim')) return;

  // App shell (index): rede primeiro para pegar atualizações; cache como reserva offline
  if (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Demais recursos (ícones, fontes Google): cache primeiro, rede como complemento
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      const cacheavel = r.ok && (url.origin === location.origin ||
        url.host.includes('fonts.googleapis.com') || url.host.includes('fonts.gstatic.com') ||
        url.host.includes('cdn.sheetjs.com'));
      if (cacheavel) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }))
  );
});
