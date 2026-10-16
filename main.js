
// Carrusel + Fondo transparente
(function(){
  window.__BRAND__ = window.__BRAND__ || {};
  function safe(fn,name){ try{ fn(); }catch(e){ console.warn('[safe] '+name, e); } }
  function initRevealSafety(){
    setTimeout(function(){
      document.querySelectorAll('.reveal').forEach(function(el){
        var cs = getComputedStyle(el);
        if(cs.opacity === '0'){ el.classList.add('is-visible'); }
      });
    },6000);
  }
  function initSplash(){
    var s=document.getElementById('splash'); if(!s) return;
    setTimeout(function(){ s.classList.add('hide'); setTimeout(function(){ s.remove(); },600); },2800);
  }
  function initTextSplit(){
    document.querySelectorAll('[data-split]').forEach(function(el){
      if(el.dataset.done) return;
      var words=el.textContent.trim().split(' ');
      el.innerHTML=words.map(function(w){return '<span class="word"><span>'+w+'</span></span>';}).join(' ');
      el.dataset.done='1';
    });
  }
  function initObserver(){
    if(!('IntersectionObserver' in window)){
      document.querySelectorAll('.reveal').forEach(function(e){ e.classList.add('is-visible'); });
      return;
    }
    var o=new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('is-visible'); o.unobserve(en.target);} });
    },{threshold:0.05, rootMargin:'0px 0px -10% 0px'});
    document.querySelectorAll('.reveal').forEach(function(e){ o.observe(e); });
  }
  function initMagnetic(){
    document.querySelectorAll('[data-magnetic]').forEach(function(b){
      if(b.dataset.mdone) return;
      b.addEventListener('mousemove',function(e){
        var r=b.getBoundingClientRect();
        var x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2;
        b.style.transform='translate('+(x*0.15)+'px,'+(y*0.35)+'px)';
      });
      b.addEventListener('mouseleave',function(){ b.style.transform='translate(0,0)'; });
      b.dataset.mdone='1';
    });
  }
  function initNav(){
    var t=document.getElementById('navToggle'), n=document.getElementById('navMenu'), ov=document.getElementById('navOverlay');
    if(!t||!n||t.dataset.done) return;
    function openNav(){ n.classList.add('open'); t.classList.add('open'); if(ov) ov.classList.add('open'); document.body.classList.add('no-scroll'); t.setAttribute('aria-expanded','true'); }
    function closeNav(){ n.classList.remove('open'); t.classList.remove('open'); if(ov) ov.classList.remove('open'); document.body.classList.remove('no-scroll'); t.setAttribute('aria-expanded','false'); }
    t.addEventListener('click',function(){ if(n.classList.contains('open')) closeNav(); else openNav(); });
    if(ov) ov.addEventListener('click', closeNav);
    n.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(){ closeNav(); }); });
    t.dataset.done='1';
  }
  function initAnchors(){
    document.querySelectorAll('a[href^="#"]').forEach(function(a){
      if(a.dataset.sdone) return;
      a.addEventListener('click',function(e){
        var id=a.getAttribute('href'); if(id.length>1){ var tg=document.querySelector(id); if(tg){ e.preventDefault(); window.scrollTo({top:tg.offsetTop-80,behavior:'smooth'}); } }
      });
      a.dataset.sdone='1';
    });
  }
  function initAdminAccess(){
    var logo=document.querySelector('.header .logo'); if(!logo||logo.dataset.adm) return;
    var clicks=0, timer=null;
    logo.addEventListener('click',function(e){
      clicks++; clearTimeout(timer);
      timer=setTimeout(function(){ clicks=0; },2500); // los 5 clics deben ser seguidos
      if(clicks>=5){ clicks=0; e.preventDefault(); window.location.href='portal_admin.html'; }
    });
    logo.dataset.adm='1';
  }
  document.addEventListener('DOMContentLoaded',function(){
    safe(initAdminAccess,'admin'); safe(initTextSplit,'split'); safe(initRevealSafety,'safety'); safe(initObserver,'observer');
    safe(initMagnetic,'magnetic'); safe(initNav,'nav'); safe(initAnchors,'anchors'); safe(initSplash,'splash');
  });
})();

