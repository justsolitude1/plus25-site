// Shared by every page: nav, package cards rising in, order buttons whose checkout isn't live yet, and the
// reviews carousel. Loaded as a module after the GSAP scripts.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  let pos = 0, vel = 0, dragging = false, hovered = false, focused = false, visible = false, last = 0, selfScroll = -1;
  const drifting = () => !reduced && visible && !hovered && !focused && !dragging && document.visibilityState === 'visible';
  const wrap = (x) => { const w = loopWidth(); return w > 0 ? ((x % w) + w) % w : x; };

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000) || 0;
    last = now;
    if (dragging) return;                            // the pointer owns the row
    pos = wrap(pos + ((drifting() ? DRIFT : 0) + vel) * dt);
    vel *= Math.pow(0.0015, dt);                     // a throw or arrow press fades out
    if (Math.abs(vel) < 2) vel = 0;
    track.scrollLeft = pos;
    selfScroll = track.scrollLeft;
    if (++frames % 3 === 0) lightCentre();            // cheap enough at 20fps, invisible at this scale
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

/* ---------- service page header: the page's orb in 3D, loaded when the header is on screen ---------- */
{
  const host = document.querySelector('.hero-orb3d');
  if (host) {
    const canvas = host.querySelector('canvas');
    let orb = null, loading = false;
    canvas.addEventListener('orbready', () => host.classList.add('is-3d'), { once: true });
    new IntersectionObserver(async ([e]) => {
      if (e.isIntersecting && !orb && !loading) {
        loading = true;
        try {
          const { initHeroOrb } = await import('./heroorb.js');
          orb = await initHeroOrb({ canvas, key: host.dataset.orb, reduced, mobile: matchMedia('(max-width: 760px)').matches });
        } catch (err) { console.error(err); }   // the CSS orb stays in place
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
