/* Jiří Kolínek — landing page interactions (vanilla, no dependencies) */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let vh = window.innerHeight;
  let vw = window.innerWidth;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* ------------------------------------------------------------------
     Load choreography + intro
     1. orange screen, Jiří's signature draws itself
     2. "JIŘÍ KOLÍNEK" rises in the centre at 60 % of its hero size
     3. it glides and grows into its hero position while the orange
        dissolves into the gradient
     4. on landing, the portrait and the rest of the hero come in
     ------------------------------------------------------------------ */
  const intro = $('.intro');
  const waitFor = imgs => Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); })));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const reveal = () => {
    doc.classList.add('bg-in', 'is-loaded');
  };

  const runIntro = async () => {
    if (!intro || reduce.matches) {
      if (intro) intro.remove();
      doc.classList.remove('intro-active');
      await waitFor($$('.hero img'));
      requestAnimationFrame(reveal);
      return;
    }
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    // signature clone with its own mask id
    const src = $('[data-signature]');
    const sig = src.cloneNode(true);
    sig.removeAttribute('data-signature');
    sig.setAttribute('aria-hidden', 'true');
    sig.querySelector('mask').id = 'introSigMask';
    sig.querySelector('.sig__ink').setAttribute('mask', 'url(#introSigMask)');
    $('.intro__sig', intro).appendChild(sig);
    const pens = $$('.sig__pen path', sig).map(p => { const len = p.getTotalLength(); p.style.strokeDasharray = `${len} ${len}`; p.style.strokeDashoffset = len; return { p, len }; });
    let total = 0; pens.forEach(o => { o.start = total; total += o.len; });

    let skipped = false;
    const skip = () => { skipped = true; };
    intro.addEventListener('click', skip);
    window.addEventListener('keydown', skip, { once: true });

    const tween = (dur, fn, curve = easeInOut) => new Promise(res => {
      const t0 = performance.now();
      const tick = now => {
        const p = skipped ? 1 : clamp((now - t0) / dur);
        fn(curve(p));
        p < 1 ? requestAnimationFrame(tick) : res();
      };
      requestAnimationFrame(tick);
    });

    await Promise.all([waitFor($$('.hero img')), document.fonts ? document.fonts.ready : null]);
    intro.classList.add('is-ready');
    await sleep(skipped ? 0 : 250);

    // 1 — signature
    await tween(1700, p => {
      const drawn = p * total;
      for (const o of pens) o.p.style.strokeDashoffset = o.len * (1 - clamp((drawn - o.start) / o.len));
    });
    if (!skipped) await sleep(250);
    intro.classList.add('is-sig-out');

    // 2 — name rises in the centre at 60 % of its hero size
    const name = $('.intro__name', intro);
    const target = $('.hero__headline:not(.hero__headline--ghost)').getBoundingClientRect();
    Object.assign(name.style, { left: target.left + 'px', top: target.top + 'px', width: target.width + 'px' });
    const dx = window.innerWidth / 2 - (target.left + target.width / 2);
    const dy = window.innerHeight / 2 - (target.top + target.height / 2);
    const S = 0.6;
    name.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${S})`;
    if (!skipped) await sleep(300);
    intro.classList.add('is-name-in');
    if (!skipped) await sleep(1050);

    // 3 — glide into place while the orange dissolves into the gradient
    doc.classList.add('bg-in');
    intro.classList.add('is-bg-out');
    await tween(1350, p => {
      const s = S + (1 - S) * p;
      name.style.transform = `translate3d(${dx * (1 - p)}px, ${dy * (1 - p)}px, 0) scale(${s})`;
    }, t => t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

    // 4 — hand over to the real headline, bring in the rest of the hero
    doc.classList.add('intro-done');
    requestAnimationFrame(() => {
      reveal();
      doc.classList.remove('intro-active');
      requestAnimationFrame(() => intro.remove());
    });
    window.removeEventListener('keydown', skip);
  };
  runIntro().catch(() => { if (intro) intro.remove(); doc.classList.remove('intro-active'); reveal(); });
  setTimeout(() => { if (!doc.classList.contains('is-loaded')) { if (intro) intro.remove(); doc.classList.remove('intro-active'); reveal(); } }, 9000); // safety net

  /* ------------------------------------------------------------------
     Split statement / quote text into words (keeps inline markup)
     ------------------------------------------------------------------ */
  const words = [];
  $$('[data-words]').forEach(el => {
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = p;
            frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.hasAttribute('aria-hidden')) {
          walk(child);
        }
      });
    };
    walk(el);
    words.push({ el, list: $$('.w', el) });
  });

  /* ------------------------------------------------------------------
     Reveal on enter
     ------------------------------------------------------------------ */
  // clipped elements ([data-mask]) are observed through their parent,
  // because a fully clipped box never reports as intersecting
  const ioMap = new Map();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        (ioMap.get(e.target) || [e.target]).forEach(t => t.classList.add('is-in'));
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
  $$('[data-reveal], [data-rule], [data-inview]').forEach(el => io.observe(el));
  $$('[data-mask]').forEach(el => {
    const host = el.parentElement;
    ioMap.set(host, [...(ioMap.get(host) || []), el]);
    io.observe(host);
  });

  /* ------------------------------------------------------------------
     Header: solid after hero, hide on fast scroll down
     ------------------------------------------------------------------ */
  const header = $('#header');
  const hero = $('.hero');
  let lastY = window.scrollY;

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  const toggle = $('.menu-toggle');
  const menu = $('#menu');
  const setMenu = open => {
    doc.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    $('.menu-toggle__label', toggle).textContent = open ? 'Zavřít' : 'Menu';
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) header.classList.remove('is-hidden');
  };
  toggle.addEventListener('click', () => setMenu(!doc.classList.contains('menu-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && doc.classList.contains('menu-open')) { setMenu(false); toggle.focus(); } });

  /* ------------------------------------------------------------------
     Active nav link
     ------------------------------------------------------------------ */
  const navLinks = $$('.nav a');
  const sections = navLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const navIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + e.target.id)));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => navIO.observe(s));

  /* ------------------------------------------------------------------
     Story: sticky year follows the active chapter
     ------------------------------------------------------------------ */
  const yearTrack = $('.story__year-track');
  const chapters = $$('[data-chapter]');
  const chIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const i = +e.target.dataset.chapter;
      chapters.forEach(c => c.classList.toggle('is-active', c === e.target));
      if (yearTrack) yearTrack.style.transform = `translateY(${-i * 0.8}em)`;
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  chapters.forEach(c => chIO.observe(c));

  /* ------------------------------------------------------------------
     Counters
     ------------------------------------------------------------------ */
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      const el = e.target;
      const to = +el.dataset.count;
      if (reduce.matches) { el.textContent = to; return; }
      const t0 = performance.now();
      const dur = 1600;
      const tick = now => {
        const p = clamp((now - t0) / dur);
        el.textContent = Math.round(ease(p) * to);
        if (p < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ------------------------------------------------------------------
     Signature: stroke-drawing scrubbed by scroll
     ------------------------------------------------------------------ */
  const sig = $('[data-signature]');
  let pens = [];
  let penTotal = 0;
  if (sig) {
    pens = $$('.sig__pen path', sig).map(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len} ${len}`;
      p.style.strokeDashoffset = len;
      return { p, len, start: 0 };
    });
    pens.forEach(o => { o.start = penTotal; penTotal += o.len; });
  }
  let sigLast = -1;
  const drawSignature = progress => {
    if (!pens.length || Math.abs(progress - sigLast) < 0.0005) return;
    sigLast = progress;
    const drawn = progress * penTotal;
    for (const o of pens) {
      const local = clamp((drawn - o.start) / o.len);
      o.p.style.strokeDashoffset = o.len * (1 - local);
    }
  };

  /* ------------------------------------------------------------------
     Chart tooltip
     ------------------------------------------------------------------ */
  const tip = $('#chart-tip');
  const showTip = (seg, x, y) => {
    tip.innerHTML = `<b>${seg.dataset.val} %</b>${seg.dataset.name}, ${seg.dataset.year}`;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.add('is-on');
  };
  $$('.chart__seg').forEach(seg => {
    seg.addEventListener('pointermove', e => showTip(seg, e.clientX, e.clientY));
    seg.addEventListener('pointerleave', () => tip.classList.remove('is-on'));
    seg.addEventListener('focus', () => { const r = seg.getBoundingClientRect(); showTip(seg, r.left + r.width / 2, r.top); });
    seg.addEventListener('blur', () => tip.classList.remove('is-on'));
  });
  window.addEventListener('scroll', () => tip.classList.remove('is-on'), { passive: true });

  /* ------------------------------------------------------------------
     Chart: percentage labels count up as the bars grow
     ------------------------------------------------------------------ */
  const chart = $('#chart');
  if (chart) {
    const labels = $$('.chart__seg', chart).map(seg => ({ seg, el: seg.querySelector('span'), to: parseFloat(seg.dataset.val.replace(',', '.')) }));
    const chartIO = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      chartIO.disconnect();
      if (reduce.matches) return;
      labels.forEach(l => { l.el.textContent = '0 %'; });
      const t0 = performance.now();
      const tick = now => {
        let running = false;
        labels.forEach(l => {
          const r = +getComputedStyle(l.seg).getPropertyValue('--r') || 0;
          const p = clamp((now - t0 - 150 - r * 140) / 1300);
          if (p < 1) running = true;
          l.el.textContent = Math.round(ease(p) * l.to) + ' %';
        });
        if (running) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { rootMargin: '0px 0px -12% 0px' });
    chartIO.observe(chart);
  }

  /* ------------------------------------------------------------------
     Ecosystem: measure edges for draw-in
     ------------------------------------------------------------------ */
  $$('.eco__svg .edge').forEach(p => p.style.setProperty('--len', Math.ceil(p.getTotalLength())));
  const killSMIL = () => $$('.eco__svg animateMotion').forEach(a => a.closest('rect').remove());
  if (reduce.matches) killSMIL();

  /* ------------------------------------------------------------------
     Scroll-driven frame (parallax, hero, words, signature, steps)
     ------------------------------------------------------------------ */
  const heroBg = $('[data-hero="bg"]');
  const heroHeads = $$('[data-hero="headline"]');
  const heroPortrait = $('[data-hero="portrait"]');
  const parallax = $$('[data-parallax]').map(el => ({ el, k: parseFloat(el.dataset.parallax) || 0 }));
  const steps = $('[data-steps]');
  const stepEls = steps ? $$('.step', steps) : [];
  const stepBar = steps ? $('.steps__progress i', steps) : null;
  const vision = $('.vision');

  const progressOf = (el, startAt = 1, endAt = 0) => {
    // 0 when el top hits startAt*vh, 1 when it hits endAt*vh
    const r = el.getBoundingClientRect();
    return clamp((startAt * vh - r.top) / ((startAt - endAt) * vh));
  };

  let ticking = false;
  const frame = () => {
    ticking = false;
    const y = window.scrollY;
    const motion = !reduce.matches;

    // header state
    const heroH = hero.offsetHeight;
    header.classList.toggle('is-solid', y > heroH - 80);
    if (!doc.classList.contains('menu-open')) {
      header.classList.toggle('is-hidden', y > heroH && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove('is-hidden');
    }
    lastY = y;

    // hero: layered parallax while the sheet slides over it
    if (motion && y < heroH * 1.1) {
      const p = clamp(y / heroH);
      heroBg.style.transform = `translate3d(0, ${p * 12}%, 0) scale(${1 + p * 0.08})`;
      heroHeads.forEach(h => { h.style.transform = `translate3d(0, ${p * -22}vh, 0)`; });
      heroPortrait.style.transform = `translate3d(0, ${p * 5}vh, 0) scale(${1 - p * 0.03})`;
    }

    // generic parallax
    if (motion) {
      for (const { el, k } of parallax) {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const centre = r.top + r.height / 2 - vh / 2;
        el.style.transform = `translate3d(0, ${centre * k}px, 0)`;
      }
    }

    // word-by-word opacity scrub
    for (const { el, list } of words) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const p = motion ? clamp((vh * 0.88 - r.top) / (r.height + vh * 0.38)) : 1;
      const lit = p * list.length * 1.15;
      list.forEach((w, i) => { w.style.setProperty('--o', (0.14 + 0.86 * clamp(lit - i)).toFixed(3)); });
    }

    // signature
    if (sig) {
      if (!motion) drawSignature(1);
      else {
        const r = sig.getBoundingClientRect();
        drawSignature(ease(clamp((vh * 0.92 - r.top) / (vh * 0.55))));
      }
    }

    // steps progress
    if (steps && stepBar) {
      const p = motion ? progressOf(steps, 0.85, 0.35) : 1;
      stepBar.style.setProperty('--p', p.toFixed(3));
      stepEls.forEach((s, i) => s.classList.toggle('is-on', p >= (i / stepEls.length) + 0.02 || (vw <= 1024 && s.getBoundingClientRect().top < vh * 0.75)));
    }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { vh = window.innerHeight; vw = window.innerWidth; onScroll(); });
  reduce.addEventListener?.('change', () => { if (reduce.matches) killSMIL(); onScroll(); });
  frame();

  /* ------------------------------------------------------------------
     Contact form: validates, posts to data-endpoint if set,
     otherwise opens a pre-filled e-mail to info@imperialvision.cz
     ------------------------------------------------------------------ */
  const form = $('#contact-form');
  if (form) {
    const status = $('.form__status', form);
    const msgs = {
      name: 'Prosím vyplňte jméno.',
      phone: 'Prosím zadejte telefon.',
      email: 'Prosím zadejte platný e-mail.'
    };
    const check = input => {
      const err = input.parentElement.querySelector('.field__err');
      let ok = input.checkValidity();
      if (input.name === 'phone') ok = ok && input.value.replace(/\D/g, '').length >= 9;
      input.setAttribute('aria-invalid', String(!ok));
      if (err) err.textContent = ok ? '' : msgs[input.name] || 'Povinné pole.';
      return ok;
    };
    ['name', 'phone', 'email'].forEach(n => form.elements[n].addEventListener('blur', e => check(e.target)));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (form.elements.company.value) return; // honeypot
      const fields = ['name', 'phone', 'email'].map(n => form.elements[n]);
      const okFields = fields.map(check).every(Boolean);
      const consent = form.elements.consent.checked;
      if (!okFields || !consent) {
        status.classList.remove('is-ok');
        status.textContent = !okFields ? 'Zkontrolujte prosím zvýrazněná pole.' : 'Pro odeslání potvrďte souhlas se zpracováním údajů.';
        (fields.find(f => f.getAttribute('aria-invalid') === 'true') || form.elements.consent).focus();
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      delete data.company;
      const endpoint = form.dataset.endpoint;
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      const btnLabel = btn.firstChild.textContent;
      btn.firstChild.textContent = 'Odesílám… ';
      try {
        if (endpoint) {
          const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
          if (!res.ok) throw new Error(res.status);
          status.textContent = 'Děkuji, zpráva dorazila. Ozvu se vám co nejdříve.';
          form.reset();
        } else {
          const body = [
            `Jméno: ${data.name}`, `Telefon: ${data.phone}`, `E-mail: ${data.email}`,
            `Zkušenosti: ${data.experience || '-'}`, '', data.message || ''
          ].join('\n');
          window.location.href = `mailto:info@imperialvision.cz?subject=${encodeURIComponent('Zájem o spolupráci — ' + data.name)}&body=${encodeURIComponent(body)}`;
          status.textContent = 'Děkuji! Otevírám váš e-mail s předvyplněnou zprávou.';
        }
        status.classList.add('is-ok');
      } catch (err) {
        status.classList.remove('is-ok');
        status.textContent = 'Odeslání se nepovedlo. Zavolejte prosím na +420 733 501 622.';
      } finally {
        btn.disabled = false;
        btn.firstChild.textContent = btnLabel;
      }
    });
  }

  /* ------------------------------------------------------------------
     Hero: pointer trail that only touches the gradient.
     A grid of small squares reveals a 180°-rotated copy of the background
     around the pointer; the squares shrink and fade as the trail decays.
     ------------------------------------------------------------------ */
  const trail = $('.hero__trail');
  const heroStage = $('.hero__stage');
  const heroBgImg = $('.hero__bg img');
  if (trail && heroStage && heroBgImg && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const ctx = trail.getContext('2d');
    const alt = document.createElement('canvas');
    const actx = alt.getContext('2d');
    const CELL = 10;          // css px per square
    const RADIUS = 9;         // cells
    let dpr = 1, cols = 0, rows = 0, w = 0, h = 0, field = new Float32Array(0), active = false, raf = 0, ready = false, last = null;

    const build = () => {
      const r = heroStage.getBoundingClientRect();
      w = r.width; h = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      trail.width = Math.round(w * dpr); trail.height = Math.round(h * dpr);
      alt.width = trail.width; alt.height = trail.height;
      cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
      field = new Float32Array(cols * rows);
      // cover-fit the gradient, rotated 180°
      const iw = heroBgImg.naturalWidth, ih = heroBgImg.naturalHeight;
      if (!iw) return;
      const sc = Math.max(alt.width / iw, alt.height / ih);
      const dw = iw * sc, dh = ih * sc;
      actx.setTransform(1, 0, 0, 1, 0, 0);
      actx.clearRect(0, 0, alt.width, alt.height);
      actx.translate(alt.width, alt.height); actx.rotate(Math.PI);
      actx.filter = 'saturate(1.25) contrast(1.35) brightness(1.04)';
      actx.drawImage(heroBgImg, (alt.width - dw) / 2, (alt.height - dh) / 2, dw, dh);
      ready = true;
    };

    const stamp = (x, y, power) => {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      for (let j = -RADIUS; j <= RADIUS; j++) {
        const yy = cy + j; if (yy < 0 || yy >= rows) continue;
        for (let i = -RADIUS; i <= RADIUS; i++) {
          const xx = cx + i; if (xx < 0 || xx >= cols) continue;
          const d = Math.sqrt(i * i + j * j) / RADIUS; if (d > 1) continue;
          const v = power * (1 - d * d);
          const k = yy * cols + xx;
          if (v > field[k]) field[k] = v;
        }
      }
    };

    const draw = () => {
      raf = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, trail.width, trail.height);
      let alive = false;
      const c = CELL * dpr;
      for (let k = 0; k < field.length; k++) {
        let v = field[k];
        if (v < 0.03) { field[k] = 0; continue; }
        alive = true;
        const s = c * 0.82 * Math.min(1, v * 1.15);  // square size follows intensity, keeps a pixel gap
        const x = (k % cols) * c + (c - s) / 2, y = Math.floor(k / cols) * c + (c - s) / 2;
        ctx.globalAlpha = Math.min(1, v * 1.2);
        ctx.drawImage(alt, x, y, s, s, x, y, s, s);
        field[k] = v * 0.962;                       // decay (~1.2 s)
      }
      ctx.globalAlpha = 1;
      if (alive) raf = requestAnimationFrame(draw);
    };

    const onMove = e => {
      if (e.pointerType !== 'mouse' || reduce.matches || !ready) return;
      if (window.scrollY > heroStage.offsetHeight * 0.4) return;
      const r = heroStage.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      // fill the gap between events so fast moves leave a continuous trail
      if (last) {
        const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
        const steps = Math.min(12, Math.floor(dist / (CELL * 2)));
        for (let s = 1; s <= steps; s++) stamp(last.x + dx * s / (steps + 1), last.y + dy * s / (steps + 1), 1);
      }
      stamp(x, y, 1);
      last = { x, y };
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const init = () => { build(); heroStage.addEventListener('pointermove', onMove, { passive: true }); heroStage.addEventListener('pointerleave', () => { last = null; }); };
    if (heroBgImg.complete && heroBgImg.naturalWidth) init(); else heroBgImg.addEventListener('load', init, { once: true });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
  }

  /* ------------------------------------------------------------------
     Stat blocks: slight 3D tilt following the pointer
     ------------------------------------------------------------------ */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.stat').forEach(stat => {
      const card = $('.stat__card', stat);
      stat.addEventListener('pointermove', e => {
        if (reduce.matches) return;
        const r = stat.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        stat.classList.add('is-tilting');
        card.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (y * -10).toFixed(2) + 'deg');
      });
      stat.addEventListener('pointerleave', () => {
        stat.classList.remove('is-tilting');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ------------------------------------------------------------------
     Cursor: small orange square that trails the pointer
     ------------------------------------------------------------------ */
  const cursor = $('.cursor');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (cursor && finePointer.matches) {
    doc.classList.add('has-cursor');
    let tx = -100, ty = -100, cx = -100, cy = -100, raf = 0, shown = false;
    const lightZones = '.hero, .contact, .btn, .header:not(.is-solid), .menu';
    const interactive = 'a, button, [role="button"], .chip, .chart__seg, label[for], input[type="checkbox"]';
    const loop = () => {
      const k = reduce.matches ? 1 : 0.2;   // the slight delay
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.1 ? requestAnimationFrame(loop) : 0;
    };
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!shown) { cx = tx; cy = ty; shown = true; cursor.classList.add('is-on'); }
      const t = e.target instanceof Element ? e.target : null;
      cursor.classList.toggle('is-light', !!(t && t.closest(lightZones)));
      cursor.classList.toggle('is-hover', !!(t && t.closest(interactive)));
      cursor.classList.toggle('is-text', !!(t && t.closest('input:not([type="checkbox"]):not([type="radio"]), textarea')));
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.documentElement.addEventListener('mouseleave', () => { cursor.classList.remove('is-on'); shown = false; });
  }

  const yearEl = $('#footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
