// Certificat d'agrément (A4 paysage) : dénomination, catégorie, responsable (nom + photo), dates, statut de validité, QR de vérification.
// Le QR (fourni par l'API) contient le lien de vérification publique et les mentions utiles, signées par le serveur.
import { RDC_VB, RDC_D } from './rdcmap.js';
import { esc, initials } from './ui.js';
import { qrSvg } from './card.js';

const STATUT = { valide: ['VALIDE', '#1a7f45'], expire: ['EXPIRÉ', '#c0152a'], suspendu: ['SUSPENDU', '#c26a00'] };
const fr = d => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');

export const CERT_STYLE = `
.cert{position:relative;width:1060px;height:730px;box-sizing:border-box;padding:26px 40px 20px;font-family:Georgia,'Times New Roman',serif;color:#14233f;background:#fff;overflow:hidden;page-break-inside:avoid}
.cert .bord{position:absolute;inset:6px;border:3px solid #0a2a5e;border-radius:6px}.cert .bord::after{content:"";position:absolute;inset:5px;border:1px solid #007FFF;border-radius:3px}
.cert .tri{position:absolute;left:6px;right:6px;top:6px;height:9px;background:linear-gradient(90deg,#007FFF 0 38%,#F7D618 38% 45%,#CE1126 45% 62%,#F7D618 62% 69%,#007FFF 69%);border-radius:5px 5px 0 0}
.cert .wm{position:absolute;left:50%;top:52%;width:560px;transform:translate(-50%,-50%);opacity:.07}
.cert .stamp{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-18deg);border:8px solid;border-radius:14px;padding:6px 36px;font:900 84px Arial,sans-serif;letter-spacing:6px;opacity:.16}
.cert header{position:relative;display:flex;align-items:center;justify-content:space-between;margin-top:8px}
.cert header .c{text-align:center;flex:1;line-height:1.35}.cert header b{font-size:17px;letter-spacing:1px}.cert header small{font:12px Arial,sans-serif;color:#334}
.cert header .star{font-size:46px;color:#F7D618;text-shadow:0 0 0 #000,0 1px 1px #a58a00;width:80px;text-align:center}
.cert header .no{font:600 12px 'Courier New',monospace;text-align:right;width:210px;color:#0a2a5e}
.cert h1{position:relative;text-align:center;font-size:38px;letter-spacing:5px;margin:10px 0 2px;color:#0a2a5e}
.cert .att{position:relative;text-align:center;font:italic 15px Georgia,serif;margin:0}
.cert .cat{position:relative;text-align:center;margin:8px auto 2px;display:table;padding:3px 24px;border-radius:30px;background:#0a2a5e;color:#fff;font:700 16px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
.cert .nom{position:relative;text-align:center;font:700 34px Georgia,serif;margin:8px 0 14px;line-height:1.15;color:#101c33}
.cert .cols{position:relative;display:flex;gap:28px;align-items:flex-start}
.cert .resp{width:170px;text-align:center}.cert .ph{width:132px;height:166px;margin:0 auto 6px;border:3px solid #0a2a5e;border-radius:6px;overflow:hidden;background:#007FFF;color:#fff;display:grid;place-items:center;font:700 40px Arial;position:relative}
.cert .ph img{width:100%;height:100%;object-fit:cover;display:block}.cert .ph .spec{position:absolute;left:0;right:0;bottom:0;background:rgba(206,17,38,.9);color:#fff;font:700 10px Arial;letter-spacing:2px;padding:2px 0}
.cert .resp .t{font:11px Arial;text-transform:uppercase;letter-spacing:1px;color:#556}.cert .resp .n{font:700 15px Georgia;margin-top:2px}
.cert table{flex:1;border-collapse:collapse;font:14px Arial,sans-serif}.cert td{padding:7px 10px;border-bottom:1px solid #d5ddec}.cert td:first-child{width:200px;color:#556;font-size:12px;text-transform:uppercase;letter-spacing:.8px}.cert td b{font-size:15px}
.cert .badge{display:inline-block;padding:3px 16px;border-radius:5px;color:#fff;font:800 15px Arial;letter-spacing:2px}
.cert .qr{width:178px;text-align:center}.cert .qr svg{width:166px;height:166px;display:block;margin:0 auto;border:1px solid #cfd8ea;padding:4px;background:#fff}.cert .qr small{font:10px Arial;color:#445;display:block;margin-top:4px;line-height:1.3}
.cert footer{position:absolute;left:40px;right:40px;bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;font:11px Arial,sans-serif;color:#334}
.cert footer .legal{max-width:560px;line-height:1.4}.cert footer .sig{text-align:center;width:300px}.cert footer .sig .line{border-top:1px solid #14233f;margin-top:34px;padding-top:3px;font-size:11px}
`;

