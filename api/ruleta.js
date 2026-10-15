'use strict';
// Función serverless del módulo Juegos (Ruleta de la Suerte). Un solo archivo para todos los negocios:
// cada negocio se separa en Redis con su propio código JUEGOS_NS. Todo el azar y todas las reglas viven aquí.
const crypto = require('crypto');
const redis = require('../lib/redis');
const R = require('../lib/ruleta');

const MSG_CODIGO = 'Este código no es válido o ya fue utilizado.';
const LIM_PETICIONES = { max: 40, ventana: 60 };   // por IP y por minuto
const LIM_FALLOS = { max: 5, ventana: 900 };       // fallos de código/clave por IP en 15 minutos
const AUTH = 'api/_auth.json';

class Http extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// ---------- utilidades ----------
const parse = raw => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const hashPw = (pw, salt) => crypto.pbkdf2Sync(pw, salt, 100000, 32, 'sha256').toString('hex');
const dormir = ms => new Promise(r => setTimeout(r, ms));
const cfgDe = raw => { const c = parse(raw); return c && Array.isArray(c.sectores) ? c : R.configPorDefecto(); };
const cacheCfg = new Map(); // ns -> { t, cfg } (solo para la lectura pública; jugar siempre lee la configuración fresca)

function contexto(req) {
  const ns = R.resolverNs(process.env);
  if (!ns) throw new Http(503, 'Falta configurar JUEGOS_NS en Vercel (código único del negocio, por ejemplo "negocio01").');
  if (!redis.configurado()) throw new Http(503, 'Base de datos no configurada: faltan UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN en Vercel.');
  const h = (req && req.headers) || {};
  const ip = String(h['x-forwarded-for'] || h['x-real-ip'] || (req && req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  const ipk = R.sha(ns + '|' + ip).slice(0, 24); // solo se usa un hash de la IP, como clave temporal
  const p = 'rs:' + ns + ':';
  return { ns, ipk, K: {
    cfg: p + 'cfg', codes: p + 'codes', wins: p + 'wins', nJug: p + 'n:jug', nPrem: p + 'n:prem',
    code: c => p + 'c:' + c, used: c => p + 'used:' + c, pd: c => p + 'pd:' + c, inf: c => p + 'inf:' + c, ent: c => p + 'ent:' + c,
    rq: p + 'rq:' + ipk, bad: p + 'bad:' + ipk, badAdm: p + 'badadm:' + ipk,
  } };
}

// Cuenta un evento y asegura que el contador caduque (si por un fallo quedara sin vencimiento, se corrige).
async function contar(clave, ventana) {
  const [n, ttl] = await redis.pipeline([['INCR', clave], ['TTL', clave]]);
  if (ttl < 0) await redis.cmd(['EXPIRE', clave, ventana]);
  return n;
}
async function limitarPeticiones(ctx) {
  if (await contar(ctx.K.rq, LIM_PETICIONES.ventana) > LIM_PETICIONES.max) throw new Http(429, 'Demasiadas solicitudes. Intenta de nuevo en un minuto.');
}
async function comprobarBloqueo(ctx, clave) {
  const n = Number(await redis.cmd(['GET', clave || ctx.K.bad])) || 0;
  if (n >= LIM_FALLOS.max) throw new Http(429, 'Demasiados intentos. Intenta de nuevo en 15 minutos.');
}
const registrarFallo = (ctx, clave) => contar(clave || ctx.K.bad, LIM_FALLOS.ventana);

// ---------- GitHub (solo para la clave de admin y el interruptor de visibilidad) ----------
function ghConf() {
  const repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN, branch = process.env.GITHUB_BRANCH || 'main';
  if (!repo || !token) throw new Http(503, 'Falta configurar GITHUB_TOKEN y GITHUB_REPO en Vercel');
  return { repo, token, branch };
}
const ghHead = token => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'web-admin', 'Content-Type': 'application/json' });
async function ghGet(path) {
  const { repo, token, branch } = ghConf();
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, { headers: ghHead(token) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub ' + r.status + ' (revisa GITHUB_TOKEN/GITHUB_REPO)');
  const j = await r.json();
  return { sha: j.sha, text: j.content ? Buffer.from(j.content, 'base64').toString('utf8') : '' };
}
async function ghPut(path, text, sha, message) {
  const { repo, token, branch } = ghConf();
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { method: 'PUT', headers: ghHead(token),
    body: JSON.stringify({ message, content: Buffer.from(text).toString('base64'), branch, sha: sha || undefined }) });
  if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()).slice(0, 200));
}
let authCache = { t: 0, v: undefined };
async function leerAuth() {
  if (authCache.v !== undefined && Date.now() - authCache.t < 60000) return authCache.v;
  const f = await ghGet(AUTH);
  const v = f && f.text ? parse(f.text) : null;
  authCache = { t: Date.now(), v };
  return v;
}
async function exigirAdmin(ctx, b) {
  await comprobarBloqueo(ctx, ctx.K.badAdm);
  let ok = false;
  if (b.user === 'admin' && typeof b.password === 'string' && b.password.length > 0 && b.password.length <= 200) {
    const a = await leerAuth();
    ok = a ? eq(hashPw(b.password, a.salt), a.hash) : eq(b.password, '123123'); // sin api/_auth.json vale la clave inicial
  }
  if (!ok) { await registrarFallo(ctx, ctx.K.badAdm); await dormir(800); throw new Http(401, 'Usuario o contraseña incorrectos'); }
}

