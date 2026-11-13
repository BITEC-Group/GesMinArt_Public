// Modèle économique 2027-2031 : reproduit le classeur de rentabilité et va au-delà (leviers, solveur, optimiseur, risque, provinces).
import { api } from '../api.js';
import { esc, $, $$, fmt, toast, bars } from '../ui.js';

const M = n => (n == null ? '—' : (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M$');
const P = n => (n == null ? '—' : (n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %');
const kpi = (t, v, s = '') => `<div class="card kpi" style="padding:12px"><div class="l">${esc(t)}</div><div class="v" style="font-size:22px">${v}</div><div class="s">${s}</div></div>`;
const neg = n => (n < 0 ? 'style="color:#C21807"' : '');

export async function render(v) {
  const ref = await api('/modele/reference');
  const st = { cas: 2, cible: 0.75, taux: 0.18, multDispo: 1, capexK: 1, commission: 0, partProvinces: 0 };
  v.innerHTML = `<div class="pagehead"><div><h1>Modèle économique 2027-2031</h1><p>${esc(ref.avertissement)}</p></div></div>
  <div class="card row" id="prm">
    <label>Cas<select id="p_cas">${ref.cas.map(c => `<option value="${c.id}" ${c.id === 2 ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
    <label>Couverture 2031 (%)<input id="p_cible" type="number" min="5" max="100" step="1" value="75" style="width:80px"></label>
    <label>Taux d'actualisation (%)<input id="p_taux" type="number" min="1" max="60" step="0.5" value="18" style="width:80px"></label>
    <label>Disponibilité ×<input id="p_disp" type="number" min="0.5" max="3" step="0.05" value="1" style="width:80px"></label>
    <label>CAPEX ×<input id="p_capex" type="number" min="0.5" max="2" step="0.05" value="1" style="width:80px"></label>
    <label>Commission sur recettes (%)<input id="p_comm" type="number" min="0" max="50" step="0.5" value="0" style="width:80px"></label>
    <label>Prefinancement provinces (%)<input id="p_prov" type="number" min="0" max="30" step="5" value="0" style="width:80px"></label>
    <button class="btn" id="go">Recalculer</button></div>
  <div class="tabs" id="tabs"><button data-t="synth" class="on">Synthèse</button><button data-t="leviers">Leviers & seuils</button><button data-t="optim">Optimiser & risque</button><button data-t="prov">Provinces & filières</button><button data-t="dim">Dimensionnement</button></div><div id="pane"></div>`;
  const params = () => {
    const c = Number($('#p_capex').value) || 1;
    return { cas: +$('#p_cas').value, cible: Number($('#p_cible').value) / 100, taux: Number($('#p_taux').value) / 100, multDispo: Number($('#p_disp').value) || 1, commission: Number($('#p_comm').value) / 100,
      partProvinces: Number($('#p_prov').value) / 100, capexPostes: Object.fromEntries(Object.entries(ref.capexPostes).map(([k, x]) => [k, x * c])) };
  };
  void st;
  const call = (p, extra = {}) => api('/modele/' + p, { params: params(), ...extra });
  const wait = el => { el.innerHTML = '<p class="muted">Calcul…</p>'; };
  const err = (el, e) => { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; };

  async function synth(el) {
    wait(el); let r, cmp, qp;
    try { [r, cmp, qp] = await Promise.all([call('simuler'), call('comparer'), call('quote-part')]); } catch (e) { return err(el, e); }
    const s = r.synthese, L = r.lignes;
    el.innerHTML = `<div class="grid g4" style="margin-bottom:16px">${kpi('VAN privée', `<span ${neg(s.van)}>${M(s.van)}</span>`, `à ${P(r.parametres.taux)}`)}${kpi('TRI hors dette', P(s.tri), s.tri >= 0.18 ? 'au-dessus de la cible' : 'sous la cible de 18 %')}${kpi('CA 2031', M(s.ca2031))}${kpi('EBITDA 2031', M(s.ebitda2031))}
      ${kpi('Recettes publiques 2031', M(s.recettesPubliques2031))}${kpi('Gain public net cumulé', M(s.gainPublicNet), 'avant effets sociaux')}${kpi('Besoin de cash max', M(s.besoinCashMax))}${kpi('Retour sur investissement', s.retourAnnees == null ? '—' : fmt(s.retourAnnees, 1) + ' ans')}
      ${kpi('Écart pour VAN nulle', M(s.ecartFinancementVanNulle), 'financement initial équivalent')}${kpi('Seuil actifs (EBITDA stable)', fmt(s.seuilActifs), P(s.seuilActifs / r.parametres.population) + ' de la population')}</div>
    <div class="card"><h3>Flux annuels (USD)</h3><div style="overflow:auto"><table class="tbl"><thead><tr><th></th><th>2026</th>${r.annees.map(a => `<th>${a}</th>`).join('')}</tr></thead><tbody>
      ${[['Dossiers actifs', L.actifs, 0], ['Recettes publiques avec projet', L.avecProjet, 0], ['CA société de projet', L.ca, 0], ['EBITDA', L.ebitda, 0], ['Flux privé net', L.flux, 1], ['Cumul flux privé', L.cumul, 2], ['Gain public net', L.gainPublic, 0]]
        .map(([t, a, o]) => `<tr><td>${t}</td>${o === 2 ? '' : o === 1 ? `<td>${fmt(r.flux[0])}</td>` : '<td></td>'}${(o === 2 ? a : a).map(x => `<td ${neg(x)}>${fmt(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
    <div class="grid g2" style="margin-bottom:16px"><div class="card"><h3>Comparaison des trois cas</h3><table class="tbl"><thead><tr><th>Cas</th><th>VAN</th><th>TRI</th><th>Gain public net</th><th>Retour</th></tr></thead><tbody>${cmp.cas.map(c => `<tr><td>${esc(c.cas)}</td><td ${neg(c.van)}>${M(c.van)}</td><td>${P(c.tri)}</td><td>${M(c.gainPublicNet)}</td><td>${c.retourAnnees == null ? '—' : fmt(c.retourAnnees, 1) + ' ans'}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h3>Contrôles de réconciliation</h3>${r.controles.tests.map(t => `<div>${t.ok ? '✓' : '✘'} ${esc(t.nom)}</div>`).join('')}<p class="muted" style="margin-top:8px">${r.controles.ok ? 'Tous les écarts sont nuls.' : 'Au moins un écart non nul.'}</p></div></div>
    <div class="card"><h3>Effet d'une quote-part sur recettes (${P(qp.pct)})</h3><p>VAN ${M(qp.sans.van)} → <b>${M(qp.avec.van)}</b> (${qp.deltaVan >= 0 ? '+' : ''}${M(qp.deltaVan)}) ; gain public net ${M(qp.sans.gainPublicNet)} → <b>${M(qp.avec.gainPublicNet)}</b>.</p><p class="muted">${esc(qp.note)}</p></div>`;
  }
  async function leviers(el) {
    wait(el); let sn, so, sv, ti;
    try { [sn, so, sv, ti] = await Promise.all([call('sensibilite', { pct: 0.2 }), call('resoudre', { cible: 'van', valeur: 0 }), call('seuils'), call('resoudre', { cible: 'tri', valeur: 0.18 })]); } catch (e) { return err(el, e); }
    const mx = Math.max(...sn.leviers.map(l => Math.max(Math.abs(l.vanBas - sn.base.van), Math.abs(l.vanHaut - sn.base.van))), 1);
    const w = x => Math.round(Math.abs(x) / mx * 100);
    el.innerHTML = `<div class="card"><h3>Sensibilité de la VAN (±20 % par levier)</h3><p class="muted">Base ${M(sn.base.van)}. Barre rouge = −20 %, bleue = +20 %.</p>
      ${sn.leviers.map(l => { const a = l.vanBas - sn.base.van, b = l.vanHaut - sn.base.van; return `<div style="display:grid;grid-template-columns:200px 1fr 1fr 90px;gap:8px;align-items:center;margin:4px 0"><span>${esc(l.nom)}</span>
        <div><div style="height:12px;width:${w(a)}%;background:${a < 0 ? '#C21807' : '#007FFF'};border-radius:3px"></div></div><div><div style="height:12px;width:${w(b)}%;background:${b < 0 ? '#C21807' : '#007FFF'};border-radius:3px;opacity:.7"></div></div><span class="muted">${M(a)} / ${M(b)}</span></div>`; }).join('')}</div>
    <div class="grid g2" style="margin-bottom:16px"><div class="card"><h3>Ce qu'il faut pour VAN = 0 (un levier à la fois)</h3><table class="tbl"><thead><tr><th>Levier</th><th>Variation requise</th><th>Réaliste</th></tr></thead><tbody>${so.leviers.map(l => `<tr><td>${esc(l.nom)}</td><td>${l.atteignable ? (l.variationPct >= 0 ? '+' : '') + fmt(l.variationPct, 1) + ' %' : 'sans effet / hors plage'}</td><td>${l.atteignable ? (l.realiste ? '✓' : '✘') : '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h3>Pour TRI = 18 %</h3><table class="tbl"><tbody>${ti.leviers.filter(l => l.atteignable).map(l => `<tr><td>${esc(l.nom)}</td><td>${l.variationPct >= 0 ? '+' : ''}${fmt(l.variationPct, 1)} %</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3>Seuils d'équilibre</h3><ul><li>EBITDA stable hors enrôlement à partir de <b>${fmt(sv.seuilActifsEbitdaStable)}</b> dossiers actifs (${fmt(sv.couvertureSeuilPct, 1)} % de la population)</li>
      <li>VAN nulle avec <b>${sv.actifs2031VanNulle == null ? '—' : fmt(sv.actifs2031VanNulle)}</b> dossiers actifs en 2031 (×${sv.actifsFacteurVanNulle == null ? '—' : fmt(sv.actifsFacteurVanNulle, 2)} la trajectoire)</li>
      <li>Sans paiement de disponibilité la VAN tomberait à ${M(sv.vanSansDispo)} : la disponibilité est structurante</li><li>Retour sur investissement : ${sv.retourAnnees == null ? '—' : fmt(sv.retourAnnees, 1) + ' ans'}</li></ul></div>`;
  }
  async function optim(el) {
    wait(el); let o, r;
    try { [o, r] = await Promise.all([call('optimiser'), call('risque', { n: 2000 })]); } catch (e) { return err(el, e); }
    const s = o.solution;
    el.innerHTML = `<div class="card"><h3>Combinaison de leviers négociables (dépense publique minimale)</h3><p class="muted">Contraintes : VAN ≥ ${M(o.contraintes.vanMin)}, TRI ≥ ${P(o.contraintes.triMin)}, gain public net ≥ 0, prix ≤ ${o.contraintes.prixMax} $, disponibilité ≤ ×${o.contraintes.dispoMax}, CAPEX ≥ ×${o.contraintes.capexMin}.</p>
      ${s ? `<div class="grid g4" style="margin-bottom:16px">${kpi('Disponibilité', '×' + s.multDispo)}${kpi('Prix dossier actif', '×' + s.multPrixActif)}${kpi('CAPEX', '×' + s.multCapex, s.multCapex < 1 ? 'économies à documenter (tranches, coûts évités)' : '')}${kpi('VAN', M(s.van))}${kpi('TRI', P(s.tri))}${kpi('Gain public net', M(s.gainPublicNet))}</div>` : '<p>Aucune combinaison ne satisfait les contraintes.</p>'}<p class="muted">${esc(o.note)}</p></div>
    <div class="card"><h3>Risque (2 000 tirages)</h3><div class="grid g4" style="margin-bottom:16px">${kpi('Probabilité VAN ≥ 0', P(r.probVanPositive))}${kpi('VAN médiane', M(r.van.p50))}${kpi('VAN P5 – P95', `${M(r.van.p5)} → ${M(r.van.p95)}`)}${kpi('TRI médian', P(r.tri?.p50))}</div><p class="muted">${esc(r.note)}</p></div>`;
  }
  async function prov(el) {
    wait(el); let r;
    try { r = await call('simuler'); } catch (e) { return err(el, e); }
    const pv = r.provinces, fl = r.filieres;
    el.innerHTML = `<div class="grid g2" style="margin-bottom:16px"><div class="card"><h3>Phases de déploiement</h3><table class="tbl"><thead><tr><th>Phase</th><th>Prov.</th><th>Cible 2031</th><th>CAPEX</th><th>EBITDA 2031</th><th>Gain public 2031</th></tr></thead><tbody>${pv.phases.map(x => `<tr><td>${x.phase}</td><td>${x.provinces}</td><td>${fmt(x.cible)}</td><td>${M(x.capex)}</td><td ${neg(x.ebitda)}>${M(x.ebitda)}</td><td>${M(x.gainPublicNet)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>Recettes publiques 2031 par filière (panier hypothétique)</h3>${bars(fl.rows.map(f => ({ k: f.nom, v: f.recettes })), { horizontal: true, fmtv: M })}</div></div>
    <div class="card"><h3>26 provinces — allocation de planification</h3><div style="overflow:auto"><table class="tbl"><thead><tr><th>Province</th><th>Ph.</th><th>Cible 2031</th><th>Cartes</th><th>Autres recettes</th><th>EBITDA ident.</th><th>EBITDA collecte</th><th>CAPEX</th><th>Gain public</th></tr></thead><tbody>${pv.rows.map(x => `<tr><td>${esc(x.province)}</td><td>${x.phase}</td><td>${fmt(x.cible)}</td><td>${fmt(x.cartes)}</td><td>${fmt(x.autres)}</td><td ${neg(x.ebitdaIdent)}>${fmt(x.ebitdaIdent)}</td><td ${neg(x.ebitdaCollecte)}>${fmt(x.ebitdaCollecte)}</td><td>${fmt(x.capex)}</td><td ${neg(x.gainPublicNet)}>${fmt(x.gainPublicNet)}</td></tr>`).join('')}</tbody></table></div><p class="muted">Aucune ligne n'est un recensement provincial ; la collecte isolée reste un centre de coût (EBITDA négatif) sauf mutualisation explicite.</p></div>`;
  }
  async function dim(el) {
    el.innerHTML = `<div class="card"><h3>Dimensionnement de l'enrôlement</h3><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
      <label>Personnes à enrôler<input id="d_n" type="number" value="1500000" style="width:110px"></label><label>Années d'enrôlement<input id="d_a" type="number" value="1" min="1" style="width:70px"></label><label>Minutes / enrôlement<input id="d_m" type="number" value="10" min="1" style="width:70px"></label>
      <label>Marge sécurité (%)<input id="d_s" type="number" value="15" style="width:70px"></label><label>Sites fixes<input id="d_f" type="number" value="12" style="width:70px"></label><button class="btn" id="d_go">Calculer</button></div><div id="d_out" style="margin-top:12px"></div></div>`;
    const go = async () => { try { const r = await api('/modele/dimensionner', { enroles: +$('#d_n').value, anneesEnrolement: +$('#d_a').value, minutesEnrolement: +$('#d_m').value, margeSecurite: +$('#d_s').value / 100, sitesFixes: +$('#d_f').value });
      $('#d_out').innerHTML = `<div class="grid g4" style="margin-bottom:16px">${kpi('Kits au total', r.ceilKits, fmt(r.enrolementsParJourParKit) + ' enrôlements/jour/kit')}${kpi('Stations fixes', r.stationsFixes)}${kpi('Kits mobiles', Math.ceil(r.kitsMobiles))}${kpi('Tablettes', Math.ceil(r.tablettes))}${kpi('Agents', r.ceilAgents)}${kpi('Équipes', r.ceilEquipes)}</div><p class="muted">${esc(r.note)}</p>`; } catch (e) { toast(e.message, 'err'); } };
    $('#d_go').onclick = go; go();
  }
  const T = { synth, leviers, optim, prov, dim };
  const show = t => { $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); T[t]($('#pane')); };
  $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) { v.dataset.tab = b.dataset.t; show(b.dataset.t); } };
  $('#go').onclick = () => show(v.dataset.tab || 'synth');
  show('synth');
}
