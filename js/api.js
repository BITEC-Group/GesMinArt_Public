// Client API (jeton en sessionStorage). Les erreurs serveur remontent avec leur message en français.
let token = null; try { token = sessionStorage.getItem('idm_token'); } catch {}
export const setToken = t => { token = t; try { t ? sessionStorage.setItem('idm_token', t) : sessionStorage.removeItem('idm_token'); } catch {} };
export const hasToken = () => !!token;
export const getToken = () => token;
export async function api(path, body, method) {
  const r = await fetch('/api' + path, { method: method || (body !== undefined ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { setToken(null); location.reload(); }
  if (!r.ok) { const e = new Error(j.erreur || 'Erreur ' + r.status); e.data = j; e.status = r.status; throw e; }
  return j;
}
export const qs = o => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== '' && v != null) p.set(k, v); const s = p.toString(); return s ? '?' + s : ''; };