// ---------- aviso al dueño (se completa en la Etapa R4: Telegram opcional) ----------
async function notificar(/* ctx, evento */) { return false; }

// ---------- acciones públicas ----------
function configPublica(cfg) {
  const base = { ok: true, activo: cfg.activo === true, titulo: cfg.titulo, texto: cfg.texto };
  if (!base.activo) return base;
  return Object.assign(base, { mostrarProbabilidades: cfg.mostrarProbabilidades === true, sectores: R.sectoresPublicos(cfg) });
}

async function validar(ctx, b) {
  await limitarPeticiones(ctx);
  await comprobarBloqueo(ctx);
  const codigo = R.normalizarCodigo(b.codigo);
  if (!codigo) { await registrarFallo(ctx); throw new Http(400, MSG_CODIGO); }
  const [rawCfg, rawCod, usado] = await redis.pipeline([['GET', ctx.K.cfg], ['GET', ctx.K.code(codigo)], ['EXISTS', ctx.K.used(codigo)]]);
  if (!cfgDe(rawCfg).activo) throw new Http(503, 'La ruleta no está disponible por ahora.');
  if (R.estadoCodigo(parse(rawCod), usado > 0, Date.now()) !== 'disponible') { await registrarFallo(ctx); throw new Http(400, MSG_CODIGO); }
  return { ok: true };
}

async function jugar(ctx, b) {
  await limitarPeticiones(ctx);
  const part = R.validarParticipante(b);
  if (!part.ok) throw new Http(400, part.error);
  await comprobarBloqueo(ctx);
  const codigo = R.normalizarCodigo(b.codigo);
  if (!codigo) { await registrarFallo(ctx); throw new Http(400, MSG_CODIGO); }
  const K = ctx.K;
  const [rawCfg, rawCod, usado] = await redis.pipeline([['GET', K.cfg], ['GET', K.code(codigo)], ['EXISTS', K.used(codigo)]]);
  const cfg = cfgDe(rawCfg);
  if (!cfg.activo) throw new Http(503, 'La ruleta no está disponible por ahora.'); // no se consume el código
  if (R.estadoCodigo(parse(rawCod), usado > 0, Date.now()) !== 'disponible') { await registrarFallo(ctx); throw new Http(400, MSG_CODIGO); }

  // El servidor decide el resultado ANTES de guardar nada.
  const sector = R.elegirSector(cfg);
  const esPremio = sector.tipo === 'premio';
  const ts = Date.now();
  const token = crypto.randomBytes(16).toString('hex');
  const ticket = R.sha(codigo + '|' + ts).slice(0, 8).toUpperCase();
  const registro = JSON.stringify({ ts, ticket, sectorId: sector.id, sectorNombre: sector.nombre, esPremio, oddsHash: R.oddsHash(cfg), tokenHash: R.sha(token) });
  // Solo quien gana deja datos personales; quien no gana nunca llega a guardarlos.
  const datos = esPremio ? JSON.stringify({ nombres: part.nombres, dni: part.dni, ts }) : '';
  const ttl = cfg.retencionMaxDias * 86400;

  let primero;
  try {
    primero = Number(await redis.cmd(['EVAL', R.SCRIPT_CLAIM, 5, K.used(codigo), K.pd(codigo), K.wins, K.nJug, K.nPrem, registro, datos, ttl, ts, codigo, esPremio ? '1' : '0'])) === 1;
  } catch (e) {
    // Respaldo si el servidor no admite scripts: el reclamo sigue siendo atómico (SET NX).
    primero = (await redis.cmd(['SET', K.used(codigo), registro, 'NX'])) === 'OK';
    if (primero) {
      const cs = [['INCR', K.nJug]];
      if (esPremio) cs.push(['SET', K.pd(codigo), datos, 'EX', ttl], ['ZADD', K.wins, ts, codigo], ['INCR', K.nPrem]);
      await redis.pipeline(cs);
    }
  }
  if (!primero) { await registrarFallo(ctx); throw new Http(400, MSG_CODIGO); } // otra persona usó el código antes

  const sectores = R.sectoresPublicos(cfg);
  return { ok: true, sectorIndex: sectores.findIndex(s => s.id === sector.id), sector: { id: sector.id, nombre: sector.nombre, emoji: sector.emoji },
    esPremio, sectores, ticket, token };
}

