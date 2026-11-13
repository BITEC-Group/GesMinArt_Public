// Couche matérielle : POS PayRus (WebView Android, objet window.FTPOS) + lecteurs biométriques PLUG-AND-PLAY + simulation navigateur.
// Contrat POS : FTPOS.invoke(id, méthode, argsJson) ; l'application Android répond via window.__ftpos_cb(id, resultJson).
// Biométrie : registre de pilotes détectés automatiquement (branchement à chaud) — voir docs/BIOMETRIE.md :
//   1) « pos »     : module d'empreintes du POS (méthode FTPOS « fingerprint », à fournir par le fabricant)
//   2) « agent »   : agent local GesMinArt (http://localhost:9443/idm-agent/v1) qui enveloppe le SDK de n'importe quel lecteur (contrat ouvert)
//   3) « secugen » : SecuGen WebAPI (https://localhost:8443/SGIFPCapture) — format de réponse à valider avec la documentation du fabricant
//   4) « webusb »  : détection des lecteurs USB connus (information « lecteur branché ») ; la capture passe alors par l'agent
//   5) « simule »  : repli de démonstration, TOUJOURS signalé « simulé »
const pending = new Map(); let seq = 0;
window.__ftpos_cb = (id, res) => { const p = pending.get(id); if (!p) return; pending.delete(id); res && res.error ? p.rej(new Error(res.error)) : p.ok(res); };
const bridge = () => (typeof window !== 'undefined' && window.FTPOS && window.FTPOS.invoke) ? window.FTPOS : null;
function call(method, args = {}, timeout = 40000) {
  return new Promise((ok, rej) => { const b = bridge(); if (!b) return rej(new Error('Pont POS indisponible')); const id = 'c' + (++seq); pending.set(id, { ok, rej }); setTimeout(() => { if (pending.delete(id)) rej(new Error('Délai dépassé (' + method + ')')); }, timeout); b.invoke(id, method, JSON.stringify(args)); });
}
const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
const timeout = (ms) => { try { return AbortSignal.timeout(ms); } catch { return undefined; } };