// === CARRUSEL + FONDO TRANSPARENTE + DATA.JSON ===
(function(){
  let carouselIndex = 0;
  let carouselTimer = null;
  let slides = [];

  // ---- Logo configurable desde el portal ----
  const LOGO_DEF = 'assets/img/logo.png?v=4';
  let LOGO = LOGO_DEF;
  const logoSrc = p => (LOGO!==LOGO_DEF && /(^|\/)logo\.png/.test(p||'')) ? LOGO : p;
  function applyLogo(u){
    document.querySelectorAll('img[data-logo]').forEach(i=>{ if(i.getAttribute('src')!==u) i.setAttribute('src',u); });
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(l=>{
      if(l.dataset.orig===undefined) l.dataset.orig = l.getAttribute('href');
      l.setAttribute('href', u===LOGO_DEF ? l.dataset.orig : u);
    });
  }
  function setLogo(data){
    const c = data.config && data.config.logo;
    LOGO = c || LOGO_DEF;
    try{ if(c && c.indexOf('data:')!==0) localStorage.setItem('bz_logo',c); else localStorage.removeItem('bz_logo'); }catch(e){}
    applyLogo(LOGO);
  }
  try{ const cached = localStorage.getItem('bz_logo'); if(cached){ LOGO = cached; applyLogo(cached); } }catch(e){}

  // ---- Módulo Juegos (opcional): solo se carga si data.juegos.activo es verdadero ----
  function cargarJuegos(data){
    if(!(data.juegos && data.juegos.activo) || window.__JG__) return;
    window.__JG__ = { data: data };
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'juegos.css'; document.head.appendChild(l);
    const sc = document.createElement('script'); sc.src = 'juegos.js'; sc.defer = true; document.body.appendChild(sc);
  }

  // ---- Carrusel opcional ----
  function applyCarrusel(data){
    const on = !(data.config && data.config.carruselActivo === false);
    const hv = document.getElementById('hero-visual'), grid = document.querySelector('.hero-grid');
    if(hv) hv.style.display = on ? '' : 'none';
    if(grid) grid.classList.toggle('hero-solo', !on);
  }

  // ---- Colores configurables desde el portal ----
  const COLOR_DEF = {principal:'#E8478B', texto:'#14295F', fondo:'#FFF8FB'};
  const COLOR_KEYS = ['--teal','--teal2','--on-teal','--charcoal','--blue','--cream','--cream-rgb','--cream2','--line'];
  const hexOk = h => /^#[0-9a-fA-F]{6}$/.test(h||'');
  const h2r = h => [1,3,5].map(i=>parseInt(h.substr(i,2),16));
  const r2h = r => '#'+r.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
  const mixC = (a,b,t) => { const x=h2r(a), y=h2r(b); return r2h(x.map((v,i)=>v+(y[i]-v)*t)); };
  const lumC = h => { const c=h2r(h).map(v=>{ v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
  function colorVars(c){
    const p = hexOk(c.principal)?c.principal:COLOR_DEF.principal, t = hexOk(c.texto)?c.texto:COLOR_DEF.texto, f = hexOk(c.fondo)?c.fondo:COLOR_DEF.fondo;
    const l = lumC(p), onP = (1.05/(l+.05)) >= 3 ? '#ffffff' : '#111111';
    return {'--teal':p,'--teal2':mixC(p,'#000000',.15),'--on-teal':onP,'--charcoal':t,'--blue':t,'--cream':f,'--cream-rgb':h2r(f).join(','),'--cream2':mixC(f,p,.12),'--line':mixC(f,p,.15)};
  }
  function applyColorVars(v){
    const st = document.documentElement.style;
    COLOR_KEYS.forEach(k=>{ if(v && v[k]) st.setProperty(k,v[k]); else st.removeProperty(k); });
    const m = document.querySelector('meta[name="theme-color"]');
    if(m){ if(m.dataset.orig===undefined) m.dataset.orig = m.getAttribute('content'); m.setAttribute('content', v ? v['--teal'] : m.dataset.orig); }
  }
  function setColors(data){
    const c = data.config && data.config.colores;
    const v = (c && (c.principal||c.texto||c.fondo)) ? colorVars(c) : null;
    applyColorVars(v);
    try{ if(v) localStorage.setItem('bz_colors',JSON.stringify(v)); else localStorage.removeItem('bz_colors'); }catch(e){}
  }
  try{ const cc = localStorage.getItem('bz_colors'); if(cc) applyColorVars(JSON.parse(cc)); }catch(e){}

  // ---- Sección Ubícanos ----
  function renderUbicacion(data){
    const u = Object.assign({activo:true, eyebrow:'Visítanos', titulo:'Ubícanos', texto:'Encuentra nuestro punto de atención y llega fácil con Google Maps.', direccion:'Lima, Perú', mapaEmbed:'', enlace:'', btnTexto:'Clic para saber cómo llegar', imagen:''}, data.ubicacion||{});
    const sec = document.getElementById('ubicanos'), nav = document.getElementById('nav-ubicanos');
    if(!sec) return;
    const show = u.activo!==false;
    sec.style.display = show ? '' : 'none'; if(nav) nav.style.display = show ? '' : 'none';
    if(!show) return;
    const set = (id,t)=>{ const e=document.getElementById(id); if(e) e.textContent=t||''; };
    set('ubi-eyebrow',u.eyebrow); set('ubi-titulo',u.titulo); set('ubi-dir',u.direccion);
    const ute = document.getElementById('ubi-texto'); if(ute) ute.innerHTML = rich(u.texto);
    const dir = encodeURIComponent(u.direccion||'Lima, Perú');
    // mapa: acepta el código "Insertar un mapa" de Google (solo se permite google.com/maps)
    const m = String(u.mapaEmbed||'').match(/src=["']([^"']+)["']/);
    const cand = (m ? m[1] : String(u.mapaEmbed||'').trim()).replace(/&amp;/g,'&');
    const ifr = document.getElementById('ubi-iframe');
    if(ifr) ifr.src = /^https:\/\/www\.google\.com\/maps\//.test(cand) ? cand : 'https://www.google.com/maps?q='+dir+'&output=embed';
    const btn = document.getElementById('ubi-btn');
    if(btn){ btn.textContent = u.btnTexto || 'Clic para saber cómo llegar'; btn.href = /^https?:\/\//.test(u.enlace||'') ? u.enlace : 'https://www.google.com/maps/dir/?api=1&destination='+dir; }
    const ph = document.getElementById('ubi-photo'), im = document.getElementById('ubi-img'), grid = document.getElementById('ubi-grid');
    if(ph && im){ if(u.imagen){ im.src = u.imagen; ph.hidden = false; grid.classList.remove('no-photo'); } else { ph.hidden = true; grid.classList.add('no-photo'); } }
  }

  async function loadDataJson(){
    try{
      const res = await fetch('data.json?v=' + Date.now(), {cache: 'no-store'});
      if(!res.ok) throw new Error('data.json no encontrado');
      const data = await res.json();
      console.log('[Web] data.json cargado', data);
      setLogo(data);
      applyCarrusel(data);
      setColors(data);
      renderFromData(data);
      renderUbicacion(data);
      renderSecciones(data);
      cargarJuegos(data);
      initFondo(data);
      initCarrusel(data);
    }catch(e){
      console.warn('[Web] No se pudo cargar data.json:', e);
      try{ renderUbicacion({}); }catch(_){}
    }
  }

  // Texto simple del portal: **negrita** y saltos de línea. Acepta también los <strong>/<br> antiguos y descarta cualquier otro HTML.
  function legacyMd(t){ return String(t==null?'':t).replace(/<\s*\/?\s*(?:strong|b)\s*>/gi,'**').replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/?[a-zA-Z][^>]*>/g,''); }
  function rich(t){ let s = legacyMd(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); s = s.replace(/\*\*([\s\S]+?)\*\*/g,'<strong>$1</strong>'); return s.replace(/\r?\n/g,'<br>'); }

  function renderFromData(data){
    // WhatsApp único: un solo número alimenta todos los botones
    const waNum = String(data.whatsapp||'').replace(/\D/g,'');
    const site = data.sitio || {};
    const nombre = site.nombre || '';
    const waMsg = data.whatsappMensaje || ('Hola' + (nombre ? ' '+nombre : '') + ', quisiera hacer una consulta');
    const waUrl = waNum ? 'https://wa.me/'+waNum+'?text='+encodeURIComponent(waMsg) : '';
    const clamp = (v,d,min,max)=>{ v=parseFloat(v); return isFinite(v) ? Math.min(max,Math.max(min,v)) : d; };
    const attr = v => String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const wf = document.getElementById('wa-float');
    if(wf){ if(waUrl && data.whatsappFlotante!==false){ wf.href = waUrl; wf.hidden = false; } else wf.hidden = true; }
    // Sitio, menú y textos fijos editables desde el portal
    if(site.titulo) document.title = site.titulo;
    if(nombre){ ['.splash-inner img','.header .logo img'].forEach(sel=>{ const im=document.querySelector(sel); if(im) im.alt = nombre; }); }
    const mn = data.menu || {};
    [['nav-inicio','inicio'],['nav-productos','productos'],['nav-nosotros','nosotros'],['nav-ubicanos','ubicanos'],['nav-contacto','contacto'],['header-whatsapp','boton']].forEach(([id,k])=>{ const e=document.getElementById(id); if(e && mn[k]) e.textContent = mn[k]; });
    const chips = data.hero && Array.isArray(data.hero.chips) ? data.hero.chips : null;
    if(chips){ [1,2].forEach(n=>{ const el=document.getElementById('hero-chip-'+n), ch=chips[n-1]; if(!el) return;
      if(ch && (ch.icono||ch.destacado||ch.texto)){ el.innerHTML = '<span>'+attr(ch.icono)+'</span><div><strong>'+attr(ch.destacado)+'</strong> '+attr(ch.texto)+'</div>'; el.style.display=''; } else el.style.display='none'; }); }
    const pr = data.productos || {};
    const pe = document.getElementById('prod-eyebrow'), pt = document.getElementById('prod-titulo');
    if(pe && pr.eyebrow) pe.textContent = pr.eyebrow; if(pt && pr.titulo) pt.textContent = pr.titulo;
    const ft = data.footer || {};
    const f1 = document.getElementById('footer-t-serv'), f2 = document.getElementById('footer-t-hor');
    if(f1 && ft.tituloServicios) f1.textContent = ft.tituloServicios; if(f2 && ft.tituloHorario) f2.textContent = ft.tituloHorario;
    if(data.hero){
      const b = document.getElementById('hero-badge');
      const t = document.getElementById('hero-titulo');
      const d = document.getElementById('hero-desc');
      const c = document.getElementById('hero-cta');
      const n = document.getElementById('hero-nota');
      const hw = document.getElementById('header-whatsapp');
      if(b && data.hero.badge) b.textContent = data.hero.badge;
      if(t && data.hero.titulo) t.textContent = data.hero.titulo;
      if(d && data.hero.descripcion) d.innerHTML = rich(data.hero.descripcion);
      if(c){ if(data.hero.ctaTexto) c.textContent = data.hero.ctaTexto; if(waUrl) c.href = waUrl; else if(data.hero.ctaLink) c.href = data.hero.ctaLink; }
      if(n && data.hero.ctaNota) n.textContent = data.hero.ctaNota;
      if(hw){ if(waUrl) hw.href = waUrl; else if(data.hero.ctaLink) hw.href = data.hero.ctaLink; }
    }
    if(data.trust && Array.isArray(data.trust)){
      const tg = document.getElementById('trust-grid');
      if(tg){ tg.innerHTML = data.trust.map(item => `<div><strong>${esc(item.numero)}</strong> ${esc(item.texto)}</div>`).join(''); }
    }
    if(data.servicios){
      const grid = document.getElementById('services-grid');
      if(grid){
        grid.innerHTML = '';
        data.servicios.filter(s=>s.activo!==false).forEach((s,i)=>{
          const div = document.createElement('div');
          div.className = 'svc reveal is-visible';
          div.style.transitionDelay = (i*0.05)+'s';
          let top = `<i>${s.icono||'💧'}</i>`;
          if(s.imagen){
            const x=clamp(s.posX,50,0,100), y=clamp(s.posY,50,0,100), z=clamp(s.zoom,1,1,3);
            top = `<div class="svc-photo"><img src="${attr(s.imagen)}" alt="${attr(s.titulo)}" loading="lazy" style="object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%"></div>`;
          }
          const btn = waNum ? `<a class="btn btn-teal svc-btn" href="https://wa.me/${waNum}?text=${encodeURIComponent((pr.mensaje||'Hola, quisiera solicitar: ')+(s.titulo||''))}" target="_blank" rel="noopener">${attr(pr.botonTexto||'Solicitar >')}</a>` : '';
          div.innerHTML = `${top}<h3>${esc(s.titulo)}</h3><p>${rich(s.descripcion)}</p>${btn}`;
          grid.appendChild(div);
        });
      }
    }
    if(data.nosotros){
      const eye = document.getElementById('nosotros-eyebrow');
      const tit = document.getElementById('nosotros-titulo');
      const desc = document.getElementById('nosotros-desc');
      const val = document.getElementById('nosotros-valores');
      const test = document.getElementById('nosotros-testimonio');
      const aut = document.getElementById('nosotros-autor');
      if(eye && data.nosotros.eyebrow) eye.textContent = data.nosotros.eyebrow;
      if(tit && data.nosotros.titulo) tit.textContent = data.nosotros.titulo;
      if(desc && data.nosotros.descripcion) desc.innerHTML = rich(data.nosotros.descripcion);
      if(val && Array.isArray(data.nosotros.valores)){
        val.innerHTML = data.nosotros.valores.map(v=>`<li><strong>${esc(v.titulo)}:</strong> ${esc(v.descripcion)}</li>`).join('');
      }
      if(test && data.nosotros.testimonio) test.textContent = '"' + data.nosotros.testimonio + '"';
      if(aut && data.nosotros.testimonioAutor) aut.textContent = '— ' + data.nosotros.testimonioAutor;
    }
    if(data.contacto){
      const ct = document.getElementById('contacto-titulo');
      const cd = document.getElementById('contacto-desc');
      const cta = document.getElementById('contacto-cta');
      const cm = document.getElementById('contacto-meta');
      const chat = document.getElementById('cta-chat');
      if(ct && data.contacto.titulo) ct.textContent = data.contacto.titulo;
      if(cd && data.contacto.descripcion) cd.innerHTML = rich(data.contacto.descripcion);
      if(cta){ if(data.contacto.ctaTexto) cta.textContent = data.contacto.ctaTexto; if(waUrl) cta.href = waUrl; else if(data.contacto.ctaLink) cta.href = data.contacto.ctaLink; }
      if(cm && data.contacto.meta) cm.textContent = data.contacto.meta;
      if(chat && Array.isArray(data.contacto.chat)){
        chat.innerHTML = data.contacto.chat.map(m=>{
          const cls = m.tipo==='me' ? 'chat-bubble me' : 'chat-bubble';
          return `<div class="${cls}">${esc(m.texto)}</div>`;
        }).join('');
      }
    }
    if(data.footer){
      const fd = document.getElementById('footer-desc');
      const fs = document.getElementById('footer-servicios');
      const fh = document.getElementById('footer-horario');
      const fc = document.getElementById('footer-copy');
      if(fd && data.footer.descripcion) fd.innerHTML = rich(data.footer.descripcion);
      if(fs && data.footer.serviciosTexto) fs.textContent = data.footer.serviciosTexto;
      if(fh && data.footer.horario) fh.innerHTML = rich(data.footer.horario);
      if(fc && data.footer.copy) fc.textContent = data.footer.copy;
    }
  }

  const esc = v => String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function slugify(t){ return 'sec-' + (String(t||'seccion').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'seccion'); }

  function renderSecciones(data){
    document.querySelectorAll('[data-custom-sec]').forEach(e=>e.remove());
    const lista = (data.secciones||[]).filter(s=>s && s.activo!==false);
    if(!lista.length) return;
    const nav = document.getElementById('navMenu');
    const wa = document.getElementById('header-whatsapp');
    const usados = {};
    lista.forEach((s,idx)=>{
      let id = s.slug || slugify(s.menu || s.titulo);
      if(usados[id]) id += '-' + (idx+1); usados[id] = 1;
      const sec = document.createElement('section');
      sec.id = id; sec.setAttribute('data-custom-sec','1');
      sec.className = 'section' + (idx%2===0 ? ' alt' : '');
      const cards = (s.items||[]).map((it,i)=>`<div class="svc reveal is-visible" style="transition-delay:${i*0.05}s"><i>${esc(it.icono||'✨')}</i><h3>${esc(it.titulo)}</h3><p>${esc(it.descripcion)}</p></div>`).join('');
      const img = s.imagen ? `<img src="${esc(s.imagen)}" alt="${esc(s.titulo)}" loading="lazy" style="width:100%;max-height:420px;object-fit:cover;border-radius:20px;margin-top:24px;display:block">` : '';
      const btn = (s.ctaTexto && s.ctaLink) ? `<a class="btn btn-teal btn-lg" style="margin-top:24px;display:inline-block" href="${esc(s.ctaLink)}" target="_blank" rel="noopener">${esc(s.ctaTexto)}</a>` : '';
      sec.innerHTML = `<div class="container"><div class="section-head">${s.eyebrow?`<span class="eyebrow">${esc(s.eyebrow)}</span>`:''}<h2>${esc(s.titulo)}</h2>${s.texto?`<p style="margin-top:12px;opacity:.75">${rich(s.texto)}</p>`:''}${img}${btn}</div>${cards?`<div class="services-grid">${cards}</div>`:''}</div>`;
      const after = {inicio:'.trust-bar', servicios:'#servicios', nosotros:'#nosotros'}[s.despues];
      const ref = after ? document.querySelector(after) : null;
      if(ref) ref.insertAdjacentElement('afterend', sec);
      else { const c = document.getElementById('contacto'); if(c) c.parentNode.insertBefore(sec, c); }
      if(nav && s.enMenu !== false){
        const a = document.createElement('a');
        a.href = '#'+id; a.textContent = s.menu || s.titulo; a.setAttribute('data-custom-sec','1');
        a.addEventListener('click', function(e){
          e.preventDefault();
          const ov = document.getElementById('navOverlay'); if(ov && ov.classList.contains('open')) ov.click();
          window.scrollTo({top:sec.offsetTop-80,behavior:'smooth'});
        });
        if(wa) nav.insertBefore(a, wa); else nav.appendChild(a);
      }
    });
  }

  function initFondo(data){
    const bg = document.getElementById('bg-watermark');
    if(!bg) return;
    const cfg = data.config && data.config.fondoTransparente;
    if(!cfg || cfg.activo===false){ bg.style.display='none'; return; }
    const op = cfg.opacidad!=null ? cfg.opacidad : 0.07;
    document.documentElement.style.setProperty('--bg-opacity', op);
    let imgUrl = '';
    if(cfg.imagen && cfg.imagen.startsWith('data:image')) imgUrl = cfg.imagen;
    else imgUrl = LOGO;
    bg.style.backgroundImage = `url("${imgUrl}")`;
    bg.style.display = 'block';
  }

  function initCarrusel(data){
    const track = document.getElementById('carousel-track');
    const dotsC = document.getElementById('carousel-dots');
    const prev = document.getElementById('carousel-prev');
    const next = document.getElementById('carousel-next');
    if(!track) return;
    const lista = (data.carrusel || []).filter(c=>c.activo!==false);
    slides = lista.length ? lista : [{id:'ph', titulo:((data.sitio&&data.sitio.nombre)||''), descripcion:'', imagen:'', activo:true}];
    
    track.innerHTML = slides.map(s=>{
      const hasImg = !!s.imagen; const cls = s.imagen && /(^|\/)logo\.png/.test(s.imagen) ? ' class="is-logo"' : '';
      if(hasImg){
        return `<div class="carousel-slide"><img${cls} src="${logoSrc(s.imagen)}" alt="${esc(s.titulo)}" loading="lazy"><div class="caption"><strong>${esc(s.titulo)}</strong><span>${esc(s.descripcion)}</span></div></div>`;
      } else {
        return `<div class="carousel-slide"><div class="placeholder"><img src="${LOGO}" alt=""><div><strong>${esc(s.titulo||'Agrega tu foto')}</strong><p style="font-size:13px;opacity:.6;margin-top:6px">${esc(s.descripcion||'')}</p></div></div></div>`;
      }
    }).join('');

    if(dotsC){
      dotsC.innerHTML = slides.map((_,i)=>`<button class="carousel-dot ${i===0?'active':''}" data-i="${i}" aria-label="Foto ${i+1}"></button>`).join('');
      dotsC.querySelectorAll('.carousel-dot').forEach(dot=>{
        dot.addEventListener('click', ()=>{ goTo(parseInt(dot.dataset.i)); resetTimer(); });
      });
    }

    function goTo(i){
      carouselIndex = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${carouselIndex*100}%)`;
      if(dotsC){
        dotsC.querySelectorAll('.carousel-dot').forEach((d,idx)=> d.classList.toggle('active', idx===carouselIndex));
      }
    }
    function nextSlide(){ goTo(carouselIndex+1); }
    function prevSlide(){ goTo(carouselIndex-1); }
    function resetTimer(){
      if(carouselTimer) clearInterval(carouselTimer);
      carouselTimer = setInterval(nextSlide, 5000);
    }

    if(prev) prev.onclick = ()=>{ prevSlide(); resetTimer(); };
    if(next) next.onclick = ()=>{ nextSlide(); resetTimer(); };

    // swipe mobile
    let startX = 0;
    track.addEventListener('touchstart', e=>{ startX = e.touches[0].clientX; }, {passive:true});
    track.addEventListener('touchend', e=>{
      const diff = e.changedTouches[0].clientX - startX;
      if(Math.abs(diff)>50){ if(diff<0) nextSlide(); else prevSlide(); resetTimer(); }
    });

    goTo(0);
    resetTimer();
    window.__carouselGoTo = goTo;
  }

  document.addEventListener('DOMContentLoaded', loadDataJson);
})();