// Comprueba código + token del mismo navegador y devuelve la jugada (o falla con un mensaje genérico).
async function jugadaDe(ctx, b, mensaje) {
  await limitarPeticiones(ctx);
  const codigo = R.normalizarCodigo(b.codigo), token = String(b.token || '');
  if (!codigo || !/^[a-f0-9]{32}$/.test(token)) { await registrarFallo(ctx); throw new Http(400, mensaje); }
  await comprobarBloqueo(ctx);
  const u = parse(await redis.cmd(['GET', ctx.K.used(codigo)]));
  if (!u || !eq(R.sha(token), u.tokenHash)) { await registrarFallo(ctx); throw new Http(400, mensaje); }
  return { codigo, u };
}
async function recuperar(ctx, b) {
  const { codigo, u } = await jugadaDe(ctx, b, 'No se encontró el resultado de este código.');
  const [inf, ent] = await redis.pipeline([['EXISTS', ctx.K.inf(codigo)], ['EXISTS', ctx.K.ent(codigo)]]);
  return { ok: true, esPremio: u.esPremio, sector: { id: u.sectorId, nombre: u.sectorNombre }, ticket: u.ticket, informado: inf > 0, entregado: ent > 0 };
}
async function informar(ctx, b) {
  const { codigo, u } = await jugadaDe(ctx, b, 'No se pudo informar el resultado.');
  if (!u.esPremio) throw new Http(400, 'Este código no tiene un premio que informar.');
  const nuevo = await redis.cmd(['SET', ctx.K.inf(codigo), JSON.stringify({ ts: Date.now() }), 'NX']) === 'OK';
  if (nuevo) { try { await notificar(ctx, { tipo: 'informado', codigo, sector: u.sectorNombre, ticket: u.ticket }); } catch (e) { /* el aviso es opcional */ } }
  return { ok: true, yaInformado: !nuevo };
}

// ---------- acciones de administración ----------
const cuando = ms => new Date(ms).toISOString();
async function fichas(ctx, codigos) {
  if (!codigos.length) return [];
  const K = ctx.K, g = k => ['MGET'].concat(codigos.map(k));
  const [cods, usados, pds, infs, ents] = await redis.pipeline([g(K.code), g(K.used), g(K.pd), g(K.inf), g(K.ent)]);
  return codigos.map((codigo, i) => {
    const c = parse(cods[i]), u = parse(usados[i]), pd = parse(pds[i]), inf = parse(infs[i]), ent = parse(ents[i]);
    return { codigo, estado: R.estadoCodigo(c, !!u, Date.now()), nota: c && c.nota || '', creado: c && c.creado, vence: c && c.vence,
      jugada: u ? { ts: u.ts, ticket: u.ticket, sector: u.sectorNombre, esPremio: u.esPremio } : null,
      informado: !!inf, informadoTs: inf ? inf.ts : null, entregado: !!ent, entregadoTs: ent ? ent.ts : null,
      nombres: pd ? pd.nombres : null, dni: pd ? pd.dni : null, datosEliminados: !!(u && u.esPremio && !pd) };
  });
}
async function ganadores(ctx, estado, limite) {
  const total = await redis.cmd(['ZCARD', ctx.K.wins]);
  const lista = await redis.cmd(['ZREVRANGE', ctx.K.wins, 0, limite - 1]);
  let items = await fichas(ctx, lista);
  if (estado === 'pendiente') items = items.filter(x => !x.entregado);
  else if (estado === 'entregado') items = items.filter(x => x.entregado);
  return { items, total, truncado: total > limite };
}
const celda = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

