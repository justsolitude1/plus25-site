// Shared by every page: nav, package cards rising in, order buttons whose checkout isn't live yet, and the
// reviews carousel. Loaded as a module after the GSAP scripts.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// draft notes ("placeholder prices", "sample figures") are for the team: shown locally or with ?drafts, hidden from visitors
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || new URLSearchParams(location.search).has('drafts')) {
  document.documentElement.classList.add('drafts');
}

/* ---------- preloader: hide it once the page, and the home page's opening scene, are ready ---------- */
// Stays at least MIN_MS (a 3-second intro), never longer than MAX_MS so a slow 3D download can't hold
// the page hostage (the CSS has its own failsafe too, in case this script never runs).
{
  const pl = document.getElementById('preloader');
  // the intro plays when the site is opened or refreshed, not on the way between its pages (flag set in each page's head)
  if (pl && document.documentElement.classList.contains('seen-intro')) pl.remove();
  else if (pl) {
    const MIN_MS = 3000, MAX_MS = 6000, start = performance.now();   // a deliberate 3s intro; never more than 6s
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(() => {
        pl.classList.add('is-complete');              // the arc closes the circle…
        setTimeout(() => {
          pl.classList.add('is-done');                // …then the loader fades
          pl.setAttribute('aria-hidden', 'true');
          setTimeout(() => pl.remove(), 700);         // after the fade
        }, 420);
      }, Math.max(0, MIN_MS - 420 - (performance.now() - start)));
    };
    const pageLoaded = new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
    // the home page waits for the story scene too (it marks itself is-3d, or no-webgl if it falls back to video)
    const story = document.getElementById('invoke');
    const sceneReady = !story ? Promise.resolve() : new Promise((r) => {
      const ready = () => story.classList.contains('is-3d') || story.classList.contains('no-webgl') || story.classList.contains('is-lite');
      if (ready()) return r();
      new MutationObserver((_, mo) => { if (ready()) { mo.disconnect(); r(); } }).observe(story, { attributes: true, attributeFilter: ['class'] });
    });
    Promise.all([pageLoaded, sceneReady]).then(finish);
    setTimeout(finish, MAX_MS);
  }
}

/* ---------- nav ---------- */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const menuBtn = document.getElementById('menuBtn');
menuBtn.addEventListener('click', () => {
  const open = !nav.classList.contains('open');
  nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('#links a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }));

/* ---------- package cards rise in, one after another ---------- */
if (window.gsap && window.ScrollTrigger && document.querySelector('.tier-grid')) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    gsap.utils.toArray('.tier-grid').forEach((grid) => {
      gsap.from(grid.querySelectorAll('.tier'), { autoAlpha: 0, y: 48, duration: 0.9, ease: 'power3.out', stagger: 0.12, clearProps: 'transform,opacity,visibility',
        scrollTrigger: { trigger: grid, start: 'top 80%', once: true } });
    });
  });
}

/* ---------- service pages: sections settle in as they arrive ---------- */
// Singles fade up on their own; the items of a grid follow one another. Anything already above the screen (a reload
// part-way down, or a jump to #order) is shown at once, so scrolling back up never finds an empty section.
if (!reduced && document.querySelector('main.svc')) {
  const q = (sel) => [...document.querySelectorAll(sel)];
  const items = [
    ...q('.svc .section:not(.pain):not(.reviews):not(.tiers) .sec-head, .svc .order-layout, .svc .calc-form, .svc .about-copy, .svc .included, .svc .faq-side')
      .map((el) => [el, 0]),
    ...['.svc .how-grid > li', '.svc .promise-grid > li', '.svc .faq-list > details', '.svc .more-grid > a', '.svc .pain .wrap > *']
      .flatMap((sel) => q(sel).map((el, i) => [el, i])),
  ];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting && e.boundingClientRect.top > 0) continue;
      if (!e.isIntersecting) e.target.classList.add('rv-now');   // passed while off screen: no animation
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const [el, i] of items) {
    el.classList.add('rv');
    if (i) el.style.setProperty('--i', Math.min(i, 6));
    io.observe(el);
  }
}
// the closing call strikes through its pain points once it is on screen
{
  const pain = document.querySelector('.svc .pain');
  if (pain) new IntersectionObserver(([e], io) => {
    if (e.isIntersecting || e.boundingClientRect.top < 0) { pain.classList.add('in'); io.disconnect(); }
  }, { threshold: 0.35 }).observe(pain);
}

