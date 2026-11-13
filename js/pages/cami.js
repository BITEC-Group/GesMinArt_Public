// Vérification des titres auprès du CAMI : statut, contrôle de position GPS (distance à la bordure), doublons, import, journal d'audit.
import { api, qs } from '../api.js';
import { esc, $, fmt, toast } from '../ui.js';
import { can } from '../app.js';
import { baseMap } from '../map.js';
import { hw } from '../hw.js';
import { apercu } from '../apercu.js';
import { constatCorps, CONSTAT_STYLE } from '../constat.js';

const dist = m => (m == null ? '' : m < 1000 ? `${fmt(m)} m` : `${(m / 1000).toFixed(2).replace('.', ',')} km`);
const frd = s => (s ? new Date(s).toLocaleString('fr-FR') : '—');
const ETAT = { ok: ['Vérifié', 'ok'], introuvable: ['Introuvable', 'bad'], en_attente: ['En attente du CAMI', 'warn'], erreur: ['Erreur', 'bad'] };

export async function render(v) {
  const importer = can('cami', 3);
  v.innerHTML = `<div class="pagehead"><div><h1>Vérification CAMI</h1><p>Interrogation du Cadastre minier : statut du titre, validité, contrôle de la position GPS dans le périmètre (distance à la bordure en cas de dépassement), détection des doublons et journal d'audit. <span id="mode" class="muted"></span></p></div></div>
  <div id="alertes"></div>
  <div class="grid g-main"><div style="min-width:0">
    <div class="card"><h2>Vérifier un titre</h2>
      <div class="f"><label>Numéro du titre</label><input id="num" placeholder="Ex. ZEA-1045, PE-8820" autocapitalize="characters"></div>
      <div class="row"><div><label>Latitude (facultatif)</label><input id="lat" type="number" step="any" placeholder="-10.720000"></div><div><label>Longitude (facultatif)</label><input id="lon" type="number" step="any" placeholder="25.470000"></div><button class="btn sm" id="gps" type="button">Ma position</button></div>
      <div class="flex wrap mt"><button class="btn pri" id="vf">Vérifier au CAMI</button><button class="btn" id="db">Contrôler les doublons</button></div>
      <div id="res" class="mt"></div></div>
    <div class="card mt"><h2>Journal des vérifications</h2><div class="row"><div><input id="fq" placeholder="Rechercher un titre ou un titulaire"></div><div><select id="fe"><option value="">Tous les états</option><option value="ok">Vérifiés</option><option value="en_attente">En attente</option><option value="introuvable">Introuvables</option></select></div><div><select id="fv"><option value="">Conformes ou non</option><option value="1">Conformes</option><option value="0">Non conformes</option></select></div></div>
      <div style="overflow-x:auto"><table class="tbl mt"><thead><tr><th>Date</th><th>Titre</th><th>Titulaire</th><th>État</th><th>Position</th><th>Source</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>
  </div><div style="min-width:0"><div class="card"><h2>Carte du périmètre</h2><div class="mapbox" id="map" style="height:480px"></div><p class="muted small" id="lg">Vérifiez un titre avec une position pour voir l'écart sur la carte.</p></div></div></div>`;
  const map = await baseMap($('#map'), { zoomControl: true }); let couche = L.layerGroup().addTo(map);
  api('/cami/etat').then(e => { $('#mode').textContent = '(' + e.note + ')'; }).catch(() => {});

  function dessiner(r, geometrie) {                           // périmètre (vert), position de l'agent, ligne d'écart (pointillés rouges)
    couche.clearLayers(); const b = [];
    if (geometrie) { const g = L.geoJSON(geometrie, { style: { color: '#059669', weight: 3, fillColor: '#10b981', fillOpacity: .3 } }).addTo(couche); b.push(g.getBounds()); }
    if (r.lat != null && r.lon != null) {
      const ok = r.dans_perimetre !== false;
      L.circleMarker([r.lat, r.lon], { radius: 9, color: '#fff', weight: 2, fillColor: ok ? '#2563eb' : '#dc2626', fillOpacity: 1 }).bindPopup(`Relevé GPS : ${r.lat}, ${r.lon}<br>${r.dans_perimetre === false ? 'Hors périmètre' : r.dans_perimetre ? 'Dans le périmètre' : 'Non contrôlé'}`).addTo(couche); b.push(L.latLngBounds([[r.lat, r.lon], [r.lat, r.lon]]));
      if (r.dans_perimetre === false && r.point_proche) { L.polyline([[r.lat, r.lon], [r.point_proche[1], r.point_proche[0]]], { color: '#dc2626', weight: 2.5, dashArray: '6,6' }).bindTooltip('Écart : ' + dist(r.distance_m), { permanent: true }).addTo(couche); b.push(L.latLngBounds([[r.point_proche[1], r.point_proche[0]], [r.point_proche[1], r.point_proche[0]]])); }
    }
    if (b.length) map.fitBounds(b.reduce((a, x) => a.extend(x)), { padding: [30, 30], maxZoom: 15 });
    $('#lg').innerHTML = geometrie ? '<span style="color:#059669">■</span> Périmètre CAMI' + (r.lat != null ? ` · <span style="color:${r.dans_perimetre === false ? '#dc2626' : '#2563eb'}">●</span> Position de l'agent` : '') : 'Le CAMI ne fournit pas de périmètre pour ce titre.';
  }
  const bandeau = r => { const [lib, c] = ETAT[r.etat] || [r.etat, '']; const ok = r.etat === 'ok' && r.valide;
    const col = r.etat === 'en_attente' ? '#c26a00' : ok ? '#1a7f45' : '#c0152a';
    return `<div style="border-radius:12px;padding:12px 14px;color:#fff;background:${col};font-weight:700">${r.etat === 'ok' ? (r.valide ? 'TITRE VALIDE ET CONFORME' : 'NON CONFORME') : r.etat === 'introuvable' ? 'TITRE INTROUVABLE AU CADASTRE' : 'VÉRIFICATION EN ATTENTE DU CAMI'}<div style="font-weight:500;font-size:12px;margin-top:2px">${esc(lib)} · source : ${esc(r.source || '—')}</div></div>`; };
  function afficher(r) {
    const spat = r.dans_perimetre == null ? '' : r.dans_perimetre ? `<p style="color:#1a7f45;font-weight:600">Position à l'intérieur du périmètre du titre.</p>` : `<p style="color:#c0152a;font-weight:600">Position HORS périmètre : à <u>${dist(r.distance_m)}</u> de la bordure la plus proche.</p>`;
    $('#res').innerHTML = bandeau(r) + (r.etat === 'ok' ? `<table class="tbl mt"><tbody><tr><td>Titre</td><td><b>${esc(r.numero)}</b> (${esc(r.type_permis || '—')})</td></tr><tr><td>Titulaire</td><td>${esc(r.titulaire || '—')}</td></tr><tr><td>Province</td><td>${esc(r.province || '—')}</td></tr><tr><td>Statut CAMI</td><td>${esc(r.statut_cami)}</td></tr><tr><td>Expiration</td><td>${esc(r.date_expiration || '—')}</td></tr><tr><td>Registre local</td><td>${r.titre_id ? 'Titre enregistré (n° ' + r.titre_id + ')' : 'Non enregistré'}</td></tr></tbody></table>` : '') + spat
      + (r.motifs?.length ? `<ul class="small">${r.motifs.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : '')
      + (importer && r.etat === 'ok' ? `<div class="flex mt"><button class="btn" id="imp">${r.titre_id ? 'Synchroniser avec le registre' : 'Importer dans le registre'}</button></div>` : '');
    const bi = $('#imp'); if (bi) bi.onclick = async () => { try { const x = await api('/cami/importer', { numero: r.numero }); toast(x.action === 'cree' ? `Titre ${x.numero} importé (à vérifier)` : `Titre ${x.numero} synchronisé (${x.modifications.length} changement(s)) : aucun doublon créé`, 'ok'); await charger(); } catch (e) { toast(e.message, 'bad'); if (e.data?.doublons) $('#res').insertAdjacentHTML('beforeend', doublons(e.data)); } };
  }
  const doublons = d => `<div class="mt"><b>Doublons et superpositions</b>${d.doublons.length ? '<ul class="small">' + d.doublons.map(x => `<li><span class="pill ${x.gravite === 'bloquant' ? 'bad' : x.gravite === 'majeur' ? 'warn' : ''}">${esc(x.gravite)}</span> ${esc(x.message)}</li>`).join('') + '</ul>' : '<p class="small" style="color:#1a7f45">Aucun doublon ni superposition détecté.</p>'}</div>`;
  const pos = () => ({ latitude: $('#lat').value, longitude: $('#lon').value });

  $('#gps').onclick = async () => { try { const g = await hw.gps(); $('#lat').value = g.lat.toFixed(6); $('#lon').value = g.lon.toFixed(6); toast(`Position relevée (±${Math.round(g.precision)} m)`, 'ok'); } catch (e) { toast('GPS : ' + e.message, 'bad'); } };
  $('#vf').onclick = async () => {
    const n = $('#num').value.trim(); if (!n) return toast('Saisissez un numéro de titre', 'bad'); $('#vf').disabled = true;
    try { const r = await api('/cami/verifier', { numero: n, ...pos() }); afficher(r); const g = r.etat === 'ok' ? (await api('/cami/verifications/' + r.id)).geometrie : null; dessiner(r, g); await charger(); } catch (e) { toast(e.message, 'bad'); } finally { $('#vf').disabled = false; }
  };
  $('#db').onclick = async () => { try { const d = await api('/cami/doublons', { numero: $('#num').value.trim() || undefined, ...pos() }); $('#res').insertAdjacentHTML('beforeend', doublons(d)); } catch (e) { toast(e.message, 'bad'); } };

  async function alertes() {
    let r; try { r = await api('/cami/alertes?resolue=0'); } catch { return; } const l = r.rows || r; const el = $('#alertes'); if (!el) return;
    el.innerHTML = l.length ? `<div class="card" style="border-left:5px solid #c0152a"><h2>${l.length} alerte(s) de conformité à traiter</h2><p class="small muted">Détectées par la re-vérification périodique du cadastre (titre expiré, suspendu ou position hors périmètre).</p><ul class="small">${l.slice(0, 20).map(a => `<li><b>${esc(a.numero)}</b> — ${esc(a.message || a.motif || a.type || '')} <span class="muted">(${frd(a.cree_le)})</span> ${can('cami', 2) ? `<button class="btn sm" data-alt="${a.id}">Marquer comme traité</button>` : ''}</li>`).join('')}</ul></div>` : '';
  }
  async function charger() {
    const r = await api('/cami/verifications' + qs({ q: $('#fq').value, etat: $('#fe').value, valide: $('#fv').value, limit: 100 }));
    $('#tb').innerHTML = r.rows.map(x => { const [lib, c] = ETAT[x.etat] || [x.etat, '']; return `<tr><td class="small">${frd(x.cree_le)}</td><td><b>${esc(x.numero)}</b><br><span class="muted small">${esc(x.type_permis || '')}</span></td><td>${esc(x.titulaire || '—')}</td>
      <td><span class="pill ${c}">${lib}</span>${x.etat === 'ok' ? `<br><span class="pill ${x.valide ? 'ok' : 'bad'}">${x.valide ? 'Conforme' : 'Non conforme'}</span>` : ''}${x.etat === 'en_attente' ? `<br><span class="muted small">${x.tentatives} tentative(s)</span>` : ''}</td>
      <td class="small">${x.dans_perimetre == null ? '—' : x.dans_perimetre ? 'Dans le périmètre' : 'Hors : ' + dist(x.distance_m)}</td><td class="small">${esc(x.source || '—')}</td>
      <td class="flex" style="gap:6px">${x.a_geometrie ? `<button class="btn sm" data-carte="${x.id}">Carte</button>` : ''}${x.etat === 'ok' ? `<button class="btn sm" data-doc="${x.id}">${x.valide ? 'Certificat' : 'Constat'}</button>` : ''}<button class="btn sm" data-rel="${x.id}">Relancer</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Aucune vérification.</td></tr>';
  }
  v.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.doc) { const d = await api('/cami/verifications/' + b.dataset.doc + '/document'); await apercu({ titre: (d.type_document === 'certificat_conformite' ? 'Certificat de conformité ' : 'Constat de non-conformité ') + d.numero, corps: constatCorps(d), style: CONSTAT_STYLE + '.cst{margin:0 auto}', orientation: 'portrait', marge: '8mm' }); }
      else if (b.dataset.alt) { const t = prompt('Suite donnée à cette alerte (10 caractères minimum) :'); if (t == null) return; await api('/cami/alertes/' + b.dataset.alt + '/traiter', { commentaire: t }); toast('Alerte marquée comme traitée', 'ok'); await alertes(); }
      else if (b.dataset.carte) { const r = await api('/cami/verifications/' + b.dataset.carte); dessiner(r, r.geometrie); }
      else if (b.dataset.rel) { b.disabled = true; const r = await api(`/cami/verifications/${b.dataset.rel}/relancer`, {}); toast(r.etat === 'en_attente' ? 'CAMI toujours injoignable : vérification en attente' : 'Vérification mise à jour', r.etat === 'en_attente' ? 'bad' : 'ok'); await charger(); }
    } catch (err) { toast(err.message, 'bad'); }
  });
  let t; for (const s of ['#fq', '#fe', '#fv']) $(s).addEventListener(s === '#fq' ? 'input' : 'change', () => { clearTimeout(t); t = setTimeout(() => charger().catch(() => {}), 300); });
  await charger(); await alertes();
}