async function admin(ctx, b, action) {
  await exigirAdmin(ctx, b);
  const K = ctx.K;
  const codigoDe = () => { const c = R.normalizarCodigo(b.codigo); if (!c) throw new Http(400, 'Código no válido'); return c; };
  switch (action) {
    case 'admin_login': return { ok: true, ns: ctx.ns };
    case 'admin_resumen': {
      const [codigos, jugadas, premios, registrados] = await redis.pipeline([['ZCARD', K.codes], ['GET', K.nJug], ['GET', K.nPrem], ['ZCARD', K.wins]]);
      return { ok: true, codigos, jugadas: Number(jugadas) || 0, premios: Number(premios) || 0, ganadoresRegistrados: registrados };
    }
    case 'admin_config_get': {
      const raw = await redis.cmd(['GET', K.cfg]);
      return { ok: true, config: cfgDe(raw), guardada: !!raw };
    }
    case 'admin_config_set': {
      const v = R.validarConfig(b.config);
      if (!v.ok) throw new Http(400, v.error);
      await redis.cmd(['SET', K.cfg, JSON.stringify(v.config)]);
      cacheCfg.delete(ctx.ns);
      return { ok: true, config: v.config };
    }
    case 'admin_visibilidad': {
      const cur = await ghGet('data.json');
      if (!cur) throw new Http(404, 'No se encontró data.json en el repositorio');
      const d = parse(cur.text);
      if (!d) throw new Http(500, 'data.json no se pudo leer');
      d.juegos = Object.assign({}, d.juegos, { activo: b.activo === true });
      await ghPut('data.json', JSON.stringify(d, null, 2), cur.sha, 'Mostrar u ocultar la sección Juegos desde el portal');
      return { ok: true, activo: d.juegos.activo };
    }
    case 'admin_codigos_crear': {
      const n = Number(b.cantidad);
      if (!Number.isInteger(n) || n < 1 || n > 200) throw new Http(400, 'La cantidad debe estar entre 1 y 200');
      const cfg = cfgDe(await redis.cmd(['GET', K.cfg]));
      const dias = b.vencimientoDias === undefined ? cfg.vencimientoDias : Number(b.vencimientoDias);
      if (!Number.isInteger(dias) || dias < 1 || dias > 365) throw new Http(400, 'El vencimiento debe estar entre 1 y 365 días');
      const creado = Date.now(), vence = creado + dias * 86400000;
      const nota = String(b.nota || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80);
      const reg = JSON.stringify({ creado, vence, nota, anulado: false });
      const creados = [];
      for (let intento = 0; intento < 5 && creados.length < n; intento++) {
        const lote = [...new Set(Array.from({ length: n - creados.length }, () => R.genCodigo()))];
        const res = await redis.pipeline(lote.map(c => ['SET', K.code(c), reg, 'NX']));
        lote.forEach((c, i) => { if (res[i] === 'OK') creados.push(c); });
      }
      if (creados.length < n) throw new Http(500, 'No se pudieron generar todos los códigos. Intenta de nuevo.');
      await redis.pipeline(creados.map((c, i) => ['ZADD', K.codes, creado + i, c]));
      return { ok: true, codigos: creados, vence, cantidad: creados.length };
    }
    case 'admin_codigos_listar': {
      const pagina = Math.max(1, Number(b.pagina) || 1), tam = Math.min(100, Math.max(1, Number(b.tamano) || 50));
      const [total, lista] = await redis.pipeline([['ZCARD', K.codes], ['ZREVRANGE', K.codes, (pagina - 1) * tam, pagina * tam - 1]]);
      return { ok: true, total, pagina, tamano: tam, items: await fichas(ctx, lista) };
    }
    case 'admin_codigo_anular': {
      const codigo = codigoDe();
      const [raw, usado] = await redis.pipeline([['GET', K.code(codigo)], ['EXISTS', K.used(codigo)]]);
      const c = parse(raw);
      if (!c) throw new Http(404, 'Ese código no existe');
      if (usado > 0) throw new Http(409, 'Ese código ya fue usado y no se puede anular');
      c.anulado = true;
      await redis.cmd(['SET', K.code(codigo), JSON.stringify(c)]);
      return { ok: true };
    }
    case 'admin_ganadores_listar': {
      const estado = ['pendiente', 'entregado'].includes(b.estado) ? b.estado : 'todos';
      return Object.assign({ ok: true }, await ganadores(ctx, estado, 200));
    }
    case 'admin_verificar': {
      const codigo = codigoDe();
      const [f] = await fichas(ctx, [codigo]);
      if (f.estado === 'inexistente') throw new Http(404, 'Ese código no existe');
      return { ok: true, ficha: f };
    }
    case 'admin_entregar': {
      const codigo = codigoDe();
      const [raw, rawCfg] = await redis.pipeline([['GET', K.used(codigo)], ['GET', K.cfg]]);
      const u = parse(raw);
      if (!u || !u.esPremio) throw new Http(400, 'Ese código no tiene un premio para entregar');
      if ((await redis.cmd(['SET', K.ent(codigo), JSON.stringify({ ts: Date.now() }), 'NX'])) !== 'OK') throw new Http(409, 'Este premio ya fue entregado');
      const dias = cfgDe(rawCfg).retencionDias;
      await redis.cmd(['EXPIRE', K.pd(codigo), dias * 86400]); // desde ahora, los datos se conservan solo "dias" más
      return { ok: true, retencionDias: dias };
    }
    case 'admin_borrar_datos': {
      const codigo = codigoDe();
      return { ok: true, borrado: await redis.cmd(['DEL', K.pd(codigo)]) > 0 };
    }
    case 'admin_exportar': {
      const { items } = await ganadores(ctx, 'todos', 1000);
      const cab = ['codigo', 'fecha', 'premio', 'nombres', 'dni', 'informado', 'entregado', 'fecha_entrega'];
      const filas = items.map(x => [x.codigo, x.jugada ? cuando(x.jugada.ts) : '', x.jugada ? x.jugada.sector : '', x.nombres || (x.datosEliminados ? '(datos eliminados)' : ''),
        x.dni || '', x.informado ? 'si' : 'no', x.entregado ? 'si' : 'no', x.entregadoTs ? cuando(x.entregadoTs) : '']);
      const csv = [cab].concat(filas).map(f => f.map(celda).join(',')).join('\r\n');
      return { ok: true, filename: 'ganadores-' + ctx.ns + '-' + new Date().toISOString().slice(0, 10) + '.csv', csv };
    }
    case 'admin_probar': {
      const n = Math.min(100000, Math.max(100, Number(b.n) || 10000));
      const cfg = cfgDe(await redis.cmd(['GET', K.cfg]));
      const cuenta = R.simular(cfg, n);
      const sectores = cfg.sectores.filter(s => s.activo).map(s => ({ id: s.id, nombre: s.nombre, tipo: s.tipo, esperado: s.pct / 100, obtenido: Math.round(cuenta[s.id] / n * 10000) / 100 }));
      const premios = cfg.sectores.filter(s => s.activo && s.tipo === 'premio').reduce((a, s) => a + cuenta[s.id], 0);
      return { ok: true, n, sectores, porcentajePremios: Math.round(premios / n * 10000) / 100 };
    }
    default: throw new Http(400, 'Acción no válida');
  }
}

