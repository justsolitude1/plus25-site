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

/* ---------- reviews carousel: rotates on its own, one card at a time ---------- */
// Pauses while the visitor is hovering, touching or tabbing through it, while it's off-screen or the tab is in
// the background, and entirely under reduced motion. Arrows wrap around and restart the clock.
if (document.getElementById('revTrack')) {
  const ROTATE_MS = 4500;
  const track = document.getElementById('revTrack');
  const section = track.closest('section');
  const prev = document.getElementById('revPrev'), next = document.getElementById('revNext');
  const step = () => { const card = track.querySelector('.rev'); return card ? card.getBoundingClientRect().width + 16 : track.clientWidth; };
  const atStart = () => track.scrollLeft < 4;
  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  const go = (dir) => {
    if (dir > 0 && atEnd()) track.scrollTo({ left: 0 });
    else if (dir < 0 && atStart()) track.scrollTo({ left: track.scrollWidth });
    else track.scrollBy({ left: dir * step() });
  };

  let timer = 0, hovered = false, focused = false, visible = false, dragging = false;
  const schedule = () => {
    clearInterval(timer);
    const run = !reduced && visible && !hovered && !focused && !dragging && document.visibilityState === 'visible';
    timer = run ? setInterval(() => go(1), ROTATE_MS) : 0;
  };
  prev.addEventListener('click', () => { go(-1); schedule(); });
  next.addEventListener('click', () => { go(1); schedule(); });
  section.addEventListener('pointerenter', () => { hovered = true; schedule(); });
  section.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  track.addEventListener('pointerdown', () => { hovered = true; schedule(); });   // touch: the visitor has taken over
  section.addEventListener('focusin', () => { focused = true; schedule(); });
  section.addEventListener('focusout', (e) => { if (!section.contains(e.relatedTarget)) { focused = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }, { threshold: 0.3 }).observe(track);

  /* ---------- grab and throw the row, with a flick of momentum and a snap to the nearest card ---------- */
  // Mouse only: touch already pans the row natively, and a pointer-driven pan would fight it.
  let startX = 0, startLeft = 0, moved = 0, vx = 0, lastX = 0, lastT = 0, glideRaf = 0, glideTimer = 0;
  const snapTo = (left) => {
    const max = track.scrollWidth - track.clientWidth;
    track.scrollTo({ left: Math.max(0, Math.min(max, Math.round(left / step()) * step())), behavior: reduced ? 'auto' : 'smooth' });
  };
  const finishGlide = () => {
    cancelAnimationFrame(glideRaf);
    clearTimeout(glideTimer);
    track.style.scrollSnapType = '';       // snapping is safe again once the throw has settled
    snapTo(track.scrollLeft);
  };
  const glide = () => {
    let v = vx * 16;                       // px per frame, from the last pointer speed
    clearTimeout(glideTimer);
    glideTimer = setTimeout(finishGlide, 1200);   // frames are throttled in background tabs; settle anyway
    const decay = () => {
      v *= 0.94;
      track.scrollLeft -= v;
      if (Math.abs(v) > 0.6) glideRaf = requestAnimationFrame(decay);
      else finishGlide();
    };
    if (Math.abs(v) > 1 && !reduced) glideRaf = requestAnimationFrame(decay);
    else finishGlide();
  };
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true; moved = 0; vx = 0;
    startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = performance.now();
    cancelAnimationFrame(glideRaf);
    track.style.scrollSnapType = 'none';   // snapping would fight the drag
    track.classList.add('is-dragging');
    track.setPointerCapture(e.pointerId);
    schedule();
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    track.scrollLeft = startLeft - dx;
    const now = performance.now(), dt = now - lastT;
    if (dt > 0) { vx = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = now; }
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
    if (track.hasPointerCapture?.(e.pointerId)) track.releasePointerCapture(e.pointerId);
    glide();
    schedule();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  // a drag that ends on a link shouldn't follow it
  track.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);

  /* ---------- progress bar under the row, in place of a scrollbar ---------- */
  const bar = document.createElement('div');
  bar.className = 'rev-progress';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<span></span>';
  track.after(bar);
  const drawBar = () => {
    const max = track.scrollWidth - track.clientWidth;
    bar.style.setProperty('--w', `${(track.clientWidth / track.scrollWidth) * 100}%`);
    bar.style.setProperty('--x', `${max > 0 ? (track.scrollLeft / max) * (100 - (track.clientWidth / track.scrollWidth) * 100) : 0}%`);
  };
  track.addEventListener('scroll', drawBar, { passive: true });
  addEventListener('resize', drawBar);
  drawBar();
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
    }, { rootMargin: '200px 0px' }).observe(host);
  }
}

/* ---------- nav: "Login" becomes "Account" once the customer is signed in (no library load needed) ---------- */
import('./supabase.js').then(({ isConfigured, hasStoredSession }) => {
  if (!isConfigured || !hasStoredSession()) return;
  document.querySelectorAll('[data-auth-link]').forEach((a) => { a.textContent = 'Account'; a.href = 'account.html'; });
});
