// Conformité réglementaire : classification des acteurs, sanctions (procédure contradictoire) et chaîne de traçabilité (mine -> export).
import { api, qs } from '../api.js';
import { esc, $, fmt, toast } from '../ui.js';
import { can } from '../app.js';

const frd = s => (s ? new Date(s).toLocaleDateString('fr-FR') : '—');
const STAT = { constatee: ['Constatée', 'warn'], notifiee: ['Notifiée', 'warn'], decidee: ['Sanction décidée', 'bad'], classee: ['Classée', ''], executee: ['Exécutée', 'ok'], prepare: ['Préparé', 'warn'], certifie: ['Certifié', 'ok'], exporte: ['Exporté', 'ok'], bloque: ['Bloqué', 'bad'] };
const pill = s => { const [l, c] = STAT[s] || [s, '']; return `<span class="pill ${c}">${esc(l)}</span>`; };
const demande = (q, def = '') => { const t = prompt(q, def); return t == null ? null : t.trim(); };

export async function render(v) {
  const tabs = [['cls', 'Classification'], ['san', 'Sanctions'], ['tra', 'Traçabilité']].filter(t => t[0] === 'cls' ? can('conformite', 1) : t[0] === 'san' ? can('sanctions', 1) : can('tracabilite', 1));
  v.innerHTML = `<div class="pagehead"><div><h1>Conformité & traçabilité</h1><p>Classification des acteurs, sanctions selon la procédure contradictoire et chaîne de traçabilité de la mine à l'exportation. Les barèmes et références légales sont des paramètres à confirmer avec les textes officiels.</p></div></div>
    <div class="flex wrap" id="onglets">${tabs.map((t, i) => `<button class="btn ${i ? '' : 'pri'}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div><div id="corps" class="mt"></div>`;
  const vues = { cls: classification, san: sanctions, tra: tracabilite };
  async function aller(t) { for (const b of v.querySelectorAll('#onglets button')) b.classList.toggle('pri', b.dataset.t === t); $('#corps').innerHTML = '<p class="muted">Chargement…</p>'; try { await vues[t]($('#corps')); } catch (e) { $('#corps').innerHTML = `<p class="muted">${esc(e.message)}</p>`; } }
  v.querySelector('#onglets').onclick = e => { const b = e.target.closest('button'); if (b) aller(b.dataset.t); };
  if (tabs.length) await aller(tabs[0][0]); else $('#corps').innerHTML = '<p class="muted">Votre profil n\'a accès à aucun de ces modules.</p>';
}

