// Genera las etiquetas del <head> (título, descripción, vista previa al compartir, iconos) a partir de data.sitio.
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isHex = h => /^#[0-9a-fA-F]{6}$/.test(h || '');
// Solo se aceptan rutas internas del propio sitio (assets/...) o URLs https; los data: se ignoran.
const okPath = p => typeof p === 'string' && p && !/^data:/i.test(p) && (/^https:\/\//i.test(p) || /^assets\/[A-Za-z0-9._\/-]+$/.test(p));

function buildSeo(sitio, opts) {
  sitio = sitio || {}; opts = opts || {};
  const nombre = String(sitio.nombre || '').slice(0, 80);
  const titulo = String(sitio.titulo || nombre || '').slice(0, 120);
  const desc = String(sitio.descripcion || '').slice(0, 300);
  let url = String(sitio.url || '').trim().replace(/\/+$/, '');
  if (url && !/^https:\/\//i.test(url)) url = '';
  const abs = p => /^https:\/\//i.test(p) ? p : (url ? url + '/' + p.replace(/^\/+/, '') : p);
  const og = abs(okPath(sitio.ogImagen) ? sitio.ogImagen : 'og-image.jpg');
  const fav = okPath(sitio.favicon) ? sitio.favicon : 'assets/img/favicon.png?v=4';
  const apple = okPath(sitio.favicon) ? sitio.favicon : (okPath(opts.logo) ? opts.logo : 'assets/img/logo.png?v=4');
  const color = isHex(opts.color) ? opts.color : '#E8478B';
  const L = [
    `<title>${esc(titulo)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta name="theme-color" content="${esc(color)}">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:image" content="${esc(og)}">`,
    `<meta property="og:image:secure_url" content="${esc(og)}">`,
  ];
  if (url) L.push(`<meta property="og:url" content="${esc(url)}/">`);
  L.push(
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(nombre)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(nombre)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(titulo)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(og)}">`,
    `<link rel="icon" type="image/png" href="${esc(fav)}">`,
    `<link rel="apple-touch-icon" href="${esc(apple)}">`
  );
  return L.join('\n');
}
module.exports = { buildSeo, esc };
