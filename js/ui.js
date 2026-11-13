// Utilitaires d'interface : échappement, formats, pastilles, modales, graphiques SVG sans dépendance.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, r = document) => r.querySelector(s); export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const fmt = (n, d = 0) => (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const usd = n => '$' + fmt(n, 0); export const usd2 = n => fmt(n, 2) + ' $';
export const dt = s => s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const dtt = s => s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export const initials = (n, p) => ((n || '?')[0] + ((p || '')[0] || '')).toUpperCase();
const PILL = {
  verifie: ['ok', 'Vérifiée'], en_attente: ['warn', 'En attente'], doublon_suspect: ['bad', 'Doublon suspect'], rejete: ['mute', 'Rejetée'],
  valide: ['ok', 'Valide'], non_valide: ['mute', 'Non validé'], expire: ['bad', 'Expiré'], suspendu: ['warn', 'Suspendu'],
  legal: ['ok', 'Légal'], a_verifier: ['warn', 'À vérifier'], irregulier: ['bad', 'Irrégulier'],
  conforme: ['ok', 'Conforme'], vigilance: ['warn', 'Vigilance'], danger: ['bad', 'Danger'],
  actif: ['ok', 'Actif'], inactif: ['mute', 'Inactif'], ferme: ['mute', 'Fermé'],
  a_imprimer: ['warn', 'À imprimer'], imprimee: ['info', 'Imprimée'], livree: ['ok', 'Livrée'], perdue: ['bad', 'Perdue'], suspendue: ['warn', 'Suspendue'], expiree: ['bad', 'Expirée'],
  emise: ['info', 'Émise'], paiement_en_attente: ['warn', 'Paiement en attente'], regle: ['ok', 'Réglée'], contestee: ['bad', 'Contestée'], annulee: ['mute', 'Annulée'],
  en_attente_confirmation: ['warn', 'En attente banque'], confirme: ['info', 'Confirmé'], rapproche: ['ok', 'Rapproché'], ecart: ['bad', 'Écart'],
  bloque: ['warn', 'Bloquée'], exclu: ['mute', 'Exclue'],
  non_conformite_mineure: ['warn', 'Non-conf. mineure'], non_conformite_majeure: ['bad', 'Non-conf. majeure'], danger_immediat: ['bad', 'Danger immédiat'],
  soumis: ['info', 'Soumis'], cloture: ['mute', 'Clôturé'], brouillon: ['mute', 'Brouillon'],
  non_verifiee: ['warn', 'Non vérifiée'], en_controle: ['info', 'En contrôle'], certifiee: ['ok', 'Certifiée'], rejetee: ['bad', 'Rejetée'],
  haute: ['bad', 'Haute'], moyenne: ['warn', 'Moyenne'], basse: ['mute', 'Basse'],
  detection: ['info', 'Détection'], controle_preuves: ['info', 'Contrôle preuves'], qualification: ['warn', 'Qualification'], decision: ['warn', 'Décision'], recours: ['info', 'Recours'], clos: ['mute', 'Clos'],
  en_instruction: ['warn', 'En instruction'], planifiee: ['info', 'Planifiée'], en_cours: ['warn', 'En cours'], terminee: ['ok', 'Terminée'],
  recue: ['warn', 'Reçue'], accusee: ['info', 'Accusée'], resolue: ['ok', 'Résolue'], imprime: ['info', 'Imprimé'], expedie: ['info', 'Expédié'], livre: ['ok', 'Livré'], en_preparation: ['warn', 'En préparation'],
  accepte: ['ok', 'Accepté'], doublon_ignore: ['mute', 'Doublon ignoré'],
};
export const pill = v => { const p = PILL[v]; return p ? `<span class="pill ${p[0]}">${p[1]}</span>` : `<span class="pill">${esc(v ?? '—')}</span>`; };
export const CAT = { A: 'Catégorie A — Exportateur / Comptoir', B: 'Catégorie B — Négociant', C: 'Catégorie C — Exploitant artisanal' };
export const SUBS = ['Or', 'Diamant', 'Cuivre', 'Cobalt', 'Cassitérite', 'Coltan', 'Wolframite', 'Autre'];
export function toast(msg, kind = '') { const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toast').append(t); setTimeout(() => t.remove(), 4800); }
export function modal(title, body, opts = {}) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" style="${opts.width ? 'max-width:' + opts.width : ''}"><div class="mh"><h2>${title}</h2><button class="x" aria-label="Fermer">×</button></div><div class="mb"></div></div>`;
  const mb = $('.mb', bg); typeof body === 'string' ? mb.innerHTML = body : mb.append(body);
  const close = () => bg.remove(); $('.x', bg).onclick = close; bg.addEventListener('mousedown', e => { if (e.target === bg) close(); }); document.body.append(bg); return { el: mb, close };
}

