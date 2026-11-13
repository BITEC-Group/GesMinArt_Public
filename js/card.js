// Rendu des cartes d'identité biométriques GesMinArt (CR80). Couleurs nationales, silhouette de la RDC, étoile.
import { apercu } from './apercu.js';
import { RDC_VB, RDC_D } from './rdcmap.js';
import { esc, initials } from './ui.js';
export const STAR = '<svg class="star" viewBox="0 0 100 100"><polygon fill="#F7D618" stroke="#fff" stroke-width="3" points="50,6 61.8,37.6 95.5,38.8 69,59.6 78.2,92 50,73.5 21.8,92 31,59.6 4.5,38.8 38.2,37.6"/></svg>';
export const mapSvg = (cls = '', fill = '#fff') => `<svg class="${cls}" viewBox="${RDC_VB}"><path d="${RDC_D}" fill="${fill}" stroke="#F7D618" stroke-width="2" stroke-linejoin="round"/></svg>`;
export const ACC = { A: '#CE1021', B: '#007FFF', C: '#007FFF' };
export const CATNAME = { A: 'EXPORTATEUR / COMPTOIR', B: 'NÉGOCIANT', C: 'EXPLOITANT ARTISANAL' };
const payload = d => `IDM|${d.uid}|${d.numero}|${d.categorie}`;
export function qrSvg(text) { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
const fd = s => s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
export function mrz(d) { const p = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '<'); const l1 = `IDMCD${d.province.slice(3)}<${d.uid.slice(-6)}<${d.categorie}<${(d.expire_le || '').replace(/-/g, '').slice(2)}`; const l2 = `${p(d.nom)}<<${p(d.prenom)}<${p(d.postnom)}`; return (l1 + '<'.repeat(30)).slice(0, 30) + '<br>' + (l2 + '<'.repeat(30)).slice(0, 30); }
export function front(d, o = {}) {
  const acc = o.accent || ACC[d.categorie] || '#007FFF';
  return `<div class="idc front ${o.compact ? 'compact' : ''} ${o.noMap ? 'noqrmap' : ''}" style="--acc:${acc}"><div class="bg"></div>${o.noMap ? '' : mapSvg('watermark', '#007FFF')}
  <div class="hd">${mapSvg('map', '#fff')}<div><b>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</b><small>MINISTÈRE DES MINES · SAEMAPE — GesMinArt</small></div>${STAR}</div>
  <div class="bd"><div class="ph" style="${d.photo ? '' : 'background:' + acc}">${d.photo ? `<img src="${d.photo}" alt="">` + (d.photo.startsWith("data:image/jpeg") ? `<span class="spec">SPÉCIMEN</span>` : "") : initials(d.nom, d.prenom)}</div>
  <div><div class="nm">${esc(d.nom)} ${esc(d.postnom || '')}</div><div class="pn">${esc(d.prenom || '')}</div>
  <dl><dt>Identifiant</dt><dd class="mono">${esc(d.uid)}</dd><dt>Activité</dt><dd>${esc(d.metier || CATNAME[d.categorie])}${d.substance ? ' · ' + esc(d.substance) : ''}</dd><dt>Né(e) le</dt><dd>${fd(d.date_naissance)} · ${esc(d.sexe || '')}</dd><dt>Province</dt><dd>${esc(d.province_nom || d.province)}</dd>${o.showCoop !== false && d.cooperative ? `<dt>Coopérative</dt><dd>${esc(d.cooperative)}</dd>` : ''}<dt>Valide jusqu'au</dt><dd>${fd(d.expire_le)}</dd></dl></div></div>
  <div class="cat ${d.categorie}">${d.categorie}</div>
  <div class="ft"><span>${esc(d.numero)}</span><span>${CATNAME[d.categorie]}</span></div></div>`;
}
export function back(d, o = {}) {
  const acc = o.accent || ACC[d.categorie] || '#007FFF';
  return `<div class="idc back" style="--acc:${acc}"><div class="bg"></div>${mapSvg('watermark', '#007FFF')}
  <div class="hd">${mapSvg('map', '#fff')}<div><b>CARTE D'EXPLOITANT MINIER ARTISANAL</b><small>Vérification : scanner le code QR ou contacter la Division des Mines</small></div>${STAR}</div>
  <div class="bd2"><div><div class="chip"></div><b>Cette carte atteste de l'identité enregistrée.</b> Elle ne vaut ni titre minier, ni autorisation d'exploiter hors zone légale, ni quittance de paiement. Le droit d'exercer, la sécurité du site et l'origine des lots sont vérifiés séparément.<br><br>Perdue ou trouvée : signaler au bureau SAEMAPE le plus proche.<div class="sig">Signature du titulaire</div></div>
  <div class="qr">${qrSvg(payload(d))}</div></div><div class="mrz">${mrz(d)}</div>
  <div class="ft"><span>GABARIT BIOMÉTRIQUE : STOCKÉ ENCHIFFRÉ — NON IMPRIMÉ</span><span>${esc(d.province)}</span></div></div>`;
}
export function printSheet(cards, o = {}) { // aperçu avant impression CR80 recto/verso (aucune fenêtre popup)
  apercu({ titre: 'Impression cartes GesMinArt', orientation: 'portrait', marge: '8mm',
    style: '.sheet{display:grid;grid-template-columns:repeat(2,324px);gap:10px 14px;justify-content:center;padding:6px}.idc{zoom:.757;box-shadow:none;border:1px solid #bbb;break-inside:avoid}h3{font:12px sans-serif;margin:10px 20px}',
    corps: `<h3>Lot d'impression — ${cards.length} carte(s) — recto puis verso (impression recto-verso : retourner la feuille)</h3><div class="sheet">${cards.map(c => front(c, o)).join('')}</div><div style="page-break-before:always"></div><h3>Versos</h3><div class="sheet">${cards.map(c => back(c, o)).join('')}</div>` });
  return true;
}
