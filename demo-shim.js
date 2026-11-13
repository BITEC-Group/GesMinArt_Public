// « Faux serveur » de la réplique statique : intercepte les appels /api et répond depuis l'instantané demo-data.json (données fictives).
// Lecture seule : les écritures sont refusées avec un message clair. Aucune donnée n'est envoyée nulle part.
(() => {
  const BASE = window.DEMO_BASE || '';
  let data = null;
  const charge = fetch.bind(window)(BASE + '/demo-data.json').then(r => r.json()).then(d => { data = d; });
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
    if (meth !== 'GET') return json({ erreur: 'Démonstration en lecture seule : cette action n\'est pas enregistrée. Utilisez l\'application complète pour les essais d\'écriture.', demo: true }, 403);
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
    b.textContent = 'Démonstration publique — données fictives, lecture seule (PIN de test : 1234 ; comptes : admin, prov.lualaba, agent1, perc1, cami1, fin1, ceec1…)';
    b.onclick = () => b.remove(); document.body.appendChild(b);
  });
})();
