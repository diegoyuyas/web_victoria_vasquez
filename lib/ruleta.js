'use strict';
// Lógica pura de la Ruleta de la Suerte (sin red): códigos, configuración, probabilidades y validaciones.
// Las probabilidades se guardan como enteros sobre 10 000 (708 = 7,08 %).
const crypto = require('crypto');

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 símbolos, sin 0 O 1 I
const RE_CODIGO = new RegExp('^RS-[' + ALFABETO + ']{4}-[' + ALFABETO + ']{6}$');
const TOTAL = 10000;

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const aleatorio = n => crypto.randomInt(0, n);

// Código del negocio (espacio de nombres en Redis): JUEGOS_NS; si falta, GITHUB_REPO.
function resolverNs(env) {
  const crudo = String(env.JUEGOS_NS || '').trim() || String(env.GITHUB_REPO || '').trim();
  const ns = crudo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return /^[a-z0-9][a-z0-9-]{1,39}$/.test(ns) ? ns : null;
}

function genCodigo(rnd) {
  rnd = rnd || aleatorio;
  let s = '';
  for (let i = 0; i < 10; i++) s += ALFABETO[rnd(ALFABETO.length)];
  return 'RS-' + s.slice(0, 4) + '-' + s.slice(4);
}
// Acepta minúsculas, espacios y guiones de más; devuelve el código normalizado o null.
function normalizarCodigo(v) {
  if (typeof v !== 'string' || v.length > 40) return null;
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 12 || !s.startsWith('RS')) return null;
  const c = 'RS-' + s.slice(2, 6) + '-' + s.slice(6);
  return RE_CODIGO.test(c) ? c : null;
}

const txt = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const txtMulti = (v, max) => typeof v === 'string' ? v.replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
function entero(v, min, max, def) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function configPorDefecto() {
  // 15 sectores: 3 premios de ejemplo (5 % c/u) y 12 "sigue intentando" (85 % en total).
  const sectores = [];
  for (let i = 0; i < 15; i++) {
    const premio = i % 5 === 0;
    const k = i - Math.floor(i / 5) - 1; // posición entre los "nada"
    sectores.push({
      id: 's' + (i + 1),
      nombre: premio ? 'Premio ' + (i / 5 + 1) : 'Sigue intentando',
      emoji: premio ? '🎁' : '🍀',
      tipo: premio ? 'premio' : 'nada',
      pct: premio ? 500 : (k === 11 ? 712 : 708),
      activo: true,
      color: '',
    });
  }
  return {
    activo: false, titulo: 'Ruleta de la Suerte', texto: '', mostrarProbabilidades: false,
    vencimientoDias: 30, retencionDias: 90, retencionMaxDias: 180, sectores,
  };
}

// Valida y limpia la configuración que envía el portal. Devuelve { ok, error } o { ok, config }.
function validarConfig(e) {
  const fallo = error => ({ ok: false, error });
  if (!e || typeof e !== 'object') return fallo('Configuración inválida');
  const venc = entero(e.vencimientoDias, 1, 365, 30);
  const ret = entero(e.retencionDias, 1, 365, 90);
  const retMax = entero(e.retencionMaxDias, 1, 730, 180);
  if (venc === null) return fallo('El vencimiento de los códigos debe estar entre 1 y 365 días');
  if (ret === null) return fallo('La conservación de datos tras la entrega debe estar entre 1 y 365 días');
  if (retMax === null || retMax < ret) return fallo('El tope de conservación debe estar entre la conservación tras la entrega y 730 días');
  const lista = e.sectores;
  if (!Array.isArray(lista) || lista.length < 6 || lista.length > 20) return fallo('Debe haber entre 6 y 20 sectores');
  const ids = new Set(), sectores = [];
  for (let i = 0; i < lista.length; i++) {
    const s = lista[i] || {};
    const nombre = txt(s.nombre, 40);
    if (!nombre) return fallo('El sector ' + (i + 1) + ' necesita un nombre');
    if (s.tipo !== 'premio' && s.tipo !== 'nada') return fallo('El sector ' + (i + 1) + ' debe ser de tipo premio o sigue intentando');
    const pct = Number(s.pct);
    if (!Number.isInteger(pct) || pct < 0 || pct > TOTAL) return fallo('La probabilidad del sector ' + (i + 1) + ' no es válida');
    let id = typeof s.id === 'string' && /^[a-z0-9_-]{1,20}$/.test(s.id) ? s.id : 's' + (i + 1);
    if (ids.has(id)) id = 's' + (i + 1) + '-' + i;
    ids.add(id);
    sectores.push({
      id, nombre,
      emoji: typeof s.emoji === 'string' ? Array.from(s.emoji.trim()).slice(0, 4).join('') : '',
      tipo: s.tipo, pct, activo: s.activo !== false,
      color: typeof s.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : '',
    });
  }
  const activos = sectores.filter(s => s.activo);
  if (activos.length < 2) return fallo('Debe haber al menos 2 sectores activos');
  const suma = activos.reduce((a, s) => a + s.pct, 0);
  if (suma !== TOTAL) return fallo('Las probabilidades de los sectores activos deben sumar 100 % (ahora suman ' + (suma / 100).toFixed(2) + ' %)');
  return { ok: true, config: {
    activo: e.activo === true, titulo: txt(e.titulo, 60) || 'Ruleta de la Suerte', texto: txtMulti(e.texto, 400),
    mostrarProbabilidades: e.mostrarProbabilidades === true,
    vencimientoDias: venc, retencionDias: ret, retencionMaxDias: retMax, sectores,
  } };
}

