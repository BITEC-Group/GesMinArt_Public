// Coque de l'application web : connexion, navigation selon le PROFIL (accès gradués), routeur par hash, contexte partagé.
import { api, setToken, hasToken, getToken } from './api.js';
import { $, $$, esc, toast, modal, ico } from './ui.js';
import { RDC_VB, RDC_D } from './rdcmap.js';
import { hw } from './hw.js';

export const ctx = { user: null, meta: null };
// Niveau de permission du profil connecté : 0 aucun · 1 lecture · 2 écriture · 3 validation · 4 administration.
export const lvl = r => ctx.user?.perms?.[r] ?? 0;
export const can = (r, l = 1) => lvl(r) >= l;
const logo = (w = 78) => `<svg class="logo" style="width:${w}px;height:auto" viewBox="${RDC_VB}"><path d="${RDC_D}" fill="#007FFF" stroke="#F7D618" stroke-width="3" stroke-linejoin="round"/><polygon transform="translate(30,40) scale(1.1)" fill="#F7D618" stroke="#CE1021" stroke-width="2" points="50,6 61.8,37.6 95.5,38.8 69,59.6 78.2,92 50,73.5 21.8,92 31,59.6 4.5,38.8 38.2,37.6"/></svg>`;
$('#loginLogo').innerHTML = logo(78);

// Chaque page n'apparaît que si le profil possède au moins un des accès listés (res = [ressource, niveau minimal]).
const PAGES = [
  { id: 'dashboard', ic: 'dashboard', t: 'Tableau de bord', g: 'Pilotage', acc: [['agregats', 1]], live: ['personnes','cartes','taxes','paiements','alertes','sites','controle','plaintes','verification'], m: () => import('./pages/dashboard.js') },
  { id: 'carte', ic: 'carte', t: 'Carte SIG', g: 'Pilotage', acc: [['carte', 1]], live: ['sites','titres'], m: () => import('./pages/carte.js') },
  { id: 'registre', ic: 'registre', t: 'Registre des acteurs', g: 'Identification', acc: [['personnes', 1]], live: ['personnes'], m: () => import('./pages/registre.js') },
  { id: 'enrolement', ic: 'enrolement', t: 'Enrôlement biométrique', g: 'Identification', acc: [['personnes', 2]], m: () => import('./pages/enrolement.js') },
  { id: 'identite', ic: 'identite', t: 'Vérifier une identité', g: 'Identification', acc: [['identite', 1]], m: () => import('./pages/identite.js') },
  { id: 'cartes', ic: 'cartes', t: 'Cartes & production', g: 'Identification', acc: [['cartes', 1]], live: ['cartes'], m: () => import('./pages/cartes.js') },
  { id: 'agrements', ic: 'agrements', t: 'Certificats d\'agrément', g: 'Identification', acc: [['agrements', 1]], m: () => import('./pages/agrements.js') },
  { id: 'cami', ic: 'cami', t: 'Vérification CAMI', g: 'Terrain', acc: [['cami', 1]], m: () => import('./pages/cami.js') },
  { id: 'conformite', ic: 'agrements', t: 'Conformité & traçabilité', g: 'Terrain', acc: [['conformite', 1], ['sanctions', 1], ['tracabilite', 1]], m: () => import('./pages/conformite.js') },
  { id: 'sites', ic: 'sites', t: 'Titres & sites — vérification', g: 'Terrain', acc: [['sites', 1], ['titres', 1], ['verification', 1]], m: () => import('./pages/sites.js'), badgeKey: 'a_valider' },
  { id: 'controle', ic: 'controle', t: 'Contrôle & inspection', g: 'Terrain', acc: [['controle', 1]], live: ['controle'], m: () => import('./pages/controle.js') },
  { id: 'collecte', ic: 'collecte', t: 'Collecte & production', g: 'Terrain', acc: [['collecte', 1]], live: ['collecte'], m: () => import('./pages/collecte.js') },
  { id: 'taxes', ic: 'taxes', t: 'Taxes & recettes', g: 'Recettes', acc: [['taxes', 1]], live: ['taxes','paiements'], m: () => import('./pages/taxes.js') },
  { id: 'repartition', ic: 'repartition', t: 'Coûts & partage des recettes', g: 'Recettes', acc: [['repartition', 1], ['couts', 1]], m: () => import('./pages/repartition.js') },
  { id: 'modele', ic: 'modele', t: 'Modèle économique', g: 'Recettes', acc: [['modele', 1]], m: () => import('./pages/modele.js') },
  { id: 'alertes', ic: 'alertes', t: 'Alertes & anomalies', g: 'Contrôle', acc: [['alertes', 1]], live: ['alertes'], m: () => import('./pages/alertes.js'), badgeKey: 'alertes_ouvertes' },
  { id: 'plaintes', ic: 'plaintes', t: 'Plaintes & recours', g: 'Contrôle', acc: [['plaintes', 1]], live: ['plaintes'], m: () => import('./pages/plaintes.js') },
  { id: 'rapports', ic: 'rapports', t: 'Rapports', g: 'Contrôle', acc: [['rapports', 1]], m: () => import('./pages/rapports.js') },
  { id: 'admin', ic: 'admin', t: 'Utilisateurs, profils & intégrations', g: 'Système', acc: [['admin', 1], ['audit', 1], ['utilisateurs', 1], ['integration', 3]], m: () => import('./pages/admin.js') },
  { id: 'pos', ic: 'pos', t: 'POS PayRus', g: 'Système', acc: [['personnes', 2], ['taxes', 2], ['collecte', 2], ['controle', 2], ['verification', 2]], m: () => import('./pages/pos.js') },
];
const allowed = p => p.acc.some(([r, l]) => can(r, l));

