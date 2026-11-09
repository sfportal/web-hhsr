(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const isMobile = matchMedia('(max-width: 760px)').matches;

  /* ---------- number formatting (vi-VN) ---------- */
  const fmt = (v, el) => {
    const dec = +el.dataset.dec || 0;
    return v.toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const setFinal = el => { el.textContent = fmt(parseFloat(el.dataset.count), el); };

  /* ---------- split headings into words ---------- */
  $$('.split').forEach(h => {
    h.innerHTML = h.textContent.trim().split(/\s+/).map(w => `<span class="w"><span>${w}</span></span>`).join(' ');
  });

  /* ---------- nav ---------- */
  const nav = $('#nav');
  $('#burger').addEventListener('click', () => nav.classList.toggle('open'));
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  const onScroll = () => {
    nav.classList.toggle('scrolled', scrollY > 60);
    const h = document.documentElement.scrollHeight - innerHeight;
    $('#progress').style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox'), lbImg = $('img', lb);
  $$('.m-item, .letter').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); lbImg.src = a.getAttribute('href'); lbImg.alt = $('img', a).alt;
    lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
  }));
  const closeLb = () => { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); };
  lb.addEventListener('click', e => { if (e.target !== lbImg) closeLb(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });

  /* ---------- custom cursor + magnetic ---------- */
  const cursor = $('#cursor');
  if (matchMedia('(hover:hover)').matches && !reduce) {
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function loop() { cx += (tx - cx) * .2; cy += (ty - cy) * .2; cursor.style.left = cx + 'px'; cursor.style.top = cy + 'px'; requestAnimationFrame(loop); })();
    $$('a, button, .tilt').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('big'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('big'));
    });
    $$('.magnetic').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .3}px, ${(e.clientY - r.top - r.height / 2) * .4}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
    /* 3D tilt + spotlight cards */
    $$('.tilt').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.transform = `rotateY(${(x - .5) * 14}deg) rotateX(${(.5 - y) * 14}deg)`;
        el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- golden particles (durian pollen) in hero ---------- */
  const cv = $('#particles');
  if (cv && !reduce) {
    const ctx = cv.getContext('2d'); let W, H, parts = [], mx = -999, my = -999;
    const resize = () => { const d = Math.min(devicePixelRatio, 2); W = cv.width = cv.offsetWidth * d; H = cv.height = cv.offsetHeight * d; };
    resize(); addEventListener('resize', resize);
    const N = isMobile ? 40 : 90;
    for (let i = 0; i < N; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.4 + .6, vx: (Math.random() - .5) * .3, vy: -Math.random() * .6 - .15, a: Math.random() * .6 + .2, t: Math.random() * 6 });
    cv.parentElement.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(), d = W / r.width; mx = (e.clientX - r.left) * d; my = (e.clientY - r.top) * d; });
    let visible = true;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(cv);
    (function draw() {
      if (visible) {
        ctx.clearRect(0, 0, W, H);
        for (const p of parts) {
          p.t += .02; p.x += p.vx + Math.sin(p.t) * .25; p.y += p.vy;
          const dx = p.x - mx, dy = p.y - my, dist = Math.hypot(dx, dy);
          if (dist < 140) { p.x += dx / dist * 2; p.y += dy / dist * 2; }
          if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
          if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, `rgba(255,217,90,${p.a})`); g.addColorStop(1, 'rgba(255,217,90,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
        }
      }
      requestAnimationFrame(draw);
    })();
  }

  /* ---------- No GSAP fallback ---------- */
  const loader = $('#loader');
  if (!hasGsap || reduce) {
    document.documentElement.classList.add('no-gsap');
    $$('[data-count]').forEach(setFinal);
    loader && loader.remove();
    return;
  }

  /* ================= GSAP ================= */
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('gsap-on');

  /* smooth scroll */
  let lenis;
  if (window.Lenis && !isMobile) {
    lenis = new Lenis({ lerp: .09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href'); if (id.length < 2) return;
      const t = $(id); if (!t) return; e.preventDefault(); lenis.scrollTo(t, { offset: -60 });
    }));
  }

  /* hide things before intro */
  gsap.set('.hero__title .word', { yPercent: 110 });
  gsap.set(['.hero__eyebrow', '.hero__lead', '.hero__actions', '.hero__badge', '.nav'], { autoAlpha: 0, y: 30 });

  /* loader */
  const intro = () => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.hero__title .word', { yPercent: 0, duration: 1.4, stagger: .08 })
      .to(['.nav', '.hero__eyebrow'], { autoAlpha: 1, y: 0, duration: 1 }, '-=1.1')
      .to(['.hero__lead', '.hero__actions'], { autoAlpha: 1, y: 0, duration: 1, stagger: .12 }, '-=.9')
      .fromTo('.hero__badge', { autoAlpha: 0, scale: .4, rotate: -90, y: 0 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 1.4, ease: 'back.out(1.6)' }, '-=.9')
      .fromTo('.hero__video', { scale: 1.3 }, { scale: 1.08, duration: 2.4, ease: 'power2.out' }, 0);
  };
  const counter = { v: 0 }, num = $('#loaderNum'), ring = $('.loader__ring circle');
  let loaded = document.readyState === 'complete';
  addEventListener('load', () => { loaded = true; });
  gsap.to(counter, {
    v: 100, duration: 1.8, ease: 'power2.inOut',
    onUpdate() { num.textContent = Math.round(counter.v); ring.style.strokeDashoffset = 352 - 352 * counter.v / 100; },
    onComplete() {
      gsap.timeline()
        .to('.loader > *', { y: -30, autoAlpha: 0, stagger: .06, duration: .5, ease: 'power2.in' })
        .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: .9, ease: 'expo.inOut' }, '-=.1')
        .add(() => { loader.remove(); intro(); ScrollTrigger.refresh(); }, '-=.45');
    }
  });

  /* hero parallax on scroll */
  gsap.to('.hero__content', { yPercent: 30, autoAlpha: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__video', { yPercent: 15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* marquee speed with scroll */
  gsap.to('.marquee', { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* generic reveals */
  $$('.split').forEach(h => {
    gsap.from($$('.w>span', h), { yPercent: 115, rotate: 4, duration: 1.1, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: h, start: 'top 85%' } });
  });
  $$('.reveal').forEach(el => {
    gsap.from(el, { y: 40, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  $$('.reveal-img').forEach(el => {
    gsap.from(el, { clipPath: 'inset(20% 20% 20% 20% round 30px)', scale: .9, autoAlpha: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 80%' } });
  });

  /* about logo spin-in */
  gsap.from('.about__logo', { rotate: -180, scale: .5, duration: 1.6, ease: 'back.out(1.4)', scrollTrigger: { trigger: '.about', start: 'top 70%' } });

  /* service cards */
  gsap.from('.card', { y: 90, autoAlpha: 0, rotateX: -25, duration: 1.1, stagger: .15, ease: 'power3.out', scrollTrigger: { trigger: '.services__grid', start: 'top 82%' } });
  $$('.card .draw').forEach(p => {
    const len = p.getTotalLength ? p.getTotalLength() : 100;
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: p, start: 'top 85%' } });
  });

  /* counters */
  $$('[data-count]').forEach(el => {
    if (el.closest('.guinness__title')) return;
    const end = parseFloat(el.dataset.count), o = { v: 0 };
    el.textContent = fmt(0, el);
    gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => { el.textContent = fmt(o.v, el); }, onComplete: () => setFinal(el) });
  });
  gsap.from('.stat', { y: 60, autoAlpha: 0, stagger: .1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.stats__grid', start: 'top 85%' } });
  gsap.to('.stats__bg', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.stats', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* guinness horizontal scroll */
  const big = $('.guinness__title .big');
  if (!isMobile) {
    const pin = $('.guinness__pin');
    const dist = () => pin.scrollWidth - innerWidth;
    const hs = gsap.to(pin, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.guinness', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 } });
    $$('.gcard').forEach(c => {
      gsap.fromTo($('img', c), { xPercent: -8 }, { xPercent: 8, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: hs, start: 'left right', end: 'right left', scrub: true } });
      gsap.from(c, { rotate: 4, y: 60, scale: .9, ease: 'power2.out', scrollTrigger: { trigger: c, containerAnimation: hs, start: 'left 95%', end: 'left 55%', scrub: true } });
    });
  }
  const o525 = { v: 0 }; big.textContent = '0';
  gsap.to(o525, { v: 525, duration: 2.4, ease: 'power4.out', scrollTrigger: { trigger: '.guinness', start: 'top 70%' }, onUpdate: () => { big.textContent = Math.round(o525.v); } });


  /* ===== FarmBase ===== */
  gsap.from('.evo__old', { x: -120, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '#evo', start: 'top 80%' } });
  gsap.fromTo('.evo__line', { strokeDasharray: 150, strokeDashoffset: 150 }, { strokeDashoffset: 0, duration: 1, delay: .4, ease: 'power2.inOut', scrollTrigger: { trigger: '#evo', start: 'top 80%' } });
  gsap.from('.evo__head', { autoAlpha: 0, x: -20, duration: .5, delay: 1.2, scrollTrigger: { trigger: '#evo', start: 'top 80%' } });
  gsap.from('.evo__new', { scale: .4, autoAlpha: 0, rotate: -8, duration: 1.3, delay: 1.1, ease: 'back.out(1.8)', scrollTrigger: { trigger: '#evo', start: 'top 80%' } });
  gsap.from('.fstat', { y: 50, autoAlpha: 0, stagger: .1, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '.fb__stats', start: 'top 85%' } });
  gsap.from('.flow__node', { y: 60, autoAlpha: 0, scale: .9, stagger: .18, duration: 1, ease: 'back.out(1.4)', scrollTrigger: { trigger: '#flow', start: 'top 80%' } });
  gsap.fromTo('.mock__browser', { rotateX: 28, y: 80, scale: .9, autoAlpha: 0 }, { rotateX: 0, y: 0, scale: 1, autoAlpha: 1, ease: 'power2.out', scrollTrigger: { trigger: '.mock', start: 'top 90%', end: 'top 35%', scrub: 1 } });
  gsap.from('.chip', { scale: 0, autoAlpha: 0, stagger: .15, duration: .8, ease: 'back.out(2)', scrollTrigger: { trigger: '.mock', start: 'top 55%' } });
  gsap.from('.feat', { y: 50, autoAlpha: 0, stagger: .1, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '.fb__features', start: 'top 85%' } });
  gsap.to('.fb__grid-bg', { yPercent: 20, ease: 'none', scrollTrigger: { trigger: '.fb', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* journey */
  gsap.to('#jFill', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.journey__steps', start: 'top 70%', end: 'bottom 70%', scrub: true } });
  $$('.jstep').forEach(st => {
    gsap.from(st, { x: 80, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: st, start: 'top 85%' } });
    gsap.from($('img', st), { scale: 1.3, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: st, start: 'top 85%' } });
  });

  /* training */
  gsap.from('.tstat', { y: 60, autoAlpha: 0, rotateX: -20, stagger: .1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.train__stats', start: 'top 85%' } });

  /* bento */
  gsap.from('.bento__item', { y: 70, autoAlpha: 0, scale: .94, duration: 1, stagger: { each: .08, from: 'start' }, ease: 'power3.out', scrollTrigger: { trigger: '.bento', start: 'top 82%' } });

  /* timeline */
  gsap.to('#tlFill', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.tl', start: 'top 60%', end: 'bottom 60%', scrub: true } });
  $$('.tl__item').forEach((it, i) => {
    const fromX = isMobile ? 40 : (i % 2 ? 60 : -60);
    gsap.from($('.tl__body', it), { x: fromX, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: it, start: 'top 80%' } });
    gsap.from($('.tl__date', it), { y: 30, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: it, start: 'top 80%' } });
  });

  /* gallery */
  $$('.m-item').forEach((m, i) => {
    gsap.from(m, { y: 80 + (i % 4) * 20, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: m, start: 'top 95%' } });
  });

  /* letters fan out */
  gsap.from('.letter', { y: 200, rotate: 0, autoAlpha: 0, duration: 1.2, stagger: .12, ease: 'back.out(1.3)', scrollTrigger: { trigger: '.letters', start: 'top 85%' }, clearProps: 'transform' });

  /* press cards */
  gsap.from('.pcard', { y: 60, autoAlpha: 0, duration: .9, stagger: .07, ease: 'power3.out', scrollTrigger: { trigger: '.press__grid', start: 'top 85%' } });

  /* footer big text */
  gsap.from('.footer__big', { xPercent: 20, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  addEventListener('load', () => ScrollTrigger.refresh());
})();
