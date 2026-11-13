// Carte SIG : couches officielles (provinces, territoires), sites, titres/ZEA, détection de superpositions, contrôle d'un point.
import { api, qs } from '../api.js';
import { esc, $, $$, pill, fmt, dt, toast } from '../ui.js';
import { baseMap, siteIcon, titreStyle, territoires, provinces, SUBCOL, COL } from '../map.js';
import { ctx, go } from '../app.js';
import { hw } from '../hw.js';

const pip = (pt, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const inG = (pt, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(p => pip(pt, p[0]));
export async function render(v, arg) {
  const subs = ['Or', 'Diamant', 'Cuivre', 'Cobalt', 'Cassitérite', 'Coltan'];
  v.innerHTML = `<div class="pagehead"><div><h1>Carte SIG — sites, titres et contrôle d'emprise</h1><p>Superposition des chantiers aux titres miniers et ZEA. Une intersection est une <b>alerte géométrique</b>, jamais une infraction automatique.</p></div></div>
  <div class="map-side"><div class="mapbox" id="map" style="height:640px"><div class="legend" id="legend"></div></div>
  <div class="grid" style="align-content:start">
    <div class="card"><h2>Filtres & couches</h2>
      <div class="f"><label>Province</label><select id="fProv"><option value="">Toutes</option>${ctx.meta.provinces.map(p => `<option value="${p.code}">${esc(p.nom)}</option>`).join('')}</select></div>
      <div class="f"><label>Colorer les sites par</label><select id="fMode"><option value="legal">Statut légal</option><option value="securite">Sécurité</option><option value="substance">Substance</option></select></div>
      <div class="f"><label>Substance</label><select id="fSub"><option value="">Toutes</option>${subs.map(s => `<option>${s}</option>`).join('')}</select></div>
      <label class="chk"><input type="checkbox" id="lSites" checked> Sites / chantiers</label><label class="chk"><input type="checkbox" id="lTitres" checked> Titres miniers & ZEA</label><label class="chk"><input type="checkbox" id="lTerr"> Territoires</label>
      <div class="row mt"><button class="btn sm" id="bGps">◎ Ma position</button><button class="btn sm" id="bCheck">Contrôler un point</button></div>
      <div class="muted small mt" id="count"></div></div>
    <div class="card" id="panel"><h2>Détail</h2><p class="muted">Cliquez un site ou un titre sur la carte. Avec « Contrôler un point », cliquez n'importe où pour connaître la province, le territoire, les titres et les sites voisins (calcul local, utilisable hors réseau sur le POS).</p></div></div></div>`;
  const map = await baseMap($('#map')); const terr = await territoires();
  let sites = [], titres = [], sLayer = L.layerGroup().addTo(map), tLayer = L.layerGroup().addTo(map), terrLayer = null, polyLayer = null, probe = null, checking = false;
  const legend = () => { const m = $('#fMode').value; const items = m === 'substance' ? Object.entries(SUBCOL) : m === 'securite' ? [['conforme', COL.conforme], ['vigilance', COL.vigilance], ['danger', COL.danger]] : [['légal', COL.legal], ['à vérifier', COL.a_verifier], ['irrégulier', COL.irregulier]]; $('#legend').innerHTML = '<b>Sites</b><br>' + items.map(([k, c]) => `<div><i style="background:${c}"></i>${k}</div>`).join('') + '<hr style="margin:5px 0"><div><i style="background:#007FFF;border-radius:2px"></i>Titre valide</div><div><i style="background:#1a9b5b;border-radius:2px"></i>ZEA</div><div><i style="background:#CE1021;border-radius:2px"></i>Titre expiré</div>'; };
  async function load() {
    const p = $('#fProv').value; [sites, titres] = await Promise.all([api('/geo/sites' + qs({ province: p })), api('/geo/titres' + qs({ province: p }))]);
    const sub = $('#fSub').value, mode = $('#fMode').value; sLayer.clearLayers(); tLayer.clearLayers(); legend();
    const fs = sites.filter(s => !sub || (s.substances || '').includes(sub));
    for (const t of titres) L.geoJSON(t.polygone, { style: titreStyle(t) }).bindTooltip(`<b>${esc(t.numero)}</b> · ${t.type}<br>${esc(t.titulaire)}<br>${t.statut}`).on('click', () => titrePanel(t)).addTo(tLayer);
    for (const s of fs) siteIcon(s, mode).bindTooltip(`<b>${esc(s.nom)}</b><br>${esc(s.substances || '')} · ${s.statut_legal}`).on('click', () => sitePanel(s.id)).addTo(sLayer);
    $('#count').textContent = `${fmt(fs.length)} site(s) · ${titres.length} titre(s)/ZEA affichés`;
    if (p) { const f = (await provinces()).features.find(f => f.properties.code === p); map.fitBounds(L.geoJSON(f).getBounds(), { padding: [20, 20] }); } else map.fitBounds(map._base.getBounds());
  }
  async function sitePanel(id) {
    const s = await api('/sites/' + id); if (polyLayer) map.removeLayer(polyLayer); if (s.polygone) polyLayer = L.geoJSON(s.polygone, { style: { color: '#F7D618', weight: 3, fillOpacity: .3 } }).addTo(map);
    $('#panel').innerHTML = `<h2>${esc(s.nom)} <small>${esc(s.code)}</small></h2><div class="flex wrap" style="margin-bottom:8px">${pill(s.statut_legal)} ${pill(s.statut_securite)} ${pill(s.statut_activite)}</div><dl class="kv"><dt>Province</dt><dd>${esc(s.province_nom)} · ${esc(s.territoire || '—')}</dd><dt>Substances</dt><dd>${esc(s.substances || '—')}</dd><dt>Coopérative</dt><dd>${esc(s.cooperative || '—')}</dd><dt>Surface</dt><dd>${s.surface_ha ?? '—'} ha</dd><dt>Effectif</dt><dd>${fmt(s.effectif)} acteurs</dd><dt>Coordonnées</dt><dd class="mono">${s.lat.toFixed(5)}, ${s.lon.toFixed(5)} (±${s.precision_gps} m)</dd></dl>
    ${s.chevauchements.length ? `<div class="alert warn mt"><b>Superposition géométrique</b> avec ${s.chevauchements.map(c => `${esc(c.numero)} (${c.type}, ${esc(c.statut)})`).join(' ; ')}.<br><span class="small">Qualification juridique par la CAMI / autorités ; aucune expulsion ni amende sur simple chevauchement.</span></div>` : '<div class="alert ok mt">Aucune superposition avec un titre ou une ZEA.</div>'}
    ${s.anomalies.length ? `<h3>Alertes ouvertes</h3>${s.anomalies.map(a => `<div class="small">${pill(a.priorite)} ${a.code} — ${esc(a.description)}</div>`).join('')}` : ''}
    <div class="row mt"><button class="btn sm" id="pInsp">Inspections (${s.inspections.length})</button><button class="btn sm" id="pReg">Voir les acteurs</button></div>`;
    $('#pReg').onclick = () => go('registre'); $('#pInsp').onclick = () => go('controle');
  }
  function titrePanel(t) { $('#panel').innerHTML = `<h2>${esc(t.numero)}</h2><div class="flex wrap" style="margin-bottom:8px"><span class="pill info">${t.type}</span>${pill(t.statut)}</div><dl class="kv"><dt>Titulaire</dt><dd>${esc(t.titulaire)}</dd><dt>Substances</dt><dd>${esc(t.substances || '—')}</dd><dt>Échéance</dt><dd>${dt(t.date_fin)}</dd><dt>Source</dt><dd>CAMI (démonstration — à confirmer par la source officielle)</dd></dl>`; }
  function checkPoint(ll) {
    const pt = [ll.lng, ll.lat]; const t = terr.features.find(f => inG(pt, f.geometry)); const tt = titres.filter(x => inG(pt, x.polygone));
    const near = sites.map(s => ({ s, d: map.distance(ll, [s.lat, s.lon]) })).sort((a, b) => a.d - b.d).slice(0, 3);
    if (probe) map.removeLayer(probe); probe = L.marker(ll).addTo(map);
    $('#panel').innerHTML = `<h2>Contrôle de point</h2><dl class="kv"><dt>Coordonnées</dt><dd class="mono">${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}</dd><dt>Territoire</dt><dd>${esc(t?.properties.nom || 'hors territoire connu')}</dd><dt>Province</dt><dd>${esc(ctx.meta.provinces.find(p => p.code === t?.properties.province)?.nom || '—')}</dd></dl>
    ${tt.length ? tt.map(x => `<div class="alert ${x.statut === 'expire' ? 'bad' : x.type === 'ZEA' ? 'ok' : 'warn'}"><b>${x.type === 'ZEA' ? 'Dans une ZEA' : 'Dans l\'emprise d\'un titre'} :</b> ${esc(x.numero)} — ${esc(x.titulaire)} (${x.statut})</div>`).join('') : '<div class="alert">Aucun titre ni ZEA à cet endroit (selon les données chargées).</div>'}
    <h3>Sites les plus proches</h3>${near.map(n => `<div class="small">${esc(n.s.nom)} — ${n.d < 1000 ? Math.round(n.d) + ' m' : (n.d / 1000).toFixed(1) + ' km'}</div>`).join('')}<p class="muted small mt">Précision limitée à celle du positionnement : un point GPS approximatif ne justifie ni amende ni expulsion.</p>`;
  }
  map.on('click', e => { if (checking) { checkPoint(e.latlng); checking = false; map.getContainer().style.cursor = ''; } });
  $('#bCheck').onclick = () => { checking = true; map.getContainer().style.cursor = 'crosshair'; toast('Cliquez sur la carte pour contrôler un point'); };
  $('#bGps').onclick = async () => { try { const g = await hw.gps(); const ll = L.latLng(g.lat, g.lon); map.setView(ll, 13); checkPoint(ll); toast(`Position trouvée (±${Math.round(g.precision)} m)`, 'ok'); } catch (e) { toast('GPS : ' + e.message, 'bad'); } };
  $('#lSites').onchange = e => e.target.checked ? sLayer.addTo(map) : map.removeLayer(sLayer); $('#lTitres').onchange = e => e.target.checked ? tLayer.addTo(map) : map.removeLayer(tLayer);
  $('#lTerr').onchange = e => { if (e.target.checked) { terrLayer ??= L.geoJSON(terr, { style: { color: '#5b6b86', weight: .8, fill: false }, interactive: false }); terrLayer.addTo(map); } else if (terrLayer) map.removeLayer(terrLayer); };
  ['fProv', 'fMode', 'fSub'].forEach(i => $('#' + i).onchange = load);
  if (arg && /^CD-[A-Z]{2}$/.test(arg)) { $('#fProv').value = arg; await load(); } else if (arg && /^\d+$/.test(arg)) { await load(); const s = sites.find(x => x.id == arg); if (s) { map.setView([s.lat, s.lon], 14); sitePanel(s.id); } } else await load();
}
