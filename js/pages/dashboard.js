// Tableau de bord : seuls les indicateurs autorisés pour le profil sont présentés (le serveur ne calcule que ceux-là).
// Carte interactive : survol, clic = sélection + zoom + panneau de détails sous la carte, légende, retour au pays entier, Échap pour fermer.
import { api } from '../api.js';
import { esc, fmt, usd, bars, stacked, donut, line, monthLabel, $, dtt, pill, toast } from '../ui.js';
import { baseMap, provinces, ramp } from '../map.js';
import { ctx, go, can } from '../app.js';

let memo = null;   // province sélectionnée : conservée quand le tableau se rafraîchit en temps réel
const SEUIL = { G01: 'Emprise', I01: 'Identité', T01: 'Titre', F01: 'Recettes', L01: 'Lot', S01: 'Sécurité' };

export async function render(v) {
  const s = await api('/stats'); const k = s.kpi; const rec = await api('/temps-reel/recents').catch(() => ({ evenements: [], connectes: 0 }));
  const taux = k.recettes_attendues ? Math.round(100 * (k.recettes_reglees || 0) / k.recettes_attendues) : null;
  const card = (cls, l, val, sub) => `<div class="card kpi ${cls}"><div class="l">${l}</div><div class="v">${val}</div><div class="s">${sub || ''}</div></div>`;
  const tiles = [];
  if (k.personnes != null) tiles.push(card('b', 'Acteurs enregistrés', fmt(k.personnes), k.verifiees != null ? `${fmt(k.verifiees)} identités vérifiées · ${fmt(k.femmes)} femmes (${Math.round(100 * k.femmes / Math.max(1, k.personnes))} %)` : 'Statistique agrégée'));
  if (k.cartes != null) tiles.push(card('j', 'Cartes biométriques', fmt(k.cartes), k.cartes_a_imprimer != null ? `${fmt(k.cartes_a_imprimer)} en attente d'impression` : 'Statistique agrégée'));
  if (k.sites != null) tiles.push(card('v2', 'Sites actifs', fmt(k.sites), `${fmt(k.cooperatives)} coopératives${k.titres != null ? ' · ' + fmt(k.titres) + ' titres/ZEA' : ''}`));
  if (k.recettes_reglees != null) tiles.push(card('v2', 'Recettes réglées', usd(k.recettes_reglees), taux != null ? `${taux} % des ${usd(k.recettes_attendues)} attendus${k.paiements_attente != null ? ' · ' + fmt(k.paiements_attente) + ' paiements à confirmer' : ''}` : 'Montant agrégé'));
  if (k.alertes_ouvertes != null) tiles.push(card('r', 'Alertes ouvertes', fmt(k.alertes_ouvertes), `${fmt(k.alertes_hautes)} de priorité haute${k.plaintes_ouvertes != null ? ' · ' + fmt(k.plaintes_ouvertes) + ' plaintes ouvertes' : ''}`));
  if (k.a_valider != null) tiles.push(card('j', 'Vérifications à valider', fmt(k.a_valider), 'Sites et titres soumis'));
  if (k.inspections != null) tiles.push(card('b', 'Inspections', fmt(k.inspections), 'Constats enregistrés'));
  const cols = Object.keys(s.parProvince[0] || {}).filter(c => !['code', 'nom', 'phase'].includes(c));
  const opts = { personnes: 'Acteurs enregistrés', sites: 'Sites', recettes: 'Recettes réglées ($)', alertes: 'Alertes ouvertes' };
  const provNom = ctx.user.province ? esc(ctx.meta.provinces.find(p => p.code === ctx.user.province)?.nom || '') : '';
  v.innerHTML = `<div class="pagehead"><div><h1>Tableau de bord ${ctx.user.province ? '— ' + provNom : 'national'}</h1><p>Profil : <b>${esc(ctx.user.profil)}</b> — vous ne voyez que les indicateurs et données liés à votre profil et à vos autorisations. Mise à jour en temps réel. <b>Cliquez une province</b> sur la carte pour ouvrir ses détails.</p></div><span class="sp"></span>${can('personnes', 2) ? '<button class="btn pri" id="goEn">✚ Nouvel enrôlement</button>' : ''}${can('rapports') ? '<button class="btn" id="goRp">Rapports</button>' : ''}</div>
  <div class="grid g4">${tiles.join('')}</div>
  <div class="grid g-main mt"><div>
    <div class="card"><h2>Carte nationale <small class="flex" style="gap:6px"><select id="provSel" style="width:auto;padding:3px 6px" aria-label="Province"><option value="">Choisir une province…</option>${s.parProvince.map(p => `<option value="${p.code}">${esc(p.nom)}</option>`).join('')}</select><select id="metric" style="width:auto;padding:3px 6px" aria-label="Indicateur">${cols.filter(c => opts[c]).map(c => `<option value="${c}">${opts[c]}</option>`).join('')}<option value="phase">Phase de déploiement</option></select></small></h2><div class="mapbox" id="map" style="height:470px"></div><div id="lgd" class="small" style="margin-top:8px"></div></div>
    <div id="pdet" class="mt" aria-live="polite"></div></div>
  <div class="card"><h2>Activité en temps réel <small id="liveN"></small></h2><div id="feed" class="scroll small" style="max-height:640px"></div></div></div>
  <div class="grid g3 mt">
    ${s.parMois ? `<div class="card"><h2>Recettes par mois</h2>${stacked(s.parMois.map(m => ({ k: monthLabel(m.m), a: m.attendu, b: m.regle })), { h: 210 })}</div>` : ''}
    ${s.enrol ? `<div class="card"><h2>Enrôlements par mois</h2>${line(s.enrol.map(e => ({ k: monthLabel(e.m), v: e.n })), { h: 210 })}</div>` : ''}
    ${s.parCategorie ? `<div class="card"><h2>Catégories d'acteurs</h2>${donut(s.parCategorie.map(c => ({ k: { A: 'A — Exportateur/comptoir', B: 'B — Négociant', C: 'C — Exploitant' }[c.categorie], v: c.n, c: { A: '#CE1021', B: '#F7D618', C: '#007FFF' }[c.categorie] })))}<h2 style="margin-top:14px">Substances</h2>${bars(s.parSubstance.slice(0, 6).map(x => ({ k: x.k, v: x.n })), { horizontal: true, w: 420 })}</div>` : ''}
  </div>
  ${s.alertesParCode ? `<div class="card mt"><h2>Alertes par règle <small>Manuel §27 — détection ≠ sanction</small></h2><div class="flex wrap">${s.alertesParCode.map(a => `<a href="#/alertes" class="card" style="padding:10px 16px;min-width:120px"><div class="muted small">${a.code} ${SEUIL[a.code]}</div><div style="font-size:24px;font-weight:700">${a.n}</div></a>`).join('')}</div></div>` : ''}`;
  if ($('#goEn')) $('#goEn').onclick = () => go('enrolement'); if ($('#goRp')) $('#goRp').onclick = () => go('rapports');

  // ---- fil d'activité ----
  const feed = [...rec.evenements]; const drawFeed = () => { $('#feed').innerHTML = feed.map(e => `<div style="padding:7px 0;border-bottom:1px solid var(--bord)"><b>${esc(e.libelle)}</b><br><span class="muted">${esc(e.par)} · ${e.province ? esc(e.province) : 'national'} · ${dtt(e.ts)}</span></div>`).join('') || '<p class="muted">Aucune activité récente. Les enrôlements, paiements, inspections et synchronisations des terminaux apparaissent ici dès leur réception.</p>'; $('#liveN').textContent = rec.connectes + ' poste(s) connecté(s)'; };
  drawFeed(); const h = e => { feed.unshift(e.detail); if (feed.length > 30) feed.pop(); if ($('#feed')) drawFeed(); else window.removeEventListener('idm-live', h); }; window.addEventListener('idm-live', h);

  // ---- carte interactive ----
  const map = await baseMap($('#map')); const g = await provinces(); const byC = Object.fromEntries(s.parProvince.map(p => [p.code, p]));
  const layers = {}; let sel = null, jeton = 0; const pays = map._base.getBounds();
  const metric = () => $('#metric').value; const val = (p, m) => m === 'phase' ? (5 - (p.phase || 5)) : (p[m] || 0);
  const maxOf = m => m === 'phase' ? 4 : Math.max(...s.parProvince.map(p => p[m] || 0), 1);
  const teinte = m => m === 'alertes' ? 'rouge' : m === 'recettes' ? 'jaune' : 'bleu';
  const style = (code, hover) => { const m = metric(), p = byC[code], on = code === sel; return { color: on ? '#CE1021' : hover ? '#0a2a5e' : '#0a2a5e', weight: on ? 3.5 : hover ? 2.5 : 1, fillOpacity: on ? 1 : hover ? .97 : .88, fillColor: ramp(val(p, m), maxOf(m), teinte(m)) }; };
  const restyle = () => Object.entries(layers).forEach(([c, l]) => l.setStyle(style(c)));
  L.geoJSON(g, { style: () => ({}), onEachFeature: (f, l) => { const c = f.properties.code; layers[c] = l; l.setStyle(style(c));
    l.bindTooltip(() => { const p = byC[c]; return `<b>${esc(p.nom)}</b>${cols.filter(x => opts[x]).map(x => `<br>${opts[x]} : ${fmt(p[x] || 0)}`).join('')}<br>Phase ${p.phase || '—'}<br><i>Cliquer pour les détails</i>`; }, { sticky: true });
    l.on('mouseover', () => { l.setStyle(style(c, true)); if (c !== sel) l.bringToFront(); if (sel) layers[sel].bringToFront(); }); l.on('mouseout', () => l.setStyle(style(c)));
    l.on('click', e => { L.DomEvent.stopPropagation(e); choisir(c, true); }); l.getElement?.()?.setAttribute?.('tabindex', '0'); } }).addTo(map);
  // légende (sous la carte : pas de chevauchement avec l'attribution)
  const drawLegend = () => { const m = metric(), mx = maxOf(m), t = teinte(m); const el = $('#lgd'); if (!el) return; el.innerHTML = `<div class="flex wrap" style="gap:10px"><b>${m === 'phase' ? 'Phase de déploiement' : opts[m]}</b><div style="display:flex;align-items:center;gap:6px;margin-top:4px"><span>${m === 'phase' ? 'tardive' : '0'}</span><i style="display:block;width:110px;height:10px;border-radius:5px;margin:0;background:linear-gradient(90deg,${ramp(0, 1, t)},${ramp(.5, 1, t)},${ramp(1, 1, t)})"></i><span>${m === 'phase' ? 'précoce' : fmt(mx)}</span></div></div>`; }; drawLegend();
  // retour au pays entier
  const rb = L.control({ position: 'topright' }); rb.onAdd = () => { const b = L.DomUtil.create('button', 'btn sm'); b.type = 'button'; b.textContent = '⤢ Pays entier'; b.title = 'Revenir à la vue nationale (Échap)'; L.DomEvent.disableClickPropagation(b); b.onclick = () => fermer(); return b; }; rb.addTo(map);
  map.on('click', () => fermer());
  const onKey = e => { if (!$('#map')) return document.removeEventListener('keydown', onKey); if (e.key === 'Escape' && sel) fermer(); }; document.addEventListener('keydown', onKey);
  $('#metric').onchange = () => { restyle(); drawLegend(); }; $('#provSel').onchange = e => e.target.value ? choisir(e.target.value, true) : fermer();

  function fermer() { sel = null; memo = null; $('#provSel').value = ''; restyle(); $('#pdet').innerHTML = ''; jeton++; map.flyToBounds(pays, { padding: [10, 10], duration: .6 }); }
  async function choisir(code, zoom) {
    sel = code; memo = code; $('#provSel').value = code; restyle(); layers[code].bringToFront(); if (zoom) map.flyToBounds(layers[code].getBounds(), { padding: [30, 30], maxZoom: 7, duration: .6 });
    const j = ++jeton; const p = byC[code]; $('#pdet').innerHTML = `<div class="card"><h2>${esc(p.nom)} <small>chargement des détails…</small></h2><div class="bar"><i style="width:40%"></i></div></div>`;
    try { const d = await api('/stats/province/' + code); if (j !== jeton) return; detail(d); $('#pdet').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { if (j !== jeton) return; $('#pdet').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
  }
  function detail(d) {
    const k = d.kpi, pv = d.province; const t = (cls, l, val, sub) => `<div class="card kpi ${cls}" style="padding:12px"><div class="l">${l}</div><div class="v" style="font-size:22px">${val}</div><div class="s">${sub || ''}</div></div>`; const tl = [];
    if (k.personnes != null) tl.push(t('b', 'Acteurs', fmt(k.personnes), k.verifiees != null ? `${fmt(k.verifiees)} vérifiés · ${fmt(k.exercice_valide)} avec droit d'exercer valide · ${fmt(k.femmes)} femmes` : 'Agrégé') );
    if (k.sites != null) tl.push(t('v2', 'Sites actifs', fmt(k.sites), `${fmt(k.cooperatives)} coopératives${k.sites_irreguliers ? ' · <b class="bad">' + fmt(k.sites_irreguliers) + ' irréguliers</b>' : ''}${k.titres != null ? ' · ' + fmt(k.titres) + ' titres/ZEA' : ''}`));
    if (k.cartes != null) tl.push(t('j', 'Cartes', fmt(k.cartes), 'biométriques émises'));
    if (k.recettes_reglees != null) tl.push(t('v2', 'Recettes réglées', usd(k.recettes_reglees), k.recettes_attendues != null ? `${k.recettes_attendues ? Math.round(100 * k.recettes_reglees / k.recettes_attendues) : 0} % des ${usd(k.recettes_attendues)} attendus` : 'Montant agrégé'));
    if (k.alertes_ouvertes != null) tl.push(t('r', 'Alertes ouvertes', fmt(k.alertes_ouvertes), `${fmt(k.alertes_hautes)} de priorité haute${k.inspections != null ? ' · ' + fmt(k.inspections) + ' inspections' : ''}`));
    const art = [];
    if (d.parCategorie) art.push(`<div class="card"><h3>Catégories d'acteurs</h3>${donut(d.parCategorie.map(c => ({ k: { A: 'A — Exportateur/comptoir', B: 'B — Négociant', C: 'C — Exploitant' }[c.categorie], v: c.n, c: { A: '#CE1021', B: '#F7D618', C: '#007FFF' }[c.categorie] })), { size: 130 })}<h3 style="margin-top:10px">Substances</h3>${bars(d.parSubstance.map(x => ({ k: x.k, v: x.n })), { horizontal: true, w: 380 })}</div>`);
    if (d.enrol && d.enrol.length > 1) art.push(`<div class="card"><h3>Enrôlements par mois</h3>${line(d.enrol.map(e => ({ k: monthLabel(e.m), v: e.n })), { h: 170 })}</div>`);
    if (d.parMois && d.parMois.length) art.push(`<div class="card"><h3>Recettes par mois</h3>${stacked(d.parMois.map(m => ({ k: monthLabel(m.m), a: m.attendu, b: m.regle })), { h: 170 })}</div>`);
    const listes = [];
    if (d.sites) listes.push(`<div class="card"><h3>Sites principaux ${d.sites[0]?.effectif != null ? '<small class="muted">(par effectif)</small>' : ''}</h3><table class="tbl"><tbody>${d.sites.map(x => `<tr class="click" data-site="${x.id}"><td><b>${esc(x.nom)}</b><br><span class="muted small">${esc(x.substances || '')}</span></td>${x.effectif != null ? `<td class="num">${fmt(x.effectif)}</td>` : ''}<td>${pill(x.statut_legal)}</td><td>${pill(x.statut_securite)}</td></tr>`).join('') || '<tr><td class="muted">Aucun site.</td></tr>'}</tbody></table></div>`);
    if (d.alertes) listes.push(`<div class="card"><h3>Alertes ouvertes (les plus urgentes)</h3>${d.alertes.map(a => `<div class="small" style="padding:5px 0;border-bottom:1px solid var(--bord)">${pill(a.priorite)} <span class="pill info">${a.code} ${SEUIL[a.code] || ''}</span><br>${esc(a.description)}</div>`).join('') || '<p class="muted">Aucune alerte ouverte.</p>'}</div>`);
    $('#pdet').innerHTML = `<div class="card" style="border-top:4px solid var(--rouge)"><div class="flex wrap"><h2 style="margin:0">${esc(pv.nom)} <small>chef-lieu : ${esc(pv.chef_lieu)} · ${pv.phase ? 'phase ' + pv.phase : 'hors phase de déploiement'}${d.part_nationale != null ? ' · ' + d.part_nationale + ' % des acteurs du pays' : ''}</small></h2><span class="sp"></span>
      ${can('carte') ? `<button class="btn sm" id="dCarte">Carte SIG</button>` : ''}${can('personnes') ? `<button class="btn sm" id="dReg">Acteurs</button>` : ''}${can('alertes') && d.alertes?.length ? `<button class="btn sm" id="dAl">⚑ Alertes</button>` : ''}<button class="btn sm" id="dX" title="Fermer (Échap)">✕ Fermer</button></div>
      <div class="grid g3 mt" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">${tl.join('')}</div>
      ${art.length ? `<div class="grid mt" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">${art.join('')}</div>` : ''}
      ${listes.length ? `<div class="grid g2 mt">${listes.join('')}</div>` : ''}</div>`;
    const bind = (id, fn) => { const el = $(id); if (el) el.onclick = fn; }; bind('#dX', fermer); bind('#dCarte', () => go('carte/' + pv.code)); bind('#dReg', () => go('registre/' + pv.code)); bind('#dAl', () => go('alertes'));
    $('#pdet').querySelectorAll('tr[data-site]').forEach(tr => tr.onclick = () => go('carte/' + tr.dataset.site));
  }
  if (memo && byC[memo]) choisir(memo, true);
}
