// Service worker GesMinArt Mobile : coque applicative + fonds de carte en cache pour l'usage hors couverture.
const V = 'idm-m-v2';
const CORE = ['/GesMinArt_Public/m/', '/GesMinArt_Public/m/m.js', '/GesMinArt_Public/m/m.css', '/GesMinArt_Public/m/manifest.webmanifest', '/GesMinArt_Public/css/app.css', '/GesMinArt_Public/js/hw.js', '/GesMinArt_Public/js/ui.js', '/GesMinArt_Public/js/map.js', '/GesMinArt_Public/js/rdcmap.js', '/GesMinArt_Public/js/card.js', '/GesMinArt_Public/vendor/qrcode.js', '/GesMinArt_Public/vendor/leaflet.js', '/GesMinArt_Public/vendor/leaflet.css', '/GesMinArt_Public/vendor/images/marker-icon.png', '/GesMinArt_Public/vendor/images/layers.png', '/GesMinArt_Public/data/provinces.geojson', '/GesMinArt_Public/data/territoires.geojson', '/GesMinArt_Public/img/rdc-map.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(caches.open(V).then(async c => { const hit = await c.match(e.request, { ignoreSearch: true }); const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null); return hit || (await net) || new Response('Hors ligne', { status: 503 }); }));
});

// Synchronisation en arrière-plan (Background Sync) : demande aux pages ouvertes de vider la file d'opérations dès que le réseau revient.
self.addEventListener('sync', e => { if (e.tag === 'idm-sync') e.waitUntil(self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage('idm-sync')))); });