function buildNav(badges) {
  let g = '', out = `<div class="head">${logo(44)}<div><b>GesMinArt</b><small>RDC · Mines artisanales</small></div></div><div class="ruban"></div>`;
  for (const p of PAGES) { if (!allowed(p)) continue; if (p.g !== g) { g = p.g; out += `<div class="grp">${g}</div>`; } const b = p.badgeKey && badges[p.badgeKey]; out += `<a class="item" data-p="${p.id}" href="#/${p.id}"><span class="ic">${ico(p.ic)}</span>${p.t}${b ? `<span class="badge">${b}</span>` : ''}</a>`; }
  out += `<div class="foot"><b>${esc(ctx.user.nom)}</b>${esc(ctx.user.profil || ctx.user.role)}${ctx.user.province ? ' · ' + esc(ctx.meta.provinces.find(p => p.code === ctx.user.province)?.nom || '') : ' · National'}<div style="margin-top:8px"><span class="lnk" id="chpin">Mon PIN</span><span class="lnk" id="logout">Déconnexion</span></div></div>`;
  $('#nav').innerHTML = out; $('#logout').onclick = () => { setToken(null); location.hash = ''; location.reload(); };
  $('#chpin').onclick = () => { const m = modal('Changer mon PIN', '<div class="f"><label>PIN actuel</label><input id="p0" type="password" inputmode="numeric"></div><div class="f"><label>Nouveau PIN (4 à 8 chiffres)</label><input id="p1" type="password" inputmode="numeric"></div><div class="f"><label>Confirmer</label><input id="p2" type="password" inputmode="numeric"></div><button class="btn pri" id="ok">Enregistrer</button>'); $('#ok', m.el).onclick = async () => { if ($('#p1', m.el).value !== $('#p2', m.el).value) return toast('Les deux PIN ne correspondent pas', 'bad'); try { await api('/moi/pin', { ancien: $('#p0', m.el).value, nouveau: $('#p1', m.el).value }); m.close(); toast('PIN modifié', 'ok'); } catch (e) { toast(e.message, 'bad'); } }; };
}
let current = null;
async function route() {
  if (!ctx.user) return; const id = (location.hash.replace(/^#\/?/, '').split('/')[0].split('?')[0]) || 'dashboard';
  const p = PAGES.find(x => x.id === id && allowed(x)) || PAGES.find(allowed); if (!p) return $('#view').innerHTML = '<div class="alert warn">Aucun module n\'est activé pour ce profil.</div>';
  $$('#nav a.item').forEach(a => a.classList.toggle('on', a.dataset.p === p.id)); $('#crumb').textContent = 'GesMinArt › ' + p.t;
  const view = $('#view'); view.innerHTML = '<p class="muted">Chargement…</p>'; const token = current = {};
  try { const mod = await p.m(); if (current !== token) return; view.innerHTML = ''; await mod.render(view, location.hash.split('/').slice(2).join('/')); } catch (e) { console.error(e); view.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
}
export const go = h => { location.hash = '#/' + h; };
// ---- Temps réel (SSE) : les autorités voient les mises à jour sans recharger ----
let es = null, nbLive = 0, tRefresh = null;
export const evenements = [];
function pageCourante() { const id = (location.hash.replace(/^#\/?/, '').split('/')[0].split('?')[0]) || 'dashboard'; return PAGES.find(p => p.id === id); }
function rafraichir(evt) {
  const p = pageCourante(); if (!p || !p.live || !p.live.includes(evt.resource)) return;
  clearTimeout(tRefresh); tRefresh = setTimeout(() => {
    const occupe = document.querySelector('.modal-bg') || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '') && $('#view').contains(document.activeElement);
    if (occupe) { if (!$('#maj-banner')) $('#view').insertAdjacentHTML('afterbegin', '<div id="maj-banner" class="alert" style="cursor:pointer">Nouvelles données reçues en temps réel — cliquez pour actualiser cette page.</div>'); $('#maj-banner').onclick = () => route(); }
    else route();
  }, 1200);
}
function ouvrirFlux() {
  if (es) es.close(); const st = $('#livestatus');
  es = new EventSource('/api/temps-reel?token=' + encodeURIComponent(getToken()));
  es.addEventListener('pret', () => { st.innerHTML = '<i class="dot"></i> Temps réel'; });
  es.addEventListener('maj', e => { const evt = JSON.parse(e.data); evenements.unshift(evt); if (evenements.length > 30) evenements.pop(); nbLive++; st.innerHTML = '<i class="dot"></i> Temps réel · ' + nbLive; st.title = evt.libelle + ' — ' + evt.par; rafraichir(evt); window.dispatchEvent(new CustomEvent('idm-live', { detail: evt })); });
  es.onerror = () => { st.innerHTML = '<i class="dot off"></i> Reconnexion…'; };
}
window.addEventListener('hashchange', route);

async function start() {
  const [me, meta] = await Promise.all([api('/me'), api('/meta')]); ctx.user = me; ctx.meta = meta;
  const st = await api('/stats').catch(() => ({ kpi: {} })); buildNav(st.kpi);
  document.body.classList.add('auth'); route(); ouvrirFlux();
}
const net = () => { $('#netstatus').innerHTML = navigator.onLine ? '<i class="dot"></i> En ligne' : '<i class="dot off"></i> Hors ligne'; };
window.addEventListener('online', net); window.addEventListener('offline', net); net();
hw.info().then(i => { if (i.pos) $('#netstatus').insertAdjacentHTML('afterbegin', `<span class="pill info">POS PayRus · ${esc(i.modele)}</span> `); });
$('#themeBtn').onclick = () => { const d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = d; try { localStorage.setItem('idm_theme', d); } catch {} };
try { const t = localStorage.getItem('idm_theme'); if (t) document.documentElement.dataset.theme = t; } catch {}

const DEMO = [['admin', 'Admin', 'Tout'], ['province', 'Division des Mines', 'Lualaba', 'prov.lualaba'], ['agent1', 'Agent de terrain', 'Kolwezi'], ['perc1', 'Percepteur', 'Régie Kolwezi'], ['cami1', 'CAMI', 'Titres & vérification'], ['fin1', 'Finances', 'Clés de partage'], ['bitec1', 'BITEC technique', 'Sans données perso.'], ['itie1', 'Observateur ITIE', 'Agrégats'], ['igm', 'IGM', 'Contrôle'], ['insp1', 'Inspecteur', 'Haut-Katanga']];
$('#demoUsers').innerHTML = DEMO.map(d => `<button type="button" data-l="${d[3] || d[0]}"><b>${d[1]}</b>${d[2]}</button>`).join('');
$('#demoUsers').onclick = e => { const b = e.target.closest('button'); if (b) { $('#lg').value = b.dataset.l; $('#pn').value = '1234'; $('#loginForm').requestSubmit(); } };
$('#loginForm').onsubmit = async e => { e.preventDefault(); try { const r = await api('/login', { login: $('#lg').value, pin: $('#pn').value }); setToken(r.token); location.hash = '#/dashboard'; await start(); } catch (x) { const el = $('#lerr'); el.style.display = 'block'; el.textContent = x.message; } };
if (hasToken()) start().catch(() => { setToken(null); });
export { toast };