// ---------- entrada ----------
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let esAdmin = false;
  try {
    const h = req.headers || {};
    if (h.origin) { // solo desde el propio sitio
      let o = ''; try { o = new URL(h.origin).host; } catch (e) { /* origen no válido */ }
      if (o !== (h['x-forwarded-host'] || h.host)) throw new Http(403, 'Origen no permitido');
    }
    let action;
    let b = {};
    if (req.method === 'GET') {
      action = (req.query && req.query.action) || new URL(req.url || '/', 'http://x').searchParams.get('action');
      if (action !== 'ping') throw new Http(405, 'Método no permitido');
    } else if (req.method === 'POST') {
      try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { throw new Http(400, 'Solicitud no válida'); }
      if (!b || typeof b !== 'object' || JSON.stringify(b).length > 20000) throw new Http(413, 'Solicitud demasiado grande');
      action = String(b.action || '');
    } else throw new Http(405, 'Método no permitido');

    const ctx = contexto(req);
    let out;
    if (action === 'ping') { await limitarPeticiones(ctx); out = { ok: true, ns: ctx.ns, redis: (await redis.cmd(['PING'])) === 'PONG' }; }
    else if (action === 'config') {
      const c = cacheCfg.get(ctx.ns);
      let cfg;
      if (c && Date.now() - c.t < 15000) cfg = c.cfg;
      else { await limitarPeticiones(ctx); cfg = cfgDe(await redis.cmd(['GET', ctx.K.cfg])); cacheCfg.set(ctx.ns, { t: Date.now(), cfg }); }
      out = configPublica(cfg);
    }
    else if (action === 'validar') out = await validar(ctx, b);
    else if (action === 'jugar') out = await jugar(ctx, b);
    else if (action === 'recuperar') out = await recuperar(ctx, b);
    else if (action === 'informar') out = await informar(ctx, b);
    else if (action.startsWith('admin_')) { esAdmin = true; out = await admin(ctx, b, action); }
    else throw new Http(400, 'Acción no válida');
    return res.status(200).json(out);
  } catch (e) {
    if (e instanceof Http) return res.status(e.status).json({ ok: false, error: e.message });
    console.error('[juegos]', e && e.message); // sin datos personales
    return res.status(500).json({ ok: false, error: esAdmin ? 'Error: ' + (e && e.message) : 'Error interno. Intenta de nuevo.' });
  }
};