// guarantee cards: a soft light follows the cursor across the card (mouse only)
document.querySelectorAll('.svc .promise').forEach((card) => card.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

/* ---------- phones: packages swipe sideways; open on the featured card, with dots to show where you are ---------- */
{
  const phone = matchMedia('(max-width: 760px)');
  document.querySelectorAll('.svc .tier-grid').forEach((grid) => {
    const cards = [...grid.querySelectorAll('.tier')];
    if (cards.length < 2) return;
    const dots = document.createElement('ol');
    dots.className = 'tier-dots';
    dots.setAttribute('aria-label', 'Packages');
    const buttons = cards.map((card, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Show package ${i + 1} of ${cards.length}`);
      b.addEventListener('click', () => card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'center' }));
      li.append(b); dots.append(li);
      return b;
    });
    grid.after(dots);
    const centreOn = (card) => { grid.scrollLeft = card.offsetLeft - (grid.clientWidth - card.offsetWidth) / 2; };
    const mark = () => {
      const mid = grid.getBoundingClientRect().left + grid.clientWidth / 2;
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => { const r = c.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bestD) { bestD = d; best = i; } });
      buttons.forEach((b, i) => b.setAttribute('aria-current', String(i === best)));
    };
    let raf = 0;
    grid.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(mark); }, { passive: true });
    const setup = () => { if (phone.matches) centreOn(grid.querySelector('.tier.featured') || cards[0]); mark(); };
    setup();
    phone.addEventListener('change', setup);
  });
}

/* ---------- order buttons: reveal the "checkout isn't live yet" note they point at ---------- */
document.querySelectorAll('[data-order]').forEach((btn) => btn.addEventListener('click', () => {
  const note = document.getElementById(btn.dataset.order);
  if (note) note.hidden = false;
}));

/* ---------- reviews: a row that drifts on its own, and can be grabbed and thrown ---------- */
// The cards are duplicated once so the row loops without a visible jump. It drifts slowly so the section never reads
// as static, and stops while the visitor hovers, drags or tabs through it, when it is off screen, when the tab is in
// the background, and under reduced motion (dragging and the arrows still work then).
if (document.getElementById('revTrack')) {
  const DRIFT = 24;            // px per second the row travels on its own
  const FLICK = 2600;          // px per second an arrow press adds (carries about one card)
  const track = document.getElementById('revTrack');
  const section = track.closest('section');
  const prev = document.getElementById('revPrev'), next = document.getElementById('revNext');

  [...track.children].forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');       // a copy for the loop, not a second review
    track.append(clone);
  });
  const loopWidth = () => track.scrollWidth / 2;     // one full set of cards

  const finePointer = matchMedia('(pointer: fine)').matches;
  let pos = 0, vel = 0, dragging = false, hovered = false, focused = false, visible = false, last = 0, selfScroll = -1;
  const lite = document.documentElement.classList.contains('lite');
  const drifting = () => !reduced && !lite && visible && !hovered && !focused && !dragging && document.visibilityState === 'visible';
  const wrap = (x) => { const w = loopWidth(); return w > 0 ? ((x % w) + w) % w : x; };

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000) || 0;
    last = now;
    if (dragging) return;                            // the pointer owns the row
    if (!visible && !vel) return;                    // off screen and at rest: nothing to move or light
    pos = wrap(pos + ((drifting() ? DRIFT : 0) + vel) * dt);
    vel *= Math.pow(0.0015, dt);                     // a throw or arrow press fades out
    if (Math.abs(vel) < 2) vel = 0;
    track.scrollLeft = pos;
    selfScroll = track.scrollLeft;
    if (finePointer && ++frames % 3 === 0) lightCentre();   // phones skip the centre highlight: it repaints every card's glow
  }

  // whichever card is passing the middle of the row lights up: brighter frame, a lift, a stronger glow
  const cards = [...track.children];
  let frames = 0;
  function lightCentre() {
    const mid = track.getBoundingClientRect().left + track.clientWidth / 2;
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      if (r.right < -200 || r.left > innerWidth + 200) continue;        // off screen, leave it alone
      const d = Math.abs(r.left + r.width / 2 - mid) / (track.clientWidth / 2);
      card.style.setProperty('--focus', Math.max(0, 1 - d * 1.6).toFixed(2));
    }
  }
  requestAnimationFrame(frame);

  prev.addEventListener('click', () => { vel = -FLICK; });
  next.addEventListener('click', () => { vel = FLICK; });
  section.addEventListener('pointerenter', () => { hovered = true; });
  section.addEventListener('pointerleave', () => { hovered = false; });
  section.addEventListener('focusin', () => { focused = true; });
  section.addEventListener('focusout', (e) => { if (!section.contains(e.relatedTarget)) focused = false; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.2 }).observe(track);

  /* ---------- grab and throw ---------- */
  // Mouse drives the row directly; touch keeps the browser's own panning, which we follow instead of fighting.
  let startX = 0, startPos = 0, moved = 0, vx = 0, lastX = 0, lastT = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true; moved = 0; vx = 0; vel = 0;
    startX = lastX = e.clientX; startPos = pos; lastT = performance.now();
    track.classList.add('is-dragging');
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    pos = wrap(startPos - dx);
    track.scrollLeft = pos;
    const now = performance.now(), dt = now - lastT;
    if (dt > 0) { vx = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = now; }
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
    if (track.hasPointerCapture?.(e.pointerId)) track.releasePointerCapture(e.pointerId);
    vel = reduced ? 0 : Math.max(-4000, Math.min(4000, -vx * 1000));   // carry the throw
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  // a drag that ends on a link shouldn't follow it
  track.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  // touch pans natively: follow that, but ignore the scrolling this loop causes itself (reading it back would
  // round away the fraction of a pixel the row moves each frame, and the drift would stall)
  track.addEventListener('scroll', () => {
    if (!dragging && Math.abs(track.scrollLeft - selfScroll) > 2) pos = track.scrollLeft;
  }, { passive: true });
}

/* ---------- service page header: the page's orb ---------- */
// Desktops draw the real 3D orb, loaded when the header is on screen. Phones and tablets ("lite") get a still render of
// the same orb that floats in CSS, and the 3D library is never downloaded there.
{
  const host = document.querySelector('.hero-orb3d');
  if (host && document.documentElement.classList.contains('lite')) {
    host.insertAdjacentHTML('beforeend', `<img class="orb-still" src="media/lite/orb-${host.dataset.orb}.webp" alt="" width="880" height="880" decoding="async" fetchpriority="high">`);
    host.classList.add('is-still');
  } else if (host) {
    const canvas = host.querySelector('canvas');
    let orb = null, loading = false;
    canvas.addEventListener('orbready', () => host.classList.add('is-3d'), { once: true });
    // no WebGL: the CSS orb takes the glow's place (only on failure, so it never swaps for the 3D orb)
    const fallback = () => host.classList.add('no-3d');
    new IntersectionObserver(async ([e]) => {
      if (e.isIntersecting && !orb && !loading) {
        loading = true;
        try {
          const { initHeroOrb } = await import('./heroorb.js');
          const debug = new URLSearchParams(location.search).has('debug');
          orb = await initHeroOrb({ canvas, key: host.dataset.orb, reduced, mobile: matchMedia('(pointer: coarse)').matches, debug });
          if (debug) window.__heroOrb = orb;
        } catch (err) { console.error(err); fallback(); }
      }
      orb?.setActive(e.isIntersecting);
    }, { rootMargin: '150px 0px' }).observe(host);
  }
}

/* ---------- nav: "Login" becomes "Account" once the customer is signed in (no library load needed) ---------- */
import('./supabase.js').then(({ isConfigured, hasStoredSession }) => {
  if (!isConfigured || !hasStoredSession()) return;
  document.querySelectorAll('[data-auth-link]').forEach((a) => { a.textContent = 'Account'; a.href = 'account.html'; });
});

/* ---------- reviews backdrop: the three orbs drifting behind the section ---------- */
// Scenery, so it only loads on roomy screens with a mouse (phones already run a 3D scene on these pages), and it
// only draws while the section is on screen. If WebGL fails, the CSS glows behind it stay.
{
  const host = document.querySelector('.rev-backdrop');
  const roomy = matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  if (host && roomy) {
    const canvas = host.querySelector('canvas');
    let scene = null, loading = false;
    canvas.addEventListener('backdropready', () => host.classList.add('is-3d'), { once: true });
    new IntersectionObserver(async ([e]) => {
      if (e.isIntersecting && !scene && !loading) {
        loading = true;
        try {
          const { initBackdrop } = await import('./backdrop.js');
          scene = await initBackdrop({ canvas, reduced, mobile: false });
        } catch (err) { console.error(err); }
      }
      scene?.setActive(e.isIntersecting);
    }, { rootMargin: '100px 0px' }).observe(host);
  }
}
