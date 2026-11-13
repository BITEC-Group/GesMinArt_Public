// Aides Leaflet : fond hors-ligne épuré (limites provinciales uniquement, sans tuiles, repères ni bandeau), couleurs de statuts.
let provCache = null, terrCache = null;
export const provinces = async () => provCache ??= await (await fetch('/data/provinces.geojson')).json();
export const territoires = async () => terrCache ??= await (await fetch('/data/territoires.geojson')).json();
export const COL = { legal: '#1a9b5b', a_verifier: '#e8890c', irregulier: '#CE1021', conforme: '#1a9b5b', vigilance: '#e8890c', danger: '#CE1021' };
export const SUBCOL = { Or: '#e0a800', Diamant: '#16a3b8', Cuivre: '#d2691e', Cobalt: '#7a4fd6', 'Cassitérite': '#555', Coltan: '#8b1a1a', Wolframite: '#2f4f4f' };
export const SOURCES = 'Sources : limites geoBoundaries (ODbL) · sites © contributeurs OpenStreetMap';
export async function baseMap(el, { zoomControl = true, fit = true } = {}) {
  const map = L.map(el, { zoomControl, minZoom: 4, maxZoom: 18, attributionControl: false, preferCanvas: true }).setView([-3, 23.5], 5);
  if (!el.parentNode.querySelector(':scope > .mapsrc')) el.insertAdjacentHTML('afterend', '<div class="mapsrc">' + SOURCES + '</div>');
  const g = await provinces(); const layer = L.geoJSON(g, { style: { color: '#0a2a5e', weight: 1, fillColor: '#eaf2ff', fillOpacity: .85 }, interactive: false }).addTo(map);
  if (fit) map.fitBounds(layer.getBounds(), { padding: [10, 10] });
  map._base = layer; return map;
}
export const siteIcon = (s, mode = 'legal') => L.circleMarker([s.lat, s.lon], { radius: 6, color: '#fff', weight: 1.5, fillColor: mode === 'substance' ? (SUBCOL[(s.substances || '').split(',')[0]] || '#007FFF') : (COL[mode === 'securite' ? s.statut_securite : s.statut_legal] || '#007FFF'), fillOpacity: .95 });
export const titreStyle = t => ({ color: t.statut === 'expire' ? '#CE1021' : t.type === 'ZEA' ? '#1a9b5b' : '#0a2a5e', weight: 2, dashArray: t.statut === 'expire' ? '5 4' : t.statut === 'en_instruction' ? '2 4' : null, fillColor: t.statut === 'expire' ? '#CE1021' : t.type === 'ZEA' ? '#1a9b5b' : '#007FFF', fillOpacity: .12 });
export const ramp = (v, max, hue = 'bleu') => { const t = max ? Math.min(1, v / max) : 0; const a = [234, 242, 255], b = hue === 'rouge' ? [206, 16, 33] : hue === 'jaune' ? [200, 160, 0] : [0, 90, 200]; return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * Math.pow(t, .6))).join(',')})`; };