// ---------- Pilotes biométriques ----------
const AGENT = (typeof localStorage !== 'undefined' && localStorage.getItem('idm_agent_url')) || 'http://localhost:9443/idm-agent/v1';
const USB_VENDEURS = { 0x1162: 'SecuGen', 0x16d1: 'Suprema', 0x1491: 'Futronic', 0x05ba: 'DigitalPersona', 0x096e: 'Feitian', 0x1b55: 'ZKTeco', 0x0a86: 'Nitgen', 0x079b: 'IDEMIA / Morpho', 0x08ff: 'AuthenTec', 0x147e: 'Upek' };
const usbConnus = [];
const drivers = {
  pos: { id: 'pos', nom: 'Module d\'empreintes du POS', priorite: 1,
    async detect() { if (!bridge()) return null; try { await call('fingerprint', { sonde: true }, 3000); return { appareil: 'Capteur du POS PayRus' }; } catch (e) { return /inconnue|unsupported|non support|fourni/i.test(e.message) ? null : { appareil: 'Capteur du POS PayRus' }; } },
    async capture(o) { const r = await call('fingerprint', { doigt: o.doigt, qualite_min: o.qualiteMin }); return { gabarit: r.gabarit, qualite: r.qualite, format: r.format || 'ISO19794-2', appareil: r.appareil || 'POS PayRus', simule: false }; } },
  agent: { id: 'agent', nom: 'Agent local GesMinArt (plug and play)', priorite: 2,
    async detect() { try { const r = await fetch(AGENT + '/appareils', { signal: timeout(1200) }); if (!r.ok) return null; const j = await r.json(); const a = (j.appareils || []).find(x => x.pret !== false); return a ? { appareil: `${a.fabricant || ''} ${a.modele || ''}`.trim() || 'Lecteur', serie: a.serie, simule: !!a.simule, modalites: a.modalites } : null; } catch { return null; } },
    async capture(o) { const r = await fetch(AGENT + '/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modalite: o.modalite || 'fingerprint', doigt: o.doigt, qualite_min: o.qualiteMin || 60, format: 'ISO19794-2' }), signal: timeout(45000) }); const j = await r.json(); if (!r.ok || j.erreur) throw new Error(j.erreur || 'Capture refusée'); return { gabarit: j.gabarit_b64 || j.gabarit, qualite: j.qualite, format: j.format, appareil: `${j.appareil?.fabricant || ''} ${j.appareil?.modele || ''}`.trim(), simule: !!j.appareil?.simule }; } },
  secugen: { id: 'secugen', nom: 'SecuGen WebAPI', priorite: 3,
    async detect() { try { if (typeof localStorage === 'undefined' || localStorage.getItem('idm_secugen') !== '1') return null; /* opt-in : évite des erreurs réseau à chaque sondage */ const r = await fetch('https://localhost:8443/SGIFPCapture', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'Timeout=1&Quality=10&TemplateFormat=ISO', signal: timeout(1500) }); const j = await r.json(); return j && j.ErrorCode !== undefined && j.ErrorCode !== 55 ? { appareil: `${j.Manufacturer || 'SecuGen'} ${j.Model || ''}`.trim() } : null; } catch { return null; } },
    async capture(o) { const r = await fetch('https://localhost:8443/SGIFPCapture', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `Timeout=10000&Quality=${o.qualiteMin || 60}&TemplateFormat=ISO`, signal: timeout(20000) }); const j = await r.json(); if (j.ErrorCode) throw new Error('SecuGen : code erreur ' + j.ErrorCode); return { gabarit: j.TemplateBase64, qualite: j.NFIQ ? Math.max(0, 100 - (j.NFIQ - 1) * 20) : 70, format: 'ISO19794-2', appareil: `${j.Manufacturer || 'SecuGen'} ${j.Model || ''}`.trim(), simule: false }; } },
  simule: { id: 'simule', nom: 'Simulation (démonstration)', priorite: 9, async detect() { return { appareil: 'Capteur simulé', simule: true }; },
    async capture(o) { await new Promise(r => setTimeout(r, 800)); return { gabarit: o.repris || hex(16), qualite: 70 + Math.floor(Math.random() * 28), format: 'SIMULE', appareil: 'Capteur simulé', simule: true }; } },
};
let etat = { driver: 'simule', appareil: 'Capteur simulé', simule: true, usb: [] }; const abonnes = new Set();
async function sonder() {
  const found = []; for (const d of Object.values(drivers).sort((a, b) => a.priorite - b.priorite)) { const r = await d.detect().catch(() => null); if (r) found.push({ driver: d.id, nom: d.nom, ...r }); if (r && d.id !== 'simule') break; }
  const best = found[0];
  const nouveau = { driver: best.driver, appareil: best.appareil, serie: best.serie, simule: !!best.simule || best.driver === 'simule', usb: usbConnus.map(u => u.nom) };
  if (JSON.stringify(nouveau) !== JSON.stringify(etat)) { etat = nouveau; abonnes.forEach(f => { try { f(etat); } catch {} }); } return etat;
}
const usbNom = d => `${USB_VENDEURS[d.vendorId] || 'USB 0x' + d.vendorId.toString(16)} ${d.productName || ''}`.trim();
const usbMaj = async () => { if (!navigator.usb) return; try { const l = await navigator.usb.getDevices(); usbConnus.length = 0; for (const d of l) if (USB_VENDEURS[d.vendorId]) usbConnus.push({ nom: usbNom(d), vendeur: USB_VENDEURS[d.vendorId] }); } catch {} sonder(); };
if (typeof navigator !== 'undefined' && navigator.usb) { navigator.usb.addEventListener('connect', usbMaj); navigator.usb.addEventListener('disconnect', usbMaj); usbMaj(); }
let timer = null;

export const bio = {
  drivers, etat: () => etat,
  // Surveillance : détecte le branchement / débranchement sans action de l'utilisateur (sondage toutes les 6 s + évènements USB).
  surveiller(cb) { abonnes.add(cb); cb(etat); if (!timer) { sonder(); timer = setInterval(sonder, 6000); } return () => abonnes.delete(cb); },
  sonder,
  async autoriserUsb() { if (!navigator.usb) throw new Error('WebUSB indisponible dans ce navigateur (utiliser Chrome / Edge) — ou passer par l\'agent local.'); await navigator.usb.requestDevice({ filters: Object.keys(USB_VENDEURS).map(v => ({ vendorId: +v })) }); await usbMaj(); },
  async capture(modalite = 'fingerprint', o = {}) { await sonder(); const d = drivers[etat.driver] || drivers.simule; try { return { ...(await d.capture({ ...o, modalite })), driver: d.id }; } catch (e) { if (d.id === 'simule') throw e; throw new Error(`${d.nom} : ${e.message}`); } },
};

export const hw = {
  get isPOS() { return !!bridge(); },
  async info() { try { return this.isPOS ? await call('deviceInfo') : { modele: 'Navigateur (simulation)', serie: '—', pos: false }; } catch { return { modele: 'POS non répondant', pos: false }; } },
  beep(ms = 120) { if (this.isPOS) call('beep', { ms }).catch(() => {}); else try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(); o.frequency.value = 880; o.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, ms); } catch {} },
  async printReceipt(recu) { // recu = réponse de /api/pos/recu/:id
    if (this.isPOS) return call('printReceipt', recu);
    const e = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const style = 'body{font:12px monospace;width:58mm;margin:6px}h4,p{text-align:center;margin:3px 0}td{vertical-align:top;padding:1px 2px}hr{border:0;border-top:1px dashed #000}';
    const corps = `<h4>${e(recu.titre)}</h4><p>${e(recu.sous_titre)}</p><hr><table>${recu.lignes.map(l => `<tr><td>${e(l[0])}</td><td><b>${e(l[1])}</b></td></tr>`).join('')}</table><hr><p>${e(recu.pied)}</p><p>[QR] ${e(recu.qr)}</p>`;
    const titre = 'Reçu ' + e(recu.lignes[0][1]);
    if (document.querySelector('link[href*="app.css"]')) { const { apercu } = await import('./apercu.js'); await apercu({ titre, corps, style, taille: '58mm 200mm', marge: '2mm', largeur: 240 }); return { ok: true, simule: true }; }
    // PWA mobile : document autonome ouvert dans un onglet (aucune fenêtre popup)
    const doc = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title><style>@page{size:58mm 200mm;margin:2mm}${style}</style></head><body>${corps}<script>addEventListener('load',()=>setTimeout(()=>print(),200))<\/script></body></html>`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' })); a.target = '_blank'; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove();
    return { ok: true, simule: true };
  },
  async readNfc(sec = 15) { if (this.isPOS) return call('readNfc', { sec }, (sec + 5) * 1000); await new Promise(r => setTimeout(r, 700)); return { atr: hex(8).toUpperCase(), simule: true }; },
  // Retourne { gabarit, qualite, format, appareil, simule } — l'image brute n'est jamais conservée, seul le gabarit l'est.
  async captureFingerprint(doigt = 'index droit', o = {}) { const r = await bio.capture('fingerprint', { doigt, ...o }); return { ...r, doigts: 1 }; },
  gps(opts = {}) { return new Promise((ok, rej) => { if (!navigator.geolocation) return rej(new Error('GPS indisponible')); navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy }), e => rej(new Error(e.message)), { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000, ...opts }); }); },
};