async function classification(el) {
  const c = await api('/conformite/classification'), o = await api('/organisations').catch(() => []);
  el.innerHTML = `<div class="card"><h2>Classes d'acteurs</h2><p class="small muted">${esc(c.base_legale)}</p><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Classe</th><th>Autorité</th><th>Document</th><th>Validité</th><th>Conditions contrôlées</th></tr></thead><tbody>
    ${Object.entries(c.classes).map(([k, x]) => `<tr><td><b>${esc(x.libelle)}</b><br><span class="muted small">${esc(k)}</span></td><td>${esc(x.autorite || '—')}</td><td>${esc(x.document || '—')}</td><td>${x.validite_mois ? x.validite_mois + ' mois' : '—'}</td><td class="small">${(x.conditions || []).map(k2 => esc(c.conditions[k2] || k2)).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card mt"><h2>Organisations (comptoirs, entités de traitement)</h2><div class="flex wrap"><button class="btn" id="nouv" ${can('conformite', 2) ? '' : 'hidden'}>Enregistrer un comptoir</button></div>
    <div style="overflow-x:auto"><table class="tbl mt"><thead><tr><th>Dénomination</th><th>Classe</th><th>Province</th><th>Statut</th><th>Expiration</th><th></th></tr></thead><tbody id="orgs"></tbody></table></div></div>`;
  const dessiner = l => { $('#orgs').innerHTML = l.map(x => `<tr><td><b>${esc(x.nom)}</b></td><td>${esc(x.classe)}</td><td>${esc(x.province)}</td><td>${x.agree ? '<span class="pill ok">Agréé</span>' : `<span class="pill warn">${esc(x.statut)}</span>`}</td><td>${frd(x.date_expiration)}</td><td>${can('conformite', 3) && !x.agree ? `<button class="btn sm" data-ag="${x.id}">Agréer (arrêté)</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucune organisation.</td></tr>'; };
  dessiner(o);
  el.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.id === 'nouv') { const nom = demande('Dénomination du comptoir'); if (!nom) return; const prov = demande('Code province (ex. CD-LU)', 'CD-LU'); if (!prov) return; await api('/organisations', { classe: 'COMPTOIR', nom, province: prov, droit_congolais: true }); toast('Comptoir enregistré (en instruction)', 'ok'); dessiner(await api('/organisations')); }
      else if (b.dataset.ag) { const ar = demande('Référence de l\'arrêté ministériel d\'agrément'); if (!ar) return; await api(`/organisations/${b.dataset.ag}/agreer`, { arrete_agrement: ar }); toast('Organisation agréée', 'ok'); dessiner(await api('/organisations')); }
    } catch (err) { toast(err.message + (err.data?.verifications ? ' — ' + err.data.verifications.filter(x => x.statut !== 'ok').map(x => x.libelle).join(', ') : ''), 'bad'); }
  };
}

async function sanctions(el) {
  const [b, l] = await Promise.all([api('/sanctions/bareme'), api('/infractions?limit=100')]);
  el.innerHTML = `<div class="card"><h2>Dossiers d'infraction</h2><p class="small muted">${esc(b.avertissement)} Délai de réponse du mis en cause : ${b.delai_reponse_jours} jour(s). Aucune mesure n'est appliquée avant la décision motivée d'un second agent (quatre yeux).</p>
    <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Référence</th><th>Infraction</th><th>Province</th><th>Statut</th><th>Amende</th><th></th></tr></thead><tbody>
    ${l.rows.map(x => `<tr><td><b>${esc(x.reference)}</b><br><span class="muted small">${frd(x.date_faits)}</span></td><td>${esc(x.bareme?.libelle || x.code)}<br><span class="muted small">${esc(x.bareme?.reference || '')}</span></td><td>${esc(x.province)}</td><td>${pill(x.statut)}${x.transmis_parquet ? '<br><span class="pill bad">Parquet</span>' : ''}</td><td>${x.amende_decidee ? fmt(x.amende_decidee) + ' $' + (x.amende_payee ? ' (payée)' : '') : '—'}</td>
      <td class="flex" style="gap:6px">${x.statut === 'constatee' && can('sanctions', 2) ? `<button class="btn sm" data-n="${x.id}">Notifier</button>` : ''}${x.statut === 'notifiee' && can('sanctions', 3) ? `<button class="btn sm" data-d="${x.id}">Décider</button>` : ''}${x.statut === 'decidee' && can('sanctions', 3) ? `<button class="btn sm" data-x="${x.id}">Exécuter</button>` : ''}${x.statut === 'executee' && x.amende_decidee && !x.amende_payee && can('sanctions', 2) ? `<button class="btn sm" data-p="${x.id}">Amende payée</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun dossier.</td></tr>'}</tbody></table></div></div>`;
  el.onclick = async e => {
    const bt = e.target.closest('button'); if (!bt) return;
    try {
      if (bt.dataset.n) { await api(`/infractions/${bt.dataset.n}/notifier`, {}); toast('Notification enregistrée', 'ok'); }
      else if (bt.dataset.d) { const dec = demande('Décision : « sanction » ou « classement »', 'sanction'); if (!dec) return; const motif = demande('Motif de la décision (10 caractères minimum)'); if (!motif) return; const body = { decision: dec, motif }; if (dec === 'sanction') { const am = demande('Amende en USD (laisser vide si aucune)'); if (am) body.amende = Number(am); const me = demande('Mesures (séparées par des virgules, ex. retrait_carte,saisie)'); if (me) body.mesures = me.split(',').map(s => s.trim()).filter(Boolean); } const rn = demande('Référence de renonciation écrite au délai (laisser vide si le délai est écoulé)'); if (rn) body.renonciation_delai = rn; const r = await api(`/infractions/${bt.dataset.d}/decider`, body); toast(r.transmis_parquet ? 'Décision enregistrée — dossier transmis au parquet' : 'Décision enregistrée', 'ok'); }
      else if (bt.dataset.x) { let saisies; const inv = demande('Inventaire des saisies : désignation (vide si aucune saisie)'); if (inv) saisies = [{ designation: inv, quantite: Number(demande('Quantité', '1')) || 1, unite: 'u' }]; const r = await api(`/infractions/${bt.dataset.x}/executer`, { saisies }); toast('Exécutée : ' + (r.effets.join(' ; ') || 'aucun effet administratif'), 'ok'); }
      else if (bt.dataset.p) { const ref = demande('Référence de la quittance'); if (!ref) return; await api(`/infractions/${bt.dataset.p}/amende-payee`, { reference: ref }); toast('Paiement enregistré', 'ok'); }
      else return;
      await sanctions(el);
    } catch (err) { toast(err.message, 'bad'); }
  };
}

async function tracabilite(el) {
  const [r, l] = await Promise.all([api('/tracabilite/risques'), api('/tracabilite/lots-export')]);
  el.innerHTML = `<div class="card"${r.alertes ? ' style="border-left:5px solid #c0152a"' : ''}><h2>Risques de contamination</h2><p class="small">${r.alertes ? `${r.etiquettes_site_rouge.length} étiquette(s) issue(s) de sites rouges encore dans la chaîne, ${r.lots_bloques.length} lot(s) bloqué(s).` : 'Aucun risque détecté.'} ${r.en_transit} sac(s) en transit.</p>
    ${r.lots_bloques.length ? `<ul class="small">${r.lots_bloques.map(x => `<li><b>${esc(x.reference)}</b> — ${esc(x.motif || '')}</li>`).join('')}</ul>` : ''}</div>
    <div class="card mt"><h2>Lots d'exportation</h2><p class="small muted">Chaîne : étiquette de mine → feuille de route du négociant → bordereau du comptoir agréé → certificat CEEC (CIRGL / Kimberley) → droits et permis → exportation.</p>
    <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Lot</th><th>Substance</th><th>Poids net</th><th>Statut</th><th>Certificat</th><th></th></tr></thead><tbody>
    ${l.map(x => `<tr><td><b>${esc(x.reference)}</b><br><span class="muted small">${esc(x.etiquette_comptoir)}</span></td><td>${esc(x.substance)}</td><td>${fmt(x.poids_net_kg, 2)} kg</td><td>${pill(x.statut)}</td><td class="small">${esc(x.cert_numero || '—')}</td>
      <td class="flex" style="gap:6px">${x.statut === 'prepare' && can('tracabilite', 3) ? `<button class="btn sm" data-c="${x.id}">Certifier (CEEC)</button>` : ''}${x.statut === 'certifie' && can('tracabilite', 3) ? `<button class="btn sm" data-e="${x.id}">Autoriser la sortie</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun lot d\'exportation.</td></tr>'}</tbody></table></div></div>`;
  el.onclick = async e => {
    const bt = e.target.closest('button'); if (!bt) return;
    try {
      if (bt.dataset.c) { const val = demande('Valeur marchande évaluée (USD)'); if (!val) return; const x = await api(`/tracabilite/lots-export/${bt.dataset.c}/certifier`, { valeur_usd: Number(val) }); toast('Certificat émis : ' + x.certificat, 'ok'); }
      else if (bt.dataset.e) { const droits = demande('Référence de paiement des droits d\'exportation'); if (!droits) return; const permis = demande('N° de permis d\'exportation'); if (!permis) return; const pt = demande('Point de sortie', 'Kasumbalesa'); if (!pt) return; await api(`/tracabilite/lots-export/${bt.dataset.e}/exporter`, { droits_ref: droits, permis_no: permis, point_sortie: pt }); toast('Exportation autorisée', 'ok'); }
      else return;
      await tracabilite(el);
    } catch (err) { toast(err.message, 'bad'); }
  };
}
