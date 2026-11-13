// Aperçu avant impression intégré à l'application.
//  * Le document est autonome (feuille de style embarquée) et affiché dans un cadre isolé : plus de fenêtre popup (souvent bloquée),
//    plus d'impression lancée avant le chargement des styles.
//  * Boutons : Imprimer (après chargement complet), Ouvrir dans un onglet (repli si l'impression du cadre est refusée), Fermer.
//  * Le cadre n'exécute aucun script (sandbox sans allow-scripts) : seul le contenu fourni est rendu.
import { modal, toast, esc } from './ui.js';

let cssCache = null;
const feuille = async () => cssCache ??= await (async () => { const l = document.querySelector('link[href*="app.css"]'); return l ? (await fetch(l.href)).text().catch(() => '') : ''; })();

/** Construit le document HTML complet (utilisé aussi par les tests et l'ouverture en onglet). */
export function documentImpression({ titre, corps, style = '', format = 'A4', orientation = 'portrait', marge = '10mm', css = '', taille = '' }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(titre)}</title><style>${css}</style>`
    + `<style>@page{size:${taille || format + ' ' + orientation};margin:${marge}}html,body{background:#fff!important;color:#111!important;margin:0}body{padding:0}`
    + `*{-webkit-print-color-adjust:exact;print-color-adjust:exact}${style}</style></head><body>${corps}</body></html>`;
}

const PX = { portrait: [794, 1123], landscape: [1123, 794] };   // A4 à 96 dpi

/**
 * @param {{titre:string, corps:string, style?:string, format?:string, orientation?:'portrait'|'landscape', marge?:string, taille?:string, largeur?:number}} o
 * @returns {Promise<{close:Function}>}
 */
export async function apercu(o) {
  const orientation = o.orientation === 'landscape' ? 'landscape' : 'portrait';
  const doc = documentImpression({ ...o, orientation, css: await feuille() });
  const m = modal(esc(o.titre), `<div class="aperc-bar"><button class="btn pri" id="apPrint" disabled>Imprimer</button><button class="btn" id="apTab">Ouvrir dans un onglet</button><span class="muted small" id="apInfo">Aperçu — ${orientation === 'landscape' ? 'A4 paysage' : 'A4 portrait'}</span></div><div class="aperc-wrap" id="apWrap"><div id="apIn"><iframe class="aperc" id="apFrame" title="Aperçu avant impression" sandbox="allow-modals allow-same-origin"></iframe></div></div>`, { width: 'min(1180px, 96vw)' });
  const bar = m.el, fr = bar.querySelector('#apFrame'), wrap = bar.querySelector('#apWrap'), inner = bar.querySelector('#apIn');
  const pw = o.largeur || PX[orientation][0];
  const ajuste = () => { const k = Math.min(1, (wrap.clientWidth || pw) / pw) || 1, h = Math.round(innerHeight * 0.68); fr.style.cssText = `width:${pw}px;height:${Math.round(h / k)}px;transform:scale(${k});transform-origin:0 0`; inner.style.cssText = `width:${Math.round(pw * k)}px;height:${h}px;overflow:hidden;margin:0 auto`; wrap.style.height = h + 'px'; };
  // La largeur du conteneur n'est connue qu'après la mise en page : on ajuste à chaque changement de taille (ResizeObserver).
  const obs = new ResizeObserver(() => ajuste()); obs.observe(wrap); requestAnimationFrame(ajuste);
  const fermer = m.close; m.close = () => { obs.disconnect(); fermer(); };
  bar.closest('.modal-bg')?.querySelector('.x')?.addEventListener('click', () => obs.disconnect());
  const bouton = bar.querySelector('#apPrint');
  fr.addEventListener('load', () => { bouton.disabled = false; }, { once: true });
  fr.srcdoc = doc;
  const onglet = () => { const u = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' })); const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  bouton.onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { toast('Impression directe indisponible : ouverture dans un onglet.', 'bad'); onglet(); } };
  bar.querySelector('#apTab').onclick = onglet;
  return m;
}
