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

  let timer = 0, hovered = false, focused = false, visible = false;
  const schedule = () => {
    clearInterval(timer);
    const run = !reduced && visible && !hovered && !focused && document.visibilityState === 'visible';
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
