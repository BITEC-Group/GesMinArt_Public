// Certificat de conformité cadastrale (vert) ou constat de non-conformité (rouge) — A4 portrait, QR signé de vérification publique.
// Données : réponse de /api/cami/verifications/:id/document. Le QR renvoie vers /verifier.html?cc=…&s=… (statut relu sur le serveur).
import { esc } from './ui.js';
import { qrSvg } from './card.js';

const fr = s => (s ? new Date(s).toLocaleString('fr-FR') : '—');
const frd = d => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
const dist = m => (m == null ? '' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2).replace('.', ',')} km`);

export const CONSTAT_STYLE = `
.cst{position:relative;width:760px;min-height:1040px;box-sizing:border-box;padding:34px 46px 28px;font-family:Arial,sans-serif;color:#14233f;background:#fff;page-break-inside:avoid}
.cst .tri{height:8px;border-radius:4px;background:linear-gradient(90deg,#007FFF 0 38%,#F7D618 38% 45%,#CE1126 45% 62%,#F7D618 62% 69%,#007FFF 69%)}
.cst .ent{text-align:center;margin:12px 0 4px;line-height:1.4;font-size:13px}.cst .ent b{font-size:16px;letter-spacing:1px}
.cst .ban{margin:16px 0;padding:16px;border-radius:12px;color:#fff;text-align:center;font-weight:800;font-size:25px;letter-spacing:1px}
.cst .ban small{display:block;font-weight:500;font-size:13px;margin-top:4px}
.cst table{width:100%;border-collapse:collapse;font-size:14px}.cst td{padding:8px 10px;border-bottom:1px solid #d5ddec}.cst td:first-child{width:210px;color:#556;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.cst .mot{margin:14px 0;padding:10px 14px;border-left:5px solid;border-radius:4px;background:#f6f8fc;font-size:13px}
.cst .bas{display:flex;gap:24px;align-items:center;margin-top:20px}.cst .bas svg{width:170px;height:170px;border:1px solid #cfd8ea;padding:4px;background:#fff;flex:none}
.cst .bas p{font-size:11px;line-height:1.5;color:#445;margin:0}
.cst footer{margin-top:24px;font-size:11px;color:#445;line-height:1.5}
`;

/** @param d réponse du document ; @param o {provinceNom} */
export function constatCorps(d, o = {}) {
  const ok = d.type_document === 'certificat_conformite', col = ok ? '#1a7f45' : '#c0152a';
  const titre = ok ? 'CERTIFICAT DE CONFORMITÉ CADASTRALE' : 'CONSTAT DE NON-CONFORMITÉ';
  const l = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  const pos = d.dans_perimetre == null ? 'Position non contrôlée' : d.dans_perimetre ? 'Position à l\'intérieur du périmètre du titre' : `Position HORS périmètre : à ${dist(d.distance_m)} de la bordure la plus proche`;
  return `<div class="cst"><div class="tri"></div>
    <div class="ent"><b>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</b><br>Ministère des Mines — Cadastre minier (CAMI)<br>Contrôle de conformité cadastrale · GesMinArt</div>
    <div class="ban" style="background:${col}">${titre}<small>N° de contrôle ${esc(String(d.id).padStart(6, '0'))} · ${esc(fr(d.cree_le))}</small></div>
    <table>${l('Titre minier', `<b>${esc(d.numero)}</b> (${esc(d.type_permis || '—')})`)}${l('Titulaire', esc(d.titulaire || '—'))}${l('Province', esc(o.provinceNom || d.province || '—'))}${l('Statut au cadastre', esc(d.statut_cami || '—'))}${l('Date d\'expiration du titre', frd(d.date_expiration))}${l('Position GPS', d.lat != null ? `${esc(d.lat)} ; ${esc(d.lon)}` : '—')}${l('Contrôle de position', `<b style="color:${d.dans_perimetre === false ? '#c0152a' : '#1a7f45'}">${esc(pos)}</b>`)}${l('Source', esc(d.source || '—'))}</table>
    ${d.motifs?.length ? `<div class="mot" style="border-color:${col}"><b>${ok ? 'Observations' : 'Motifs de non-conformité'}</b><ul style="margin:6px 0 0 18px;padding:0">${d.motifs.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
    <div class="bas">${qrSvg(d.qr)}<p><b>Vérification publique.</b> Scannez le QR code : le serveur confirme l'authenticité du document (signature) et affiche le résultat du contrôle. Toute modification du document est détectée.<br><br>Ce document atteste d'un contrôle à la date indiquée ; il ne vaut pas titre minier et ne préjuge pas des suites administratives ou judiciaires.</p></div>
    <footer>Document généré par GesMinArt à partir des informations du Cadastre minier. Les références réglementaires et les suites à donner relèvent des autorités compétentes.</footer></div>`;
}