// ---- Graphiques SVG ----
const PAL = ['#007FFF', '#F7D618', '#CE1021', '#1a9b5b', '#e8890c', '#7a4fd6', '#16a3b8', '#8a97b0'];
export function bars(data, { w = 560, h = 220, fmtv = fmt, color = '#007FFF', horizontal = false } = {}) {
  if (!data.length) return '<p class="muted">Aucune donnée.</p>'; const max = Math.max(...data.map(d => d.v), 1);
  if (horizontal) { const rh = 24, H = data.length * rh + 6; return `<svg viewBox="0 0 ${w} ${H}" width="100%">${data.map((d, i) => `<text x="0" y="${i * rh + 16}" font-size="12" fill="currentColor">${esc(d.k)}</text><rect x="150" y="${i * rh + 5}" rx="4" width="${Math.max(2, (w - 220) * d.v / max)}" height="14" fill="${d.c || color}"/><text x="${156 + (w - 220) * d.v / max}" y="${i * rh + 16}" font-size="11.5" fill="currentColor">${fmtv(d.v)}</text>`).join('')}</svg>`; }
  const bw = (w - 30) / data.length; return `<svg viewBox="0 0 ${w} ${h}" width="100%"><line x1="24" y1="${h - 26}" x2="${w}" y2="${h - 26}" stroke="#8a97b0" stroke-opacity=".4"/>${data.map((d, i) => { const bh = (h - 56) * d.v / max; return `<rect x="${28 + i * bw}" y="${h - 26 - bh}" width="${bw - 6}" height="${bh}" rx="4" fill="${d.c || color}"><title>${esc(d.k)} : ${fmtv(d.v)}</title></rect><text x="${28 + i * bw + (bw - 6) / 2}" y="${h - 10}" text-anchor="middle" font-size="11" fill="currentColor">${esc(d.k)}</text><text x="${28 + i * bw + (bw - 6) / 2}" y="${h - 30 - bh}" text-anchor="middle" font-size="10.5" fill="currentColor">${fmtv(d.v)}</text>`; }).join('')}</svg>`;
}
export function stacked(data, { w = 560, h = 220 } = {}) {
  if (!data.length) return '<p class="muted">Aucune donnée.</p>'; const max = Math.max(...data.map(d => d.a), 1), bw = (w - 30) / data.length;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%"><line x1="24" y1="${h - 26}" x2="${w}" y2="${h - 26}" stroke="#8a97b0" stroke-opacity=".4"/>${data.map((d, i) => { const ha = (h - 56) * d.a / max, hb = (h - 56) * d.b / max, x = 28 + i * bw; return `<rect x="${x}" y="${h - 26 - ha}" width="${bw - 6}" height="${ha}" rx="4" fill="#cfe2ff"><title>Attendu ${usd(d.a)}</title></rect><rect x="${x}" y="${h - 26 - hb}" width="${bw - 6}" height="${hb}" rx="4" fill="#007FFF"><title>Réglé ${usd(d.b)}</title></rect><text x="${x + (bw - 6) / 2}" y="${h - 10}" text-anchor="middle" font-size="11" fill="currentColor">${esc(d.k)}</text>`; }).join('')}</svg><div class="small muted"><span style="color:#007FFF">■</span> Réglé &nbsp; <span style="color:#9bbcf0">■</span> Attendu</div>`;
}
export function donut(data, { size = 150 } = {}) {
  const t = data.reduce((s, d) => s + d.v, 0) || 1; let a = -Math.PI / 2; const R = 60, r = 38, c = size / 2;
  const arcs = data.map((d, i) => { const a2 = a + 2 * Math.PI * d.v / t; const p = (ang, rad) => `${c + rad * Math.cos(ang)},${c + rad * Math.sin(ang)}`; const large = a2 - a > Math.PI ? 1 : 0; const path = d.v ? `<path d="M${p(a, R)} A${R},${R} 0 ${large} 1 ${p(a2 - .001, R)} L${p(a2 - .001, r)} A${r},${r} 0 ${large} 0 ${p(a, r)} Z" fill="${d.c || PAL[i % PAL.length]}"><title>${esc(d.k)} : ${fmt(d.v)}</title></path>` : ''; a = a2; return path; }).join('');
  return `<div class="flex wrap"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${arcs}<text x="${c}" y="${c + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="currentColor">${fmt(t)}</text></svg><div class="small">${data.map((d, i) => `<div><span style="color:${d.c || PAL[i % PAL.length]}">●</span> ${esc(d.k)} — <b>${fmt(d.v)}</b></div>`).join('')}</div></div>`;
}
export function line(data, { w = 560, h = 180, color = '#007FFF' } = {}) {
  if (data.length < 2) return '<p class="muted">Données insuffisantes.</p>'; const max = Math.max(...data.map(d => d.v), 1), st = (w - 40) / (data.length - 1);
  const pts = data.map((d, i) => [24 + i * st, h - 28 - (h - 50) * d.v / max]); return `<svg viewBox="0 0 ${w} ${h}" width="100%"><polyline fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" points="${pts.map(p => p.join(',')).join(' ')}"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}"><title>${esc(data[i].k)} : ${fmt(data[i].v)}</title></circle><text x="${p[0]}" y="${h - 10}" text-anchor="middle" font-size="11" fill="currentColor">${esc(data[i].k)}</text>`).join('')}</svg>`;
}
export const monthLabel = m => { const [y, mo] = m.split('-'); return ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'][+mo - 1] + ' ' + y.slice(2); };

// Icônes monochromes (SVG, sans émojis)
export const ICONS = {"cami":"M12 3l8 4v5c0 5-3.500 8-8 9-4.500-1-8-4-8-9V7zM9 12l2 2 4-4","agrements":"M6 3h12v14l-6 4-6-4zM9 9l2 2 4-4","dashboard":"M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z","carte":"M9 3 3 5v16l6-2 6 2 6-2V3l-6 2zM9 3v16M15 5v16","registre":"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6","enrolement":"M12 4v16M4 12h16","identite":"M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5","cartes":"M3 6h18v12H3zM7 11h4M7 14h7M16 10h2","sites":"M4 20 10 8l4 6 2-3 4 9zM8 8l2-4","controle":"M5 12l5 5L20 7","collecte":"M12 4v3M5 9h14M7 9l-3 7h6zM17 9l-3 7h6zM12 7v13M8 20h8","taxes":"M12 3v18M16 7c-1-1.5-8-2-8 1.5S16 12 16 15.500 9 19 8 16.500","repartition":"M4 8h14l-3-3M20 16H6l3 3","modele":"M3 20h18M5 16l4-5 4 3 6-8","alertes":"M6 21V4M6 5h12l-3 4 3 4H6","plaintes":"M3 6h18v12H3zM3 7l9 7 9-7","rapports":"M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7","admin":"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100","pos":"M7 3h10v18H7zM10 6h4M10 17h4"};
export const ico = n => '<svg class="ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (ICONS[n] || ICONS.dashboard) + '"/></svg>';
