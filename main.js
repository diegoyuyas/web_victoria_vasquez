// main.js?v=20260513 - Victoria Vasquez - IIFE, no modules
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
    setTimeout(function(){ s.classList.add('hide'); setTimeout(function(){ s.remove(); },600); },3800);
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
  document.addEventListener('DOMContentLoaded',function(){
    safe(initTextSplit,'split'); safe(initRevealSafety,'safety'); safe(initObserver,'observer');
    safe(initMagnetic,'magnetic'); safe(initNav,'nav'); safe(initAnchors,'anchors'); safe(initSplash,'splash');
  });
})();


// === NUEVO: Carga dinámica desde data.json para edición con portal admin ===
(function(){
  async function loadDataJson(){
    try{
      const res = await fetch('data.json?v=' + Date.now(), {cache: 'no-store'});
      if(!res.ok) throw new Error('data.json no encontrado');
      const data = await res.json();
      console.log('[Victoria] data.json cargado', data);
      renderFromData(data);
    }catch(e){
      console.warn('[Victoria] No se pudo cargar data.json, se usa contenido por defecto:', e);
      // Si falla, intentamos renderizar al menos servicios por defecto desde el HTML viejo si existiera
      // pero en esta versión los servicios se generan desde data.json, asi que mostramos mensaje
      const grid = document.getElementById('services-grid');
      if(grid && grid.children.length===0){
        // Fallback: si no hay data.json, dejamos vacío y el usuario verá que necesita el archivo
      }
    }
  }

  function renderFromData(data){
    // Hero
    if(data.hero){
      const b = document.getElementById('hero-badge');
      const t = document.getElementById('hero-titulo');
      const d = document.getElementById('hero-desc');
      const c = document.getElementById('hero-cta');
      const n = document.getElementById('hero-nota');
      const hw = document.getElementById('header-whatsapp');
      if(b && data.hero.badge) b.textContent = data.hero.badge;
      if(t && data.hero.titulo){ t.textContent = data.hero.titulo; }
      if(d && data.hero.descripcion) d.innerHTML = data.hero.descripcion;
      if(c){ if(data.hero.ctaTexto) c.textContent = data.hero.ctaTexto; if(data.hero.ctaLink) c.href = data.hero.ctaLink; }
      if(n && data.hero.ctaNota) n.textContent = data.hero.ctaNota;
      if(hw && data.hero.ctaLink) hw.href = data.hero.ctaLink;
    }
    // Trust bar
    if(data.trust && Array.isArray(data.trust)){
      const tg = document.getElementById('trust-grid');
      if(tg){
        tg.innerHTML = data.trust.map(item => `<div><strong>${item.numero||''}</strong> ${item.texto||''}</div>`).join('');
      }
    }
    // Servicios - IGUALITO al diseño original
    if(data.servicios){
      const grid = document.getElementById('services-grid');
      if(grid){
        grid.innerHTML = '';
        data.servicios.filter(s=>s.activo!==false).forEach((s,i)=>{
          const div = document.createElement('div');
          div.className = 'svc reveal is-visible';
          div.style.transitionDelay = (i*0.05)+'s';
          div.innerHTML = `<i>${s.icono||'🐾'}</i><h3>${s.titulo||''}</h3><p>${s.descripcion||''}</p>`;
          grid.appendChild(div);
        });
      }
    }
    // Nosotros
    if(data.nosotros){
      const eye = document.getElementById('nosotros-eyebrow');
      const tit = document.getElementById('nosotros-titulo');
      const desc = document.getElementById('nosotros-desc');
      const val = document.getElementById('nosotros-valores');
      const test = document.getElementById('nosotros-testimonio');
      const aut = document.getElementById('nosotros-autor');
      if(eye && data.nosotros.eyebrow) eye.textContent = data.nosotros.eyebrow;
      if(tit && data.nosotros.titulo) tit.textContent = data.nosotros.titulo;
      if(desc && data.nosotros.descripcion) desc.textContent = data.nosotros.descripcion;
      if(val && Array.isArray(data.nosotros.valores)){
        val.innerHTML = data.nosotros.valores.map(v=>`<li><strong>${v.titulo||''}:</strong> ${v.descripcion||''}</li>`).join('');
      }
      if(test && data.nosotros.testimonio) test.childNodes[0].textContent = '"' + data.nosotros.testimonio + '"';
      if(aut && data.nosotros.testimonioAutor) aut.textContent = '— ' + data.nosotros.testimonioAutor;
    }
    // Contacto
    if(data.contacto){
      const ct = document.getElementById('contacto-titulo');
      const cd = document.getElementById('contacto-desc');
      const cta = document.getElementById('contacto-cta');
      const cm = document.getElementById('contacto-meta');
      const chat = document.getElementById('cta-chat');
      if(ct && data.contacto.titulo) ct.textContent = data.contacto.titulo;
      if(cd && data.contacto.descripcion) cd.innerHTML = data.contacto.descripcion;
      if(cta){ if(data.contacto.ctaTexto) cta.textContent = data.contacto.ctaTexto; if(data.contacto.ctaLink) cta.href = data.contacto.ctaLink; }
      if(cm && data.contacto.meta) cm.textContent = data.contacto.meta;
      if(chat && Array.isArray(data.contacto.chat)){
        chat.innerHTML = data.contacto.chat.map(m=>{
          const cls = m.tipo==='me' ? 'chat-bubble me' : 'chat-bubble';
          return `<div class="${cls}">${m.texto||''}</div>`;
        }).join('');
      }
    }
    // Footer
    if(data.footer){
      const fd = document.getElementById('footer-desc');
      const fs = document.getElementById('footer-servicios');
      const fh = document.getElementById('footer-horario');
      const fc = document.getElementById('footer-copy');
      if(fd && data.footer.descripcion) fd.innerHTML = data.footer.descripcion.replace(/\n/g,'<br>');
      if(fs && data.footer.serviciosTexto) fs.textContent = data.footer.serviciosTexto;
      if(fh && data.footer.horario) fh.innerHTML = data.footer.horario.replace(/\n/g,'<br>');
      if(fc && data.footer.copy) fc.textContent = data.footer.copy;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    loadDataJson();
  });
})();
