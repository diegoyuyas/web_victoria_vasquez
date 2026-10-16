/* Módulo Juegos · Ruleta de la Suerte — parte pública.
   Lo carga main.js solo si data.json tiene juegos.activo = true. No contiene secretos ni textos de ningún negocio:
   el azar y las reglas viven en el servidor (api/ruleta.js); aquí solo se dibuja y se anima el resultado que el servidor devuelve. */
(function () {
  'use strict';
  if (window.__jgCargado) return;
  window.__jgCargado = true;

  const SITE = (window.__JG__ && window.__JG__.data) || {};
  const JG = SITE.juegos || {};
  const API = 'api/ruleta';
  const LS = 'jg_res';
  const reducido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ETIQUETA = (SITE.menu && SITE.menu.juegos) || 'Juegos';
  const TITULO_DEF = JG.titulo || 'Ruleta de la Suerte';

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- almacenamiento local (resultados de este navegador) ----------
  function leerRes() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function guardarRes(codigo, obj) {
    try {
      const t = leerRes(); t[codigo] = Object.assign({ ts: Date.now() }, obj);
      const claves = Object.keys(t).sort((a, b) => t[b].ts - t[a].ts).slice(0, 20);
      const n = {}; claves.forEach(k => { n[k] = t[k]; });
      localStorage.setItem(LS, JSON.stringify(n));
    } catch (e) { /* modo privado: se sigue sin guardar */ }
  }

  // ---------- red ----------
  async function api(action, cuerpo) {
    let r;
    try { r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action }, cuerpo || {})) }); }
    catch (e) { const er = new Error('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.'); er.status = 0; throw er; }
    let j = null; try { j = await r.json(); } catch (e) { /* respuesta no válida */ }
    if (!j || !j.ok) { const er = new Error((j && j.error) || 'Ocurrió un problema. Inténtalo de nuevo.'); er.status = r.status; throw er; }
    return j;
  }
  function normalizarCodigo(v) {
    const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s.length === 12 && s.startsWith('RS') ? 'RS-' + s.slice(2, 6) + '-' + s.slice(6) : null;
  }

  // ---------- colores ----------
  const h2r = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const r2h = r => '#' + r.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = h2r(a), y = h2r(b); return r2h(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = h => { const c = h2r(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  function colorBase() {
    const v = (getComputedStyle(document.documentElement).getPropertyValue('--teal') || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
    const m = v.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/); if (m) return '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    const rgb = v.match(/rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/); if (rgb) return r2h([+rgb[1], +rgb[2], +rgb[3]]);
    return '#2563eb';
  }
  function paleta(n) {
    const b = colorBase(), todos = [b, mix(b, '#ffffff', .78), mix(b, '#ffffff', .45), mix(b, '#000000', .2)];
    let k = 2; while (k < 4 && n % k === 1) k++; // el último sector no debe quedar del mismo color que el primero
    return todos.slice(0, k);
  }
  const textoSobre = f => lum(f) > .42 ? '#1f2937' : '#ffffff';

  // ---------- dibujo de la ruleta ----------
  const polar = (cx, cy, r, deg) => { const t = deg * Math.PI / 180; return [cx + r * Math.sin(t), cy - r * Math.cos(t)]; };
  const cortar = (t, max) => { const s = String(t || ''); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
  function svgRueda(secs) {
    const n = secs.length, a = 360 / n, R = 146, C = 150, pal = paleta(n);
    let o = '<svg viewBox="0 0 300 300" role="img" aria-label="Ruleta con ' + n + ' sectores" xmlns="http://www.w3.org/2000/svg"><circle cx="150" cy="150" r="149" fill="#fff" stroke="#dbe3f0" stroke-width="2"/>';
    secs.forEach((s, i) => {
      const p1 = polar(C, C, R, i * a), p2 = polar(C, C, R, (i + 1) * a);
      const fill = /^#[0-9a-fA-F]{6}$/.test(s.color || '') ? s.color : pal[i % pal.length];
      o += '<path d="M' + C + ',' + C + ' L' + p1[0].toFixed(2) + ',' + p1[1].toFixed(2) + ' A' + R + ',' + R + ' 0 0,1 ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2) + ' Z" fill="' + fill + '" stroke="#fff" stroke-width="1.5"/>';
      const fs = n <= 10 ? 13 : n <= 14 ? 11.5 : n <= 17 ? 10 : 9, col = textoSobre(fill), centro = (i + .5) * a;
      const nom = cortar(s.nombre, n <= 10 ? 18 : n <= 17 ? 16 : 12), fsn = Math.min(fs, 86 / (Math.max(nom.length, 1) * .6)); // el texto se achica para caber
      o += '<g transform="rotate(' + (centro - 90).toFixed(2) + ' ' + C + ' ' + C + ')">' +
        '<text x="' + (C + R - 9) + '" y="' + C + '" text-anchor="end" dominant-baseline="central" font-size="' + fsn.toFixed(1) + '" font-weight="700" fill="' + col + '">' + esc(nom) + '</text>' +
        (s.emoji ? '<text x="' + (C + 36) + '" y="' + C + '" text-anchor="middle" dominant-baseline="central" font-size="' + (fs + 6) + '">' + esc(s.emoji) + '</text>' : '') + '</g>';
    });
    return o + '<circle cx="150" cy="150" r="22" fill="#fff" stroke="#dbe3f0" stroke-width="2"/></svg>';
  }
  const ruedaDemo = () => svgRueda(Array.from({ length: 8 }, () => ({ nombre: '', emoji: '' })));

  // ---------- sección y menú ----------
  function montarSeccion() {
    if ($('#juegos')) return;
    const sec = document.createElement('section');
    sec.id = 'juegos'; sec.className = 'section jg-section';
    sec.innerHTML = '<div class="jg-wrap"><div class="jg-head"><span class="jg-eyebrow">' + esc(ETIQUETA) + '</span><h2>' + esc(TITULO_DEF) + '</h2>' +
      '<p class="jg-lead">¿Tienes un código? Ingrésalo, gira la ruleta y descubre si ganaste un premio.</p></div>' +
      '<div class="jg-card"><div class="jg-card-wheel" aria-hidden="true">' + ruedaDemo() + '</div>' +
      '<div class="jg-card-body"><h3>' + esc(TITULO_DEF) + '</h3><p>Cada código sirve para una sola jugada. Pídelo en el local.</p>' +
      '<button type="button" class="jg-btn" id="jg-abrir">Jugar ahora</button></div></div></div>';
    const ref = document.getElementById('contacto');
    if (ref && ref.parentNode) ref.parentNode.insertBefore(sec, ref); else document.body.appendChild(sec);

    const nav = document.getElementById('navMenu');
    if (nav && !$('#nav-juegos')) {
      const a = document.createElement('a');
      a.href = '#juegos'; a.id = 'nav-juegos'; a.textContent = ETIQUETA;
      a.addEventListener('click', e => {
        e.preventDefault();
        const ov = document.getElementById('navOverlay'); if (ov && ov.classList.contains('open')) ov.click();
        irASeccion();
      });
      const antes = document.getElementById('nav-contacto') || document.getElementById('header-whatsapp');
      if (antes && antes.parentNode === nav) nav.insertBefore(a, antes); else nav.appendChild(a);
    }
    $('#jg-abrir').addEventListener('click', e => abrir(e.currentTarget));
  }
  function irASeccion() { const s = $('#juegos'); if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset - 80, behavior: reducido ? 'auto' : 'smooth' }); }

  // ---------- ventana ----------
  const estado = { cfg: null, sectores: [], rot: 0, codigo: '', enCurso: false, opener: null };
  function montarModal() {
    if ($('#jg-modal')) return;
    const m = document.createElement('div');
    m.id = 'jg-modal'; m.className = 'jg-modal'; m.hidden = true;
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'jg-titulo');
    m.innerHTML = '<div class="jg-backdrop"></div><div class="jg-dialog"><button type="button" class="jg-close" aria-label="Cerrar">×</button>' +
      '<h3 id="jg-titulo"></h3><p class="jg-texto" id="jg-texto"></p>' +
      '<div class="jg-wheelbox" id="jg-wheelbox"><div class="jg-pointer"></div><div class="jg-wheel" id="jg-wheel"></div></div>' +
      '<div class="jg-panel" id="jg-panel" aria-live="polite"></div></div>';
    document.body.appendChild(m);
    m.querySelector('.jg-backdrop').addEventListener('click', cerrar);
    m.querySelector('.jg-close').addEventListener('click', cerrar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) cerrar(); });
    $('#jg-panel').addEventListener('click', clickPanel);
    $('#jg-panel').addEventListener('submit', e => { e.preventDefault(); enviar(e.target.dataset.paso); });
  }
  async function abrir(opener) {
    montarModal();
    estado.opener = opener || null; estado.enCurso = false;
    const m = $('#jg-modal'); m.hidden = false; document.body.classList.add('jg-lock');
    $('#jg-titulo').textContent = TITULO_DEF; $('#jg-texto').textContent = '';
    $('#jg-panel').innerHTML = '<p class="jg-nota">Cargando…</p>';
    try {
      const c = await api('config'); estado.cfg = c;
      $('#jg-titulo').textContent = c.titulo || TITULO_DEF; $('#jg-texto').textContent = c.texto || '';
      if (!c.activo) { $('#jg-wheelbox').classList.add('off'); estado.sectores = []; $('#jg-wheel').innerHTML = ruedaDemo(); return mensaje('La ruleta no está disponible por ahora. Vuelve a intentarlo más tarde.'); }
      $('#jg-wheelbox').classList.remove('off');
      estado.sectores = c.sectores || []; dibujarRueda(); estado.rot = 0; $('#jg-wheel').style.transition = 'none'; $('#jg-wheel').style.transform = 'rotate(0deg)';
      paso('codigo');
    } catch (e) { $('#jg-wheelbox').classList.add('off'); $('#jg-wheel').innerHTML = ruedaDemo(); mensaje(e.message); }
    const f = $('#jg-panel input'); if (f) f.focus();
  }
  function cerrar() {
    if (estado.enCurso) return; // no se cierra en pleno giro
    const m = $('#jg-modal'); if (!m || m.hidden) return;
    m.hidden = true; document.body.classList.remove('jg-lock');
    if (estado.opener && estado.opener.focus) estado.opener.focus();
  }
  function dibujarRueda() { $('#jg-wheel').innerHTML = svgRueda(estado.sectores.length >= 2 ? estado.sectores : [{ nombre: '' }, { nombre: '' }]); }
  const panel = html => { $('#jg-panel').innerHTML = html; };
  const err = t => { const e = $('#jg-err'); if (e) e.textContent = t || ''; };
  function mensaje(t) { panel('<div class="jg-res"><p>' + esc(t) + '</p></div><div class="jg-acciones"><button type="button" class="jg-btn sec" data-act="cerrar">Cerrar</button></div>'); }

  // ---------- pasos ----------
  function paso(p, extra) {
    if (p === 'codigo') {
      panel('<form data-paso="codigo" novalidate><label for="jg-cod">Tu código</label>' +
        '<input id="jg-cod" class="cod" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" placeholder="RS-XXXX-XXXXXX" value="' + esc(extra && extra.valor || '') + '">' +
        '<p class="jg-err" id="jg-err" role="alert">' + esc(extra && extra.error || '') + '</p>' +
        '<div class="jg-acciones"><button class="jg-btn" type="submit" id="jg-seguir">Continuar</button></div></form>');
    } else if (p === 'datos') {
      const dias = estado.cfg && estado.cfg.retencionDias;
      panel('<form data-paso="datos" novalidate><p class="jg-nota" style="margin:0">Código <b>' + esc(estado.codigo) + '</b> válido. Completa tus datos para jugar.</p>' +
        '<label for="jg-nom">Nombres y apellidos</label><input id="jg-nom" type="text" autocomplete="name" maxlength="80">' +
        '<label for="jg-dni">DNI</label><input id="jg-dni" type="tel" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="8 dígitos">' +
        '<label class="chk"><input type="checkbox" id="jg-ok"><span>Acepto que usen mis nombres y DNI solo para entregarme el premio. Si no gano, no se guardan.' + (dias ? ' Si gano, se conservan hasta ' + esc(dias) + ' días después de la entrega.' : '') + '</span></label>' +
        '<p class="jg-err" id="jg-err" role="alert"></p>' +
        '<div class="jg-acciones"><button class="jg-btn sec" type="button" data-act="atras">Atrás</button><button class="jg-btn" type="submit" id="jg-girar">Girar la ruleta</button></div></form>');
      const f = $('#jg-nom'); if (f) f.focus();
    } else if (p === 'girando') {
      panel('<div class="jg-res"><p class="grande">Girando…</p><p>¡Mucha suerte!</p></div>');
    }
  }
  function clickPanel(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'cerrar') cerrar();
    else if (a === 'atras') paso('codigo', { valor: estado.codigo });
    else if (a === 'informar') informar(b);
    else if (a === 'otro') paso('codigo');
  }

  async function enviar(que) {
    if (estado.enCurso) return;
    if (que === 'codigo') {
      const crudo = $('#jg-cod').value, c = normalizarCodigo(crudo);
      if (!c) return err('Revisa el código: tiene el formato RS-XXXX-XXXXXX.');
      const guardado = leerRes()[c];
      $('#jg-seguir').disabled = true;
      try {
        if (guardado && guardado.token) {
          try { const r = await api('recuperar', { codigo: c, token: guardado.token }); return mostrarRecuperado(c, r); } catch (e) { /* si no se puede recuperar, se valida como código nuevo */ }
        }
        await api('validar', { codigo: c });
        estado.codigo = c; paso('datos');
      } catch (e) { paso('codigo', { valor: crudo, error: e.message }); }
    } else if (que === 'datos') {
      const nombres = $('#jg-nom').value.trim().replace(/\s+/g, ' '), dni = $('#jg-dni').value.trim();
      if (nombres.length < 3) return err('Escribe tus nombres y apellidos.');
      if (!/^\d{8}$/.test(dni)) return err('El DNI debe tener 8 dígitos.');
      if (!$('#jg-ok').checked) return err('Debes aceptar el uso de tus datos para poder jugar.');
      estado.enCurso = true; $('#jg-girar').disabled = true;
      try {
        const r = await api('jugar', { codigo: estado.codigo, nombres, dni, consentimiento: true });
        const igual = estado.sectores.length === r.sectores.length && estado.sectores.every((s, i) => s.id === r.sectores[i].id && s.nombre === r.sectores[i].nombre);
        if (!igual) { estado.sectores = r.sectores; dibujarRueda(); }
        guardarRes(estado.codigo, { token: r.token, esPremio: r.esPremio, sector: r.sector.nombre, ticket: r.ticket, informado: false });
        paso('girando');
        girarA(r.sectorIndex, r.sectores.length, () => { estado.enCurso = false; mostrarResultado(r.esPremio, r.sector.nombre, r.ticket, {}); });
      } catch (e) {
        estado.enCurso = false; paso('codigo', { valor: estado.codigo, error: e.message });
      }
    }
  }

  // ---------- animación ----------
  function girarA(indice, n, fin) {
    const w = $('#jg-wheel'), a = 360 / n, centro = (indice + .5) * a, jitter = (Math.random() - .5) * a * .7;
    let destino = (reducido ? 0 : 360 * 5) + 360 - centro + jitter;
    while (destino < estado.rot + 360) destino += 360;
    w.style.transition = reducido ? 'transform .5s ease-out' : 'transform 5.2s cubic-bezier(.12,.62,.12,1)';
    w.getBoundingClientRect(); // fuerza el cálculo para que la transición arranque
    w.style.transform = 'rotate(' + destino.toFixed(2) + 'deg)'; estado.rot = destino;
    setTimeout(fin, reducido ? 650 : 5500);
  }
  function posicionarSector(id) { // para mostrar de nuevo un resultado sin animación
    const i = estado.sectores.findIndex(s => s.id === id); if (i < 0) return;
    const a = 360 / estado.sectores.length, w = $('#jg-wheel');
    estado.rot = 360 - (i + .5) * a; w.style.transition = 'none'; w.style.transform = 'rotate(' + estado.rot.toFixed(2) + 'deg)';
  }

  // ---------- resultados ----------
  function mostrarResultado(esPremio, sector, ticket, extra) {
    extra = extra || {};
    const wa = String(SITE.whatsapp || '').replace(/\D/g, '');
    const textoWa = '¡Hola! Gané en "' + ((estado.cfg && estado.cfg.titulo) || TITULO_DEF) + '". Mi código es ' + estado.codigo + (ticket ? ' (ticket ' + ticket + ')' : '') + '.';
    if (esPremio) {
      panel('<div class="jg-res gana"><p class="grande">🎉 ¡Ganaste!</p><div class="premio">' + esc(sector) + '</div>' +
        (extra.entregado ? '<p><b>Tu premio ya fue entregado.</b></p>' :
          '<p>Presenta tu código y tu DNI para recoger tu premio.</p>' + (extra.informado ? '<p><b>✓ Ya informaste tu resultado.</b></p>' : '')) +
        (ticket ? '<p class="ticket">Ticket ' + esc(ticket) + ' · ' + esc(estado.codigo) + '</p>' : '') + '<p class="jg-err" id="jg-err" role="alert"></p></div>' +
        '<div class="jg-acciones">' +
        (extra.informado || extra.entregado ? '' : '<button type="button" class="jg-btn" data-act="informar">Informar resultado</button>') +
        (wa ? '<a class="jg-btn wa" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(textoWa) + '">Avisar por WhatsApp</a>' : '') +
        '<button type="button" class="jg-btn sec" data-act="cerrar">Cerrar</button></div>');
    } else {
      panel('<div class="jg-res"><p class="grande">' + esc(sector) + '</p><p>Esta vez no hubo premio. ¡Gracias por participar!</p>' +
        (extra.recuperado ? '<p class="jg-nota">Este código ya se usó en este dispositivo.</p>' : '') + '</div>' +
        '<div class="jg-acciones"><button type="button" class="jg-btn sec" data-act="cerrar">Cerrar</button></div>');
    }
  }
  function mostrarRecuperado(codigo, r) {
    estado.codigo = codigo; posicionarSector(r.sector.id);
    mostrarResultado(r.esPremio, r.sector.nombre, r.ticket, { informado: r.informado, entregado: r.entregado, recuperado: true });
  }
  async function informar(btn) {
    const g = leerRes()[estado.codigo]; if (!g || !g.token) return err('No se encontró tu resultado en este dispositivo.');
    btn.disabled = true;
    try {
      await api('informar', { codigo: estado.codigo, token: g.token });
      guardarRes(estado.codigo, Object.assign({}, g, { informado: true }));
      mostrarResultado(true, g.sector, g.ticket, { informado: true });
    } catch (e) { btn.disabled = false; err(e.message); }
  }

  // ---------- arranque ----------
  function iniciar() {
    montarSeccion();
    if (location.hash === '#juegos') setTimeout(irASeccion, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
