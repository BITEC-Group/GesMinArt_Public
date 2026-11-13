// Service worker GesMinArt Mobile : coque applicative + fonds de carte en cache pour l'usage hors couverture.
const V = 'idm-m-v2';
const CORE = ['/m/', '/m/m.js', '/m/m.css', '/m/manifest.webmanifest', '/css/app.css', '/js/hw.js', '/js/ui.js', '/js/map.js', '/js/rdcmap.js', '/js/card.js', '/vendor/qrcode.js', '/vendor/leaflet.js', '/vendor/leaflet.css', '/vendor/images/marker-icon.png', '/vendor/images/layers.png', '/data/provinces.geojson', '/data/territoires.geojson', '/img/rdc-map.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(caches.open(V).then(async c => { const hit = await c.match(e.request, { ignoreSearch: true }); const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null); return hit || (await net) || new Response('Hors ligne', { status: 503 }); }));
});

// Synchronisation en arrière-plan (Background Sync) : demande aux pages ouvertes de vider la file d'opérations dès que le réseau revient.
self.addEventListener('sync', e => { if (e.tag === 'idm-sync') e.waitUntil(self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage('idm-sync')))); });
