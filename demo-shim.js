// « Faux serveur » de la réplique statique : intercepte les appels /api et répond depuis l'instantané demo-data.json (données fictives).
// Lecture seule : les écritures sont refusées avec un message clair. Aucune donnée n'est envoyée nulle part.
(() => {
  const BASE = window.DEMO_BASE || '';
  let data = null;
  // Écritures SIMULÉES : enregistrées uniquement dans le navigateur du visiteur (localStorage), rejouées sur l'instantané à chaque chargement.
  const CLE = 'gesminart_demo_ops'; let ops = [], ecriture = true;
  try { ops = JSON.parse(localStorage.getItem(CLE) || '[]'); } catch {}
  const lignes = d => Array.isArray(d) ? d : (d && Array.isArray(d.rows) ? d.rows : null);
  const cles = base => Object.keys(data.snap).filter(k => k.split('?')[0] === base);
  const applique = op => {
    const s = data.snap, m = /^(.*?)(?:\/([^/]+))?$/.exec(op.p), segs = op.p.split('/').filter(Boolean);
    const dernierId = segs.length > 1 && /^\d+$|^[0-9a-f-]{8,}$/i.test(segs[segs.length - 1]);
    const actionSurId = segs.length > 2 && /^\d+$|^[0-9a-f-]{8,}$/i.test(segs[segs.length - 2]); // ex. /infractions/12/notifier
    if (op.m === 'POST' && !actionSurId) {
      const row = { id: 'demo-' + op.t, ...op.b, cree_le: new Date(op.t).toISOString(), simule: true };
      for (const k of cles(op.p)) { const l = lignes(s[k]); if (l) { l.unshift(row); if (!Array.isArray(s[k]) && typeof s[k].total === 'number') s[k].total++; } }
      return row;
    }
    const baseP = '/' + segs.slice(0, actionSurId ? -2 : -1).join('/'), id = actionSurId ? segs[segs.length - 2] : segs[segs.length - 1];
    const cibleId = actionSurId || dernierId;
    if (!cibleId) return { ...op.b };
    if (op.m === 'DELETE') { for (const k of cles(baseP)) { const l = lignes(s[k]); if (l) { const i = l.findIndex(r => String(r.id) === id); if (i >= 0) { l.splice(i, 1); if (!Array.isArray(s[k]) && typeof s[k].total === 'number') s[k].total--; } } } delete s[baseP + '/' + id]; return {}; }
    const maj = actionSurId ? { ...op.b, derniere_action: segs[segs.length - 1] } : op.b;
    for (const k of cles(baseP)) { const l = lignes(s[k]); const r = l && l.find(x => String(x.id) === id); if (r) Object.assign(r, maj, { simule: true }); }
    if (s[baseP + '/' + id] && typeof s[baseP + '/' + id] === 'object') Object.assign(s[baseP + '/' + id], maj);
    return { id, ...maj };
  };
  const charge = fetch.bind(window)(BASE + '/demo-data.json').then(r => r.json()).then(d => { data = d; ecriture = false; for (const o of ops) { try { applique(o); } catch {} } ecriture = true; });
  const reel = window.fetch.bind(window);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  const loginDuToken = h => { const m = /Bearer demo\.(.+)$/.exec(h || ''); return m ? m[1] : null; };
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const i = url.pathname.indexOf('/api/');
    if (i < 0 || (url.origin !== location.origin && !/localhost/.test(url.hostname))) return reel(input, init);
    await charge;
    const p = url.pathname.slice(i + 4), meth = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const hdr = init.headers instanceof Headers ? init.headers.get('Authorization') : (init.headers || {}).Authorization || (init.headers || {}).authorization;
    if (p === '/login' && meth === 'POST') {
      let b = {}; try { b = JSON.parse(init.body || '{}'); } catch {}
      const c = data.comptes[b.login]; if (!c || b.pin !== '1234') return json({ erreur: 'Identifiant ou PIN incorrect (démo : PIN 1234).' }, 401);
      return json({ ...c.login, token: 'demo.' + b.login });
    }
    if (meth !== 'GET') {
      let b = {}; try { b = JSON.parse(init.body || '{}'); } catch {}
      if (/^\/(logout|login)/.test(p)) return json({ ok: true });
      const op = { m: meth, p, b, t: Date.now() }; const rep = applique(op);
      if (ecriture) { ops.push(op); try { localStorage.setItem(CLE, JSON.stringify(ops.slice(-300))); } catch {} }
      return json({ ...rep, ok: true, simule: true });
    }
    if (p === '/me') { const c = data.comptes[loginDuToken(hdr)] || data.comptes.admin; return json(c.me); }
    if (p === '/sante') return json({ ok: true, base: 'démonstration statique', version: 'demo' });
    const s = data.snap, cles = [p + url.search, p];
    for (const k of cles) if (k in s) return json(s[k]);
    return json({ erreur: 'Non disponible dans la démonstration statique.', demo: true }, 404);
  };
  // Flux temps réel : substitut inerte (annonce « prêt », ne reçoit aucun événement).
  const EventSourceReel = window.EventSource;
  window.EventSource = function (u) {
    if (!String(u).includes('/api/')) return new EventSourceReel(u);
    const ecouteurs = {}; const o = { readyState: 1, close() {}, addEventListener(t, f) { (ecouteurs[t] = ecouteurs[t] || []).push(f); }, removeEventListener() {} };
    setTimeout(() => (ecouteurs.pret || []).forEach(f => f({ data: '{}' })), 50); return o;
  };
  // Bandeau d'information.
  addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0a2a5e;color:#fff;font:12px system-ui,sans-serif;padding:5px 10px;text-align:center;opacity:.95';
    b.textContent = 'Démonstration publique — données fictives ; vos modifications sont simulées et gardées seulement dans ce navigateur (PIN : 1234 ; comptes : admin, prov.lualaba, agent1, perc1, cami1, fin1, ceec1…) — cliquez pour réinitialiser';
    b.onclick = () => { try { localStorage.removeItem(CLE); } catch {} location.reload(); }; document.body.appendChild(b);
  });
})();