/** @param d réponse de /api/agrements/:id/certificat ; @param o {provinceNom} */
export function certificatCorps(d, o = {}) {
  const [stLib, stCol] = STATUT[d.statut] || [String(d.statut).toUpperCase(), '#555'];
  const r = d.responsable || {}, photo = r.photo;
  const imgPhoto = photo ? `<img src="${esc(photo)}" alt="">${String(photo).startsWith('data:image/jpeg') ? '<span class="spec">SPÉCIMEN</span>' : ''}` : esc(initials((r.nom || '?').split(' ')[0], (r.nom || '').split(' ')[1] || ''));
  const prov = o.provinceNom || d.province_nom || d.province;
  const ligne = (l, v) => `<tr><td>${l}</td><td>${v}</td></tr>`;
  const extra = d.sites != null ? ligne('Membres / sites', `${d.membres ?? 0} membre(s) · ${d.sites} site(s) rattaché(s)`) : '';
  return `<div class="cert"><div class="tri"></div><div class="bord"></div>
    <svg class="wm" viewBox="${RDC_VB}" aria-hidden="true"><path d="${RDC_D}" fill="#0a2a5e"/></svg>
    ${d.statut !== 'valide' ? `<div class="stamp" style="color:${stCol};border-color:${stCol}">${stLib}</div>` : ''}
    <header><div class="star">★</div><div class="c"><b>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</b><br><small>Ministère des Mines</small><br><small>${esc(d.autorite)}</small></div><div class="no">N° ${esc(d.numero)}<br>Réf. agrément : ${esc(d.reference || '—')}</div></header>
    <h1>CERTIFICAT D'AGRÉMENT</h1>
    <p class="att">Il est certifié que l'entité désignée ci-dessous est agréée en qualité de</p>
    <div class="cat">${esc(d.categorie_libelle)}</div>
    <div class="nom">${esc(d.nom)}</div>
    <div class="cols">
      <div class="resp"><div class="ph">${imgPhoto}</div><div class="t">Responsable</div><div class="n">${esc(r.nom || d.responsable_nom || '—')}</div></div>
      <table>${ligne('N° du certificat', `<b>${esc(d.numero)}</b>`)}${ligne('Catégorie', esc(d.categorie_libelle))}${ligne('Province', esc(prov))}${ligne('Date de délivrance', fr(d.date_delivrance))}${ligne('Valable jusqu\'au', fr(d.date_expiration))}${ligne('Statut de validité', `<span class="badge" style="background:${stCol}">${stLib}</span>${d.motif ? ` <small>— ${esc(d.motif)}</small>` : ''}`)}${extra}</table>
      <div class="qr">${qrSvg(d.qr)}<small>Scannez pour vérifier l'authenticité et le statut en vigueur de ce certificat.</small></div>
    </div>
    <footer><div class="legal"><b>Base réglementaire :</b> ${esc(d.base_legale)}<br>Validité : ${d.validite_mois} mois à compter de la délivrance. Ce certificat n'a de valeur que s'il est vérifié par son QR code ; un certificat expiré ou suspendu n'autorise aucune activité réglementée.</div>
      <div class="sig">Fait à ${esc(prov)}, le ${fr(d.date_delivrance)}<div class="line">${esc(d.autorite)}</div></div></footer></div>`;
}
