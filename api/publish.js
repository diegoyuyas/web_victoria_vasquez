// Función serverless de Vercel: valida admin y guarda cambios en GitHub (Vercel republica solo).
const crypto = require('crypto');
const { buildSeo } = require('../lib/seo');
const repo = process.env.GITHUB_REPO, branch = process.env.GITHUB_BRANCH || 'main', token = process.env.GITHUB_TOKEN;
const AUTH = 'api/_auth.json';
const gh = (p, o = {}) => fetch(`https://api.github.com/repos/${repo}/contents/${p}` + (o.method === 'PUT' ? '' : `?ref=${branch}`), {
  ...o, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'web-admin', 'Content-Type': 'application/json' } });
const ghApi = (p, o = {}) => fetch(`https://api.github.com/repos/${repo}/${p}`, {
  ...o, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'web-admin', 'Content-Type': 'application/json' } });
const ghJson = async (r) => { if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()).slice(0, 200)); return r.json(); };
// Rutas assets/uploads/... que siguen en uso (en cualquier parte de los datos)
function refsOf(d) {
  const set = new Set();
  (function w(v) {
    if (typeof v === 'string') { const m = v.match(/assets\/uploads\/[A-Za-z0-9._-]+/g); if (m) m.forEach(x => set.add(x)); }
    else if (Array.isArray(v)) v.forEach(w);
    else if (v && typeof v === 'object') Object.values(v).forEach(w);
  })(d);
  return set;
}
// Borra, en UN solo commit, las fotos subidas que ya no usa ningún dato (solo las de más de 15 min, con fecha en el nombre).
async function limpiarSubidas(d) {
  if (d.config && d.config.limpiarFotos === false) return null;
  const r = await gh('assets/uploads'); if (r.status === 404) return 0; if (!r.ok) throw new Error('GitHub ' + r.status);
  const list = await r.json(); if (!Array.isArray(list)) return 0;
  const usados = refsOf(d), ahora = Date.now();
  const borrar = list.filter(f => f.type === 'file' && !usados.has(f.path)).filter(f => { const m = f.name.match(/-(\d{13})\.[a-z]+$/i); return m && ahora - Number(m[1]) > 15 * 60 * 1000; }).slice(0, 50);
  if (!borrar.length) return 0;
  const ref = await ghJson(await ghApi(`git/ref/heads/${branch}`));
  const base = ref.object.sha;
  const commit = await ghJson(await ghApi(`git/commits/${base}`));
  const tree = await ghJson(await ghApi('git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree: borrar.map(f => ({ path: f.path, mode: '100644', type: 'blob', sha: null })) }) }));
  const nc = await ghJson(await ghApi('git/commits', { method: 'POST', body: JSON.stringify({ message: 'Borrar fotos sin uso desde el portal admin', tree: tree.sha, parents: [base] }) }));
  await ghJson(await ghApi(`git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: nc.sha }) }));
  return borrar.length;
}
async function getFile(p) {
  const r = await gh(p); if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub ' + r.status + ' (revisa GITHUB_TOKEN/GITHUB_REPO)');
  const j = await r.json(); return { sha: j.sha, text: j.content ? Buffer.from(j.content, 'base64').toString('utf8') : '' };
}
async function putFile(p, text, sha, message) {
  const r = await gh(p, { method: 'PUT', body: JSON.stringify({ message, content: Buffer.from(text).toString('base64'), branch, sha: sha || undefined }) });
  if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()).slice(0, 200));
}
const hash = (pw, salt) => crypto.pbkdf2Sync(pw, salt, 100000, 32, 'sha256').toString('hex');
const eq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });
  if (!token || !repo) return res.status(500).json({ ok: false, error: 'Falta configurar GITHUB_TOKEN y GITHUB_REPO en Vercel' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const auth = await getFile(AUTH);
    let ok = false;
    if (b.user === 'admin' && typeof b.password === 'string') {
      if (auth && auth.text) { const a = JSON.parse(auth.text); ok = eq(hash(b.password, a.salt), a.hash); }
      else ok = eq(b.password, '123123'); // contraseña por defecto
    }
    if (!ok) { await new Promise(r => setTimeout(r, 1000)); return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' }); }
    if (b.action === 'login') return res.json({ ok: true });
    if (b.action === 'password') {
      if (typeof b.newPassword !== 'string' || b.newPassword.length < 6) return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
      const salt = crypto.randomBytes(16).toString('hex');
      await putFile(AUTH, JSON.stringify({ salt, hash: hash(b.newPassword, salt) }), auth && auth.sha, 'Cambiar contraseña del admin');
      return res.json({ ok: true });
    }
    if (b.action === 'upload') {
      // Sube una imagen (base64 sin prefijo) a assets/uploads/. Límite de Vercel: ~4.5 MB por petición.
      const name = String(b.name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '-');
      if (!/^[a-z0-9][a-z0-9._-]{0,80}\.(jpg|jpeg|png|webp)$/.test(name)) return res.status(400).json({ ok: false, error: 'Nombre de imagen no válido' });
      if (typeof b.content !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b.content)) return res.status(400).json({ ok: false, error: 'Imagen inválida' });
      if (b.content.length * 0.75 > 4 * 1024 * 1024) return res.status(413).json({ ok: false, error: 'La imagen es demasiado pesada para subirla' });
      const path = 'assets/uploads/' + name;
      const r = await gh(path, { method: 'PUT', body: JSON.stringify({ message: 'Subir imagen desde el portal admin', content: b.content, branch }) });
      if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()).slice(0, 200));
      return res.json({ ok: true, path });
    }
    if (b.action === 'publish') {
      const d = b.data;
      if (!d || typeof d !== 'object' || !d.hero || !Array.isArray(d.servicios)) return res.status(400).json({ ok: false, error: 'Datos inválidos' });
      if (d.whatsapp !== undefined) d.whatsapp = String(d.whatsapp).replace(/\D/g, '').slice(0, 15);
      if (d.whatsappMensaje !== undefined) d.whatsappMensaje = String(d.whatsappMensaje).slice(0, 300);
      const cur = await getFile('data.json');
      // El interruptor del módulo Juegos lo gestiona solo portal_juegos.html: siempre se conserva el valor guardado en el servidor.
      try {
        const prev = cur && cur.text ? JSON.parse(cur.text) : null;
        if (prev && prev.juegos !== undefined) d.juegos = prev.juegos; else delete d.juegos;
      } catch (e) { /* si data.json actual no se puede leer, se respeta lo recibido */ }
      await putFile('data.json', JSON.stringify(d, null, 2), cur && cur.sha, 'Actualizar contenido desde el portal admin');
      // SEO: las etiquetas del <head> deben estar en el HTML (Google y WhatsApp no ejecutan JavaScript)
      let seo = null;
      if (d.sitio && typeof d.sitio === 'object') {
        try {
          const idx = await getFile('index.html');
          const re = /<!--SEO:START-->[\s\S]*?<!--SEO:END-->/;
          if (idx && re.test(idx.text)) {
            const nl = idx.text.includes('\r\n') ? '\r\n' : '\n';
            const col = d.config && d.config.colores && d.config.colores.principal;
            const logo = d.config && d.config.logo;
            const block = buildSeo(d.sitio, { color: col, logo }).split('\n').join(nl);
            const nuevo = idx.text.replace(re, () => '<!--SEO:START-->' + nl + block + nl + '<!--SEO:END-->');
            if (nuevo !== idx.text) await putFile('index.html', nuevo, idx.sha, 'Actualizar SEO desde el portal admin');
            seo = true;
          } else seo = false;
        } catch (e) { seo = false; }
      }
      let limpieza = null;
      try { limpieza = await limpiarSubidas(d); } catch (e) { limpieza = null; }
      return res.json({ ok: true, seo, limpieza });
    }
    res.status(400).json({ ok: false, error: 'Acción no válida' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
};
