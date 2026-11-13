// Cartes biométriques : concepteur (design), file de production, lots d'impression, vérification (QR).
import { api, qs } from '../api.js';
import { esc, $, $$, pill, fmt, dt, dtt, toast, modal } from '../ui.js';
import { ctx, can as perm } from '../app.js';
import * as card from '../card.js';
import { hw } from '../hw.js';

export async function render(v) {
  const canProd = perm('cartes', 2);
  v.innerHTML = `<div class="pagehead"><div><h1>Cartes biométriques — design, production, vérification</h1><p>Format CR80 aux couleurs nationales : bleu ciel, jaune, rouge, étoile et carte du pays. Le gabarit biométrique n'est jamais imprimé.</p></div></div>
  <div class="tabs" id="tabs"><button data-t="design" class="on">Concepteur</button><button data-t="queue">File d'impression</button><button data-t="lots">Lots</button><button data-t="verif">Vérifier une carte</button></div><div id="pane"></div>`;
  const tabs = { design, queue, lots, verif }; const show = t => { $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); tabs[t]($('#pane')); };
  $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) show(b.dataset.t); }; show('design');

  async function design(p) {
    const list = (await api('/cartes' + qs({ limit: 60 }))); const o = { compact: false, noMap: false, showCoop: true, accent: '', cat: '' };
    p.innerHTML = `<div class="grid g-main"><div class="card"><h2>Aperçu <small id="pinfo"></small></h2><div class="idc-wrap" id="prev"></div></div>
    <div class="card"><h2>Paramètres de mise en page</h2><div class="f"><label>Titulaire (aperçu)</label><select id="who">${list.map(c => `<option value="${c.id}">${esc(c.nom)} ${esc(c.postnom || '')} — ${c.categorie} · ${esc(c.numero)}</option>`).join('')}</select></div>
    <label class="chk"><input type="checkbox" id="oCoop" checked> Afficher la coopérative</label><label class="chk"><input type="checkbox" id="oMap" checked> Filigrane carte de la RDC</label>
    <div class="f mt"><label>Couleur d'accent</label><select id="oAcc"><option value="">Selon la catégorie (A rouge · B/C bleu)</option><option value="#007FFF">Bleu ciel national</option><option value="#CE1021">Rouge national</option><option value="#0a2a5e">Bleu nuit</option><option value="#1a9b5b">Vert (ZEA)</option></select></div>
    <div class="f"><label>Catégorie simulée</label><select id="oCat"><option value="">Réelle</option><option>A</option><option>B</option><option>C</option></select></div>
    <p class="small muted">Code couleur de catégorie : <span class="pill bad">A</span> exportateur / comptoir · <span class="pill warn">B</span> négociant · <span class="pill info">C</span> exploitant. Au dos : QR de vérification, mentions légales et ligne lisible par machine.</p>
    <div class="flex wrap"><button class="btn pri" id="oPrint">Imprimer cette carte</button></div></div></div>`;
    const draw = async () => { const d = await api('/cartes/' + $('#who').value + '/data'); if (o.cat) d.categorie = o.cat; const op = { accent: o.accent, noMap: o.noMap, showCoop: o.showCoop }; $('#prev').innerHTML = card.front(d, op) + card.back(d, op); $('#pinfo').textContent = d.numero; return d; };
    $('#who').onchange = draw; $('#oCoop').onchange = e => { o.showCoop = e.target.checked; draw(); }; $('#oMap').onchange = e => { o.noMap = !e.target.checked; draw(); }; $('#oAcc').onchange = e => { o.accent = e.target.value; draw(); }; $('#oCat').onchange = e => { o.cat = e.target.value; draw(); };
    $('#oPrint').onclick = async () => { const d = await draw(); if (!card.printSheet([d], { accent: o.accent, noMap: o.noMap, showCoop: o.showCoop })) toast('Fenêtre d\'impression bloquée', 'bad'); }; draw();
  }
  async function queue(p) {
    const rows = await api('/cartes' + qs({ statut: 'a_imprimer', limit: 200 }));
    p.innerHTML = `<div class="card"><h2>Cartes à imprimer <small>${rows.length} en file</small></h2>${canProd ? '' : '<div class="alert warn">Lecture seule pour votre rôle.</div>'}<div class="scroll"><table class="tbl"><thead><tr><th><input type="checkbox" id="all" style="width:auto"></th><th>Carte</th><th>Titulaire</th><th>Cat.</th><th>Province</th><th>Émise</th></tr></thead><tbody>${rows.map(c => `<tr><td><input type="checkbox" class="sel" value="${c.id}" style="width:auto"></td><td class="mono">${esc(c.numero)}</td><td>${esc(c.nom)} ${esc(c.postnom || '')} ${esc(c.prenom || '')}</td><td>${c.categorie}</td><td>${esc(c.province)}</td><td>${dt(c.emise_le)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">File vide.</td></tr>'}</tbody></table></div>
    <div class="flex mt"><span class="muted small" id="selc">0 sélectionnée(s)</span><span class="sp"></span><button class="btn pri" id="mk" ${canProd ? '' : 'disabled'}>Créer un lot d'impression et imprimer</button></div></div>`;
    const upd = () => $('#selc').textContent = $$('.sel:checked').length + ' sélectionnée(s)'; $('#all').onchange = e => { $$('.sel').forEach(c => c.checked = e.target.checked); upd(); }; p.onchange = upd;
    $('#mk').onclick = async () => { const ids = $$('.sel:checked').map(c => +c.value); if (!ids.length) return toast('Sélectionnez des cartes', 'bad'); try { const l = await api('/cartes/lot', { ids }); const data = await Promise.all(ids.slice(0, 40).map(i => api('/cartes/' + i + '/data'))); toast(`Lot ${l.reference} créé (${l.nb} cartes)`, 'ok'); card.printSheet(data); queue(p); } catch (e) { toast(e.message, 'bad'); } };
  }
  async function lots(p) {
    const rows = await api('/lots-impression'); const next = { en_preparation: 'imprime', imprime: 'expedie', expedie: 'livre' };
    p.innerHTML = `<div class="card"><h2>Lots d'impression & livraison</h2><table class="tbl"><thead><tr><th>Référence</th><th>Créé</th><th>Province</th><th class="num">Cartes</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map(l => `<tr><td class="mono">${esc(l.reference)}</td><td>${dt(l.cree_le)}</td><td>${esc(l.province || '—')}</td><td class="num">${l.nb}</td><td>${pill(l.statut)}</td><td>${next[l.statut] && canProd ? `<button class="btn sm" data-id="${l.id}" data-s="${next[l.statut]}">→ ${next[l.statut]}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
    p.onclick = async e => { const b = e.target.closest('button[data-id]'); if (!b) return; try { await api(`/lots-impression/${b.dataset.id}/statut`, { statut: b.dataset.s }); toast('Statut du lot mis à jour', 'ok'); lots(p); } catch (x) { toast(x.message, 'bad'); } };
  }
  function verif(p) {
    p.innerHTML = `<div class="grid g2"><div class="card"><h2>Vérification d'une carte</h2><p class="muted">Saisissez l'identifiant ou le numéro de carte, ou lisez le QR / la carte NFC avec le POS. Réponse publique minimale ; les quatre preuves restent <b>séparées</b>.</p><div class="row"><div><input id="code" placeholder="IDM-CD-LU-000001 ou CRT-C-LU-000001"></div><div class="auto"><button class="btn pri" id="go">Vérifier</button></div><div class="auto"><button class="btn" id="nfc">Lire NFC</button></div></div></div><div class="card" id="res"><h2>Résultat</h2><p class="muted">En attente d'une saisie.</p></div></div>`;
    const run = async () => { try { const r = await api('/verify/' + encodeURIComponent($('#code').value.trim())); const s = r.statuts; const exp = r.expire_le && new Date(r.expire_le) < new Date();
      $('#res').innerHTML = `<h2>${esc(r.nom)}</h2><div class="flex"><div class="avatar" style="width:54px;height:54px">${r.photo ? `<img src="${r.photo}">` : esc(r.nom[0])}</div><div><span class="mono">${esc(r.uid)}</span><br>${esc(r.metier || '')} · cat. ${r.categorie} · ${esc(r.province)}</div></div>
      <div class="four mt"><div><small>① Identité</small>${pill(s.identite)}</div><div><small>② Droit d'exercer</small>${pill(s.droit_exercer)}</div><div><small>③ Sécurité du site</small>${s.securite_site ? pill(s.securite_site) : '—'}</div><div><small>④ Origine lot</small><span class="muted small">à vérifier par lot</span></div></div>
      <dl class="kv mt"><dt>Carte</dt><dd>${esc(r.carte || '—')} ${pill(r.carte_statut)} ${exp ? '<span class="pill bad">échue</span>' : ''}</dd><dt>Coopérative</dt><dd>${esc(r.cooperative?.nom || '—')} ${r.cooperative ? pill(r.cooperative.agrement_statut === 'valide' ? 'valide' : 'expire') : ''}</dd><dt>Site</dt><dd>${esc(r.site?.nom || '—')}</dd><dt>Notes impayées</dt><dd>${r.notes_impayees}</dd></dl><div class="alert mt small">Une identité vérifiée ne valide aucun des trois autres statuts. Cette vérification n'autorise aucune sanction automatique.</div>`; hw.beep(); } catch (e) { $('#res').innerHTML = `<h2>Résultat</h2><div class="alert bad">${esc(e.message)}</div>`; hw.beep(400); } };
    $('#go').onclick = run; $('#code').onkeydown = e => { if (e.key === 'Enter') run(); };
    $('#nfc').onclick = async () => { try { toast('Présentez la carte…'); const r = await hw.readNfc(); toast('Carte lue' + (r.simule ? ' (simulée)' : '') + ' : ' + r.atr, 'ok'); if (!$('#code').value) toast('Saisissez le numéro pour la démo — le lien UID NFC ↔ carte est établi à l\'émission sur POS.'); } catch (e) { toast(e.message, 'bad'); } };
  }
}
