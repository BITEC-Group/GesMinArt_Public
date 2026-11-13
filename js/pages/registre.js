// Registre central des acteurs : recherche, fiche, quatre statuts distincts, validation humaine.
import { api, qs } from '../api.js';
import { esc, $, $$, pill, fmt, dt, dtt, modal, toast, initials, usd2, CAT } from '../ui.js';
import { ctx, go, can as perm } from '../app.js';
import * as card from '../card.js';

export async function render(v, arg) {
  const st = { q: '', province: /^CD-/.test(arg || '') ? arg : (ctx.user.province || ''), categorie: '', statut: '', exercice: '', offset: 0 };
  v.innerHTML = `<div class="pagehead"><div><h1>Registre des acteurs</h1><p>Un identifiant unique par personne. L'identité vérifiée <b>ne valide pas</b> à elle seule le droit d'exercer (Manuel §4).</p></div><span class="sp"></span><button class="btn pri" id="bNew">✚ Enrôler</button></div>
  <div class="card"><div class="row"><div><label>Recherche</label><input id="q" placeholder="Nom, ID, téléphone…"></div><div><label>Province</label><select id="province"><option value="">Toutes</option>${ctx.meta.provinces.map(p => `<option value="${p.code}" ${p.code === st.province ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></div>
  <div><label>Catégorie</label><select id="categorie"><option value="">Toutes</option><option value="A">A — Exportateur/comptoir</option><option value="B">B — Négociant</option><option value="C">C — Exploitant</option></select></div>
  <div><label>Identité</label><select id="statut"><option value="">Toutes</option><option value="verifie">Vérifiée</option><option value="en_attente">En attente</option><option value="doublon_suspect">Doublon suspect</option><option value="rejete">Rejetée</option></select></div>
  <div><label>Droit d'exercer</label><select id="exercice"><option value="">Tous</option><option value="valide">Valide</option><option value="expire">Expiré</option><option value="suspendu">Suspendu</option><option value="non_valide">Non validé</option></select></div></div>
  <div class="scroll mt"><table class="tbl"><thead><tr><th></th><th>Identité</th><th>ID unique</th><th>Cat.</th><th>Activité</th><th>Site / coopérative</th><th>Identité</th><th>Exercice</th></tr></thead><tbody id="tb"></tbody></table></div>
  <div class="flex mt"><span class="muted small" id="info"></span><span class="sp"></span><button class="btn sm" id="prev">‹ Précédent</button><button class="btn sm" id="next">Suivant ›</button></div></div>`;
  $('#bNew').onclick = () => go('enrolement'); if (!perm('personnes', 2)) $('#bNew').style.display = 'none';
  let t; const load = async () => {
    const r = await api('/personnes' + qs({ ...st, limit: 40 })); $('#info').textContent = `${fmt(r.total)} résultat(s) — ${fmt(st.offset + 1)} à ${fmt(Math.min(r.total, st.offset + 40))}`;
    $('#tb').innerHTML = r.rows.map(p => `<tr class="click" data-id="${p.id}"><td><div class="avatar" style="width:30px;height:30px;font-size:12px;background:${p.sexe === 'F' ? '#CE1021' : '#007FFF'}">${initials(p.nom, p.prenom)}</div></td><td><b>${esc(p.nom)} ${esc(p.postnom || '')}</b><br><span class="muted small">${esc(p.prenom || '')} · ${p.sexe || ''}</span></td><td class="mono">${esc(p.uid)}</td><td><span class="pill ${p.categorie === 'A' ? 'bad' : p.categorie === 'B' ? 'warn' : 'info'}">${p.categorie}</span></td><td>${esc(p.metier || '')}<br><span class="muted small">${esc(p.substance || '')}</span></td><td>${esc(p.site || '—')}<br><span class="muted small">${esc(p.cooperative || '')}</span></td><td>${pill(p.statut_identite)}</td><td>${pill(p.statut_exercice)}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Aucun résultat.</td></tr>';
    $('#prev').disabled = st.offset === 0; $('#next').disabled = st.offset + 40 >= r.total;
  };
  for (const k of ['province', 'categorie', 'statut', 'exercice']) $('#' + k).onchange = e => { st[k] = e.target.value; st.offset = 0; load(); };
  $('#q').oninput = e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; st.offset = 0; load(); }, 250); };
  $('#prev').onclick = () => { st.offset = Math.max(0, st.offset - 40); load(); }; $('#next').onclick = () => { st.offset += 40; load(); };
  $('#tb').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) fiche(tr.dataset.id, load); };
  load();
}
export async function fiche(id, onChange) {
  const p = await api('/personnes/' + id); const full = p.cartes[0] ? await api('/cartes/' + p.cartes[0].id + '/data') : null;
  const can = perm('personnes', 3);
  const m = modal(`${esc(p.nom)} ${esc(p.postnom || '')} ${esc(p.prenom || '')} <span class="mono muted">${esc(p.uid)}</span>`, `
  <div class="four"><div><small>① Identité</small>${pill(p.statut_identite)}</div><div><small>② Droit d'exercer</small>${pill(p.statut_exercice)}</div><div><small>③ Sécurité du site</small>${p.site_nom ? '<span class="muted small">voir site</span>' : '—'}</div><div><small>④ Origine des lots</small>${p.lots.length ? p.lots.length + ' lot(s)' : '—'}</div></div>
  <div class="grid g2 mt"><div><dl class="kv"><dt>Catégorie</dt><dd>${CAT[p.categorie]}</dd><dt>Activité</dt><dd>${esc(p.metier || '—')} · ${esc(p.substance || '—')}</dd><dt>Naissance</dt><dd>${dt(p.date_naissance)} · ${esc(p.lieu_naissance || '')}</dd><dt>Téléphone</dt><dd>${esc(p.telephone || '—')}</dd><dt>Site principal</dt><dd>${esc(p.site_nom || '—')}</dd><dt>Coopérative</dt><dd>${esc(p.cooperative_nom || '—')}</dd><dt>Biométrie</dt><dd>${p.empreinte_doigts} doigt(s) · gabarit ${esc(p.empreinte_gabarit || '—')}</dd><dt>Enrôlé le</dt><dd>${dtt(p.cree_le)}</dd></dl>
  ${can && ['en_attente', 'doublon_suspect'].includes(p.statut_identite) ? `<div class="alert warn mt">Décision humaine requise — aucune exclusion irréversible automatisée.<div class="flex mt"><button class="btn sm pri" id="dOk">Valider l'identité</button><button class="btn sm warn" id="dKo">Rejeter</button></div></div>` : ''}</div>
  <div>${full ? `<div style="transform:scale(.78);transform-origin:top left;height:214px;width:340px">${card.front(full)}</div>` : '<p class="muted">Aucune carte émise.</p>'}</div></div>
  ${perm('identite') ? `<div class="flex mt"><button class="btn sm" id="dosId">Dossier d'identité & vérification</button></div>` : ''}<h3 class="mt">Notes de perception</h3><table class="tbl"><tbody>${p.notes.slice(0, 6).map(n => `<tr><td class="mono">${esc(n.numero)}</td><td>${esc(n.taxe_id)} ${esc(n.libelle)}</td><td class="num">${usd2(n.montant)}</td><td>${pill(n.statut)}</td></tr>`).join('') || '<tr><td class="muted">Aucune note.</td></tr>'}</tbody></table>
  <h3 class="mt">Affectations de site <span class="muted small">(historisées — un changement de site clôt l'affectation précédente)</span></h3><table class="tbl"><tbody>${p.affectations.map(a => `<tr><td>${esc(a.site)}</td><td>${esc(a.role || '')}</td><td>${dt(a.debut)}</td><td>${a.fin ? dt(a.fin) : '<span class="pill ok">en cours</span>'}</td></tr>`).join('')}</tbody></table>`, { width: '980px' });
  if ($('#dosId', m.el)) $('#dosId', m.el).onclick = () => { m.close(); go('identite/' + p.id); };
  if ($('#dOk', m.el)) { $('#dOk', m.el).onclick = () => decide('verifie'); $('#dKo', m.el).onclick = () => decide('rejete'); }
  async function decide(d) { const motif = d === 'rejete' ? prompt('Motif du rejet (conservé au dossier) :') : null; if (d === 'rejete' && !motif) return; try { await api(`/personnes/${p.id}/valider`, { decision: d, motif }); toast('Décision enregistrée', 'ok'); m.close(); onChange && onChange(); } catch (e) { toast(e.message, 'bad'); } }
}
