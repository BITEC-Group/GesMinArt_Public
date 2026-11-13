// Certificats d'agrément des entités approuvées : liste, aperçu / impression du certificat, renouvellement et suspension (profils habilités).
import { api, qs } from '../api.js';
import { esc, $, $$, fmt, toast, modal } from '../ui.js';
import { ctx, can } from '../app.js';
import { apercu } from '../apercu.js';
import { certificatCorps, CERT_STYLE } from '../certificat.js';

const ST = { valide: ['Valide', 'ok'], expire: ['Expiré', 'bad'], suspendu: ['Suspendu', 'warn'] };
const pillSt = s => { const [l, c] = ST[s] || [s, '']; return `<span class="pill ${c}">${l}</span>`; };
const frd = d => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—');

export async function render(v) {
  const gere = can('agrements', 3), provNom = c => ctx.meta.provinces.find(p => p.code === c)?.nom || c;
  v.innerHTML = `<div class="pagehead"><div><h1>Certificats d'agrément</h1><p>Un certificat est produit pour chaque entité approuvée (coopérative, négociant, exportateur / comptoir) : dénomination, catégorie, responsable (nom et photo), dates, statut de validité et QR de vérification.</p></div></div>
  <div class="card"><div class="row"><div><label>Recherche</label><input id="q" placeholder="Dénomination, n° de certificat, responsable…"></div>
    <div><label>Catégorie</label><select id="cat"><option value="">Toutes</option><option value="COOP">Coopérative</option><option value="B">Négociant</option><option value="A">Exportateur / Comptoir</option></select></div>
    <div><label>Statut</label><select id="st"><option value="">Tous</option><option value="valide">Valide</option><option value="expire">Expiré</option><option value="suspendu">Suspendu</option></select></div>
    ${ctx.user.province ? '' : `<div><label>Province</label><select id="pv"><option value="">Toutes</option>${ctx.meta.provinces.map(p => `<option value="${p.code}">${esc(p.nom)}</option>`).join('')}</select></div>`}</div>
    <div class="flex wrap mt" id="cnt"></div></div>
  <div class="card mt" style="overflow:auto"><table class="tbl"><thead><tr><th>N° certificat</th><th>Entité</th><th>Catégorie</th><th>Province</th><th>Responsable</th><th>Expiration</th><th>Statut</th><th></th></tr></thead><tbody id="tb"></tbody></table><p class="muted small" id="more"></p></div>`;
  let rows = [];
  const load = async () => {
    const r = await api('/agrements' + qs({ q: $('#q').value, categorie: $('#cat').value, statut: $('#st').value, province: $('#pv')?.value, limit: 200 })); rows = r.rows;
    $('#cnt').innerHTML = `<span class="pill ok">Valides : ${fmt(r.comptes.valide)}</span><span class="pill bad">Expirés : ${fmt(r.comptes.expire)}</span><span class="pill warn">Suspendus : ${fmt(r.comptes.suspendu)}</span>`;
    $('#tb').innerHTML = rows.map(a => `<tr><td class="mono">${esc(a.numero)}</td><td><b>${esc(a.nom)}</b><br><span class="muted small">${esc(a.reference || '')}</span></td><td>${esc(a.categorie_libelle)}</td><td>${esc(provNom(a.province))}</td><td>${esc(a.responsable_nom || '—')}</td><td>${frd(a.date_expiration)}</td><td>${pillSt(a.statut)}${a.motif ? `<br><span class="muted small">${esc(a.motif)}</span>` : ''}</td>
      <td class="flex" style="gap:6px"><button class="btn sm pri" data-cert="${a.id}">Certificat</button>${gere ? `<button class="btn sm" data-ren="${a.id}">Renouveler</button>${a.statut === 'suspendu' ? `<button class="btn sm" data-ret="${a.id}">Rétablir</button>` : `<button class="btn sm" data-sus="${a.id}">Suspendre</button>`}` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Aucun certificat pour ces critères.</td></tr>';
    $('#more').textContent = r.total > rows.length ? `${fmt(r.total)} résultats : les ${rows.length} premiers sont affichés, affinez la recherche.` : '';
  };
  let t; const diff = () => { clearTimeout(t); t = setTimeout(() => load().catch(e => toast(e.message, 'bad')), 300); };
  ['#q', '#cat', '#st', '#pv'].forEach(s => $(s)?.addEventListener(s === '#q' ? 'input' : 'change', diff));
  const motif = (titre, cb) => { const m = modal(titre, `<div class="f"><label>Motif (obligatoire)</label><textarea id="mt" rows="3" placeholder="Référence de la décision, constat…"></textarea></div><div class="flex"><button class="btn pri" id="ok">Confirmer</button></div>`, { width: '480px' });
    $('#ok', m.el).onclick = async () => { const mt = $('#mt', m.el).value.trim(); if (mt.length < 5) return toast('Motif obligatoire (5 caractères minimum)', 'bad'); try { await cb(mt); m.close(); await load(); } catch (e) { toast(e.message, 'bad'); } }; };
  v.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.cert) { const d = await api(`/agrements/${b.dataset.cert}/certificat`); await apercu({ titre: `Certificat d'agrément ${d.numero}`, corps: certificatCorps(d, { provinceNom: provNom(d.province) }), style: CERT_STYLE + '.cert{margin:0 auto}', orientation: 'landscape', marge: '8mm' }); }
      else if (b.dataset.ren) { const a = rows.find(x => x.id == b.dataset.ren); if (!confirm(`Renouveler le certificat de « ${a.nom} » ? La nouvelle période commence aujourd'hui.`)) return; const r = await api('/agrements/emettre', { entite_type: a.entite_type, entite_id: a.entite_id }); toast(`Certificat ${r.numero} renouvelé jusqu'au ${frd(r.date_expiration)}`, 'ok'); await load(); }
      else if (b.dataset.sus) motif('Suspendre l\'agrément', mt => api(`/agrements/${b.dataset.sus}/statut`, { statut: 'suspendu', motif: mt }));
      else if (b.dataset.ret) { await api(`/agrements/${b.dataset.ret}/statut`, { statut: 'valide' }); toast('Agrément rétabli', 'ok'); await load(); }
    } catch (err) { toast(err.message, 'bad'); }
  });
  await load();
}
