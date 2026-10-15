'use strict';
// Cliente mínimo de Upstash Redis por REST, sin dependencias. Un comando = un arreglo, p. ej. ['SET','clave','valor','NX'].
// Variables de Vercel: UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_URL y KV_REST_API_TOKEN).

function credenciales() {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '').trim();
  return { url, token };
}
function configurado() { const c = credenciales(); return !!(c.url && c.token); }

async function llamar(ruta, cuerpo) {
  const { url, token } = credenciales();
  if (!url || !token) { const e = new Error('Base de datos no configurada'); e.codigo = 'REDIS_NO_CONFIG'; throw e; }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url + ruta, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: ctl.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Redis ' + r.status + (j && j.error ? ': ' + j.error : ''));
    return j;
  } finally { clearTimeout(t); }
}

// Un comando. Devuelve el resultado o lanza un error.
async function cmd(args) {
  const j = await llamar('', args.map(String));
  if (j && j.error) throw new Error('Redis: ' + j.error);
  return j.result;
}
// Varios comandos en una sola petición, en orden. Devuelve la lista de resultados.
async function pipeline(cmds) {
  if (!cmds.length) return [];
  const j = await llamar('/pipeline', cmds.map(c => c.map(String)));
  if (!Array.isArray(j)) throw new Error('Redis: respuesta inesperada');
  return j.map(x => { if (x && x.error) throw new Error('Redis: ' + x.error); return x ? x.result : null; });
}

module.exports = { cmd, pipeline, configurado };