// Sectores que ve el público (los activos, en orden). Las probabilidades solo si el dueño lo permite.
function sectoresPublicos(cfg) {
  return cfg.sectores.filter(s => s.activo).map(s => {
    const o = { id: s.id, nombre: s.nombre, emoji: s.emoji, color: s.color };
    if (cfg.mostrarProbabilidades) o.pct = s.pct / 100;
    return o;
  });
}

// Elige un sector según las probabilidades (aleatorio criptográfico, sin sesgo).
function elegirSector(cfg, rnd) {
  rnd = rnd || aleatorio;
  const act = cfg.sectores.filter(s => s.activo && s.pct > 0);
  const r = rnd(TOTAL);
  let acc = 0;
  for (const s of act) { acc += s.pct; if (r < acc) return s; }
  return act[act.length - 1];
}
function simular(cfg, n, rnd) {
  const cuenta = {};
  cfg.sectores.forEach(s => { cuenta[s.id] = 0; });
  for (let i = 0; i < n; i++) cuenta[elegirSector(cfg, rnd).id]++;
  return cuenta;
}
const oddsHash = cfg => sha(JSON.stringify(cfg.sectores.filter(s => s.activo).map(s => [s.id, s.pct]))).slice(0, 12);

// Datos del participante. Los errores de formulario no revelan nada sobre los códigos.
function validarParticipante(b) {
  const nombres = txt(b && b.nombres, 80);
  if (nombres.length < 3 || !/^\p{L}[\p{L}\s'.\-]*$/u.test(nombres)) return { ok: false, error: 'Escribe tus nombres y apellidos.' };
  const dni = String((b && b.dni) == null ? '' : b.dni).trim();
  if (!/^\d{8}$/.test(dni)) return { ok: false, error: 'El DNI debe tener 8 dígitos.' };
  if (!b || b.consentimiento !== true) return { ok: false, error: 'Debes aceptar el uso de tus datos para entregarte el premio.' };
  return { ok: true, nombres, dni };
}

function estadoCodigo(cod, usado, ahora) {
  if (!cod) return 'inexistente';
  if (usado) return 'usado';
  if (cod.anulado) return 'anulado';
  if (cod.vence && ahora > cod.vence) return 'vencido';
  return 'disponible';
}

// Reclamo atómico (el primero gana). KEYS: usado, datos personales, ganadores, contador de jugadas, contador de premios.
// ARGV: registro de la jugada, datos personales, segundos de conservación, fecha, código, '1' si es premio.
const SCRIPT_CLAIM = [
  "if redis.call('SET', KEYS[1], ARGV[1], 'NX') then",
  "  redis.call('INCR', KEYS[4])",
  "  if ARGV[6] == '1' then",
  "    redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])",
  "    redis.call('ZADD', KEYS[3], ARGV[4], ARGV[5])",
  "    redis.call('INCR', KEYS[5])",
  "  end",
  "  return 1",
  "end",
  "return 0",
].join('\n');

module.exports = { ALFABETO, RE_CODIGO, TOTAL, sha, resolverNs, genCodigo, normalizarCodigo, configPorDefecto, validarConfig,
  sectoresPublicos, elegirSector, simular, oddsHash, validarParticipante, estadoCodigo, SCRIPT_CLAIM };
