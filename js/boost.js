// MMR boost page: price calculator, options, medals and package cards, plus the grimoire beside the form.
// Loaded as a module after the GSAP scripts.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches;
const debug = new URLSearchParams(location.search).has('debug');

/* ---------- MMR calculator ---------- */
// Priced 10% under VikingDOTA's MMR boost (vikingdota.com/products/dota2-mmr-boost, formula read from their page 2026-09-15).
// cost[i] is their cumulative USD price to go from 0 to i×100 MMR, straight-line between points. An order costs
// cost(desired) − cost(current), times their 1.05 fee and the boost type's rate, times our discount.
const PRICING = {
  cost: [0, 6, 12.14, 18.42, 24.84, 31.41, 38.13, 45.01, 52.05, 59.24,
    66.61, 74.14, 81.84, 89.73, 97.79, 106.04, 114.48, 123.11, 131.94, 140.98,
    150.22, 159.67, 169.35, 179.24, 189.36, 199.72, 210.31, 221.15, 232.24, 243.58,
    255.18, 267.05, 279.19, 291.61, 304.32, 317.32, 331.03, 345.5, 360.77, 376.87,
    393.86, 411.79, 430.7, 450.65, 471.69, 493.9, 517.32, 542.04, 568.11, 595.62,
    624.64, 655.26, 687.56, 721.64, 758.28, 797.66, 840, 885.51, 934.44, 987.04,
    1043.58, 1104.36, 1169.7, 1239.94, 1315.45, 1396.62, 1483.88, 1577.68, 1678.52, 1786.92,
    1903.45, 2028.72, 2163.39, 2308.16, 2463.78, 2631.08, 2810.92, 3004.25, 3212.08, 3435.5,
    3675.68, 3933.87, 4211.42, 4509.79, 4830.54, 5175.34, 5546, 5944.46, 6372.81, 6833.28,
    7328.29, 7860.42],
  fee: 1.05,
  discount: 0.9,        // 10% under Viking
  // in rune order; rate = Viking's multiplier for the matching boost type (named in each comment)
  types: {
    bounty: { name: 'Bounty', rate: 0.756, start: '~12 h', bonus: false },        // Viking Eco
    haste: { name: 'Haste', rate: 1.08, start: '~8 h', bonus: true },             // Viking Plus
    doubleDamage: { name: 'Double Damage', rate: 1.458, start: '~1 h', bonus: true },  // Viking Ultimate
  },
  // free MMR on top of the order, for runes with bonus: [boost of at least, bonus MMR] (Viking's tiers)
  bonus: [[300, 20], [600, 40], [1000, 80], [1500, 150]],
  maxMMR: 7000,
  minGain: 50,
  mmrPerDay: 160,       // Viking's delivery estimate
};
// Order options, as Viking offers them per boost type. `from` is the cheapest rune that includes it; all are free
// except `surcharge` (a share added to the price). `on` = ticked by default, `detail` = the follow-up field it reveals.
const OPTIONS = [
  { id: 'invisible', name: 'Invisible mode', from: 'bounty', on: true, tip: 'Your Steam status stays offline while we play.' },
  { id: 'exposeOff', name: 'Expose data off', from: 'bounty', on: true, tip: 'Your match data stays hidden from public profiles.' },
  { id: 'schedule', name: 'Schedule', from: 'haste', detail: 'schedule', tip: 'We only play on your account at the times you set.' },
  { id: 'server', name: 'Choose server', from: 'haste', detail: 'server', tip: 'Pick the region your games are played on.' },
  { id: 'role', name: 'Choose role', from: 'haste', detail: 'role', tip: 'Pick the positions your booster plays.' },
  { id: 'heroes', name: 'Heroes request', from: 'haste', detail: 'heroes', tip: 'Tell us which heroes to play or avoid.' },
  { id: 'priority', name: 'Priority order', from: 'doubleDamage', on: true, tip: 'A booster is assigned within 1–4 hours.' },
  { id: 'accel', name: 'Max acceleration', from: 'doubleDamage', tip: 'Your order gets top priority until it is done.' },
  { id: 'stream', name: 'Private streaming', from: 'doubleDamage', tip: 'Watch your games live on a private YouTube or Discord stream.' },
  { id: 'various', name: 'Various heroes', from: 'doubleDamage', tip: 'We rotate heroes instead of spamming one, so the climb looks natural.' },
  { id: 'solo', name: 'Solo queue only', from: 'doubleDamage', surcharge: 0.2, tip: 'Your booster only queues solo. Adds 20% to the price.' },
];
// Seasonal medal floors: [lowest MMR, medal]. Herald 1 to Ancient 5 are 154 MMR per star, Divine is 200 per star,
// Immortal starts at 5,620. A shared boundary (e.g. 154) belongs to the higher star.
const RANKS = [
  [0, 'Herald 1'], [154, 'Herald 2'], [308, 'Herald 3'], [462, 'Herald 4'], [616, 'Herald 5'],
  [770, 'Guardian 1'], [924, 'Guardian 2'], [1078, 'Guardian 3'], [1232, 'Guardian 4'], [1386, 'Guardian 5'],
  [1540, 'Crusader 1'], [1694, 'Crusader 2'], [1848, 'Crusader 3'], [2002, 'Crusader 4'], [2156, 'Crusader 5'],
  [2310, 'Archon 1'], [2464, 'Archon 2'], [2618, 'Archon 3'], [2772, 'Archon 4'], [2926, 'Archon 5'],
  [3080, 'Legend 1'], [3234, 'Legend 2'], [3388, 'Legend 3'], [3542, 'Legend 4'], [3696, 'Legend 5'],
  [3850, 'Ancient 1'], [4004, 'Ancient 2'], [4158, 'Ancient 3'], [4312, 'Ancient 4'], [4466, 'Ancient 5'],
  [4620, 'Divine 1'], [4820, 'Divine 2'], [5020, 'Divine 3'], [5220, 'Divine 4'], [5420, 'Divine 5'],
  [5620, 'Immortal'],
];
const rankOf = (m) => RANKS.reduce((name, [t, n]) => (m >= t ? n : name), RANKS[0][1]);
// shows the medal's icon in an <img>, e.g. 'Archon 2' -> media/medals/archon.svg
function setMedal(img, rank) {
  const src = `media/medals/${rank.split(' ')[0].toLowerCase()}.svg`;
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  img.hidden = false;
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

function costTo(mmr) {
  const c = PRICING.cost, i = Math.min(Math.floor(mmr / 100), c.length - 2);
  return c[i] + (c[i + 1] - c[i]) * (mmr / 100 - i);
}
const RUNES = Object.keys(PRICING.types);
const includes = (type, opt) => RUNES.indexOf(type) >= RUNES.indexOf(opt.from);
const bonusFor = (type, gain) => (PRICING.types[type].bonus ? PRICING.bonus.reduce((b, [min, mmr]) => (gain >= min ? mmr : b), 0) : 0);

function quote(current, desired, type, surcharge = 0) {
  const gain = desired - current;
  const raw = (costTo(desired) - costTo(current)) * PRICING.fee * PRICING.types[type].rate * PRICING.discount * (1 + surcharge);
  // round down so we never land above the 10% mark
  return { gain, bonus: bonusFor(type, gain), price: Math.floor(raw * 100) / 100, wins: Math.ceil(gain / 25), days: Math.max(1, Math.ceil(gain / PRICING.mmrPerDay)) };
}

// tier cards: each package is one rune; the price shown is that boost starting from 0 MMR
document.querySelectorAll('.tier[data-gain]').forEach((tier) => {
  const q = quote(0, Number(tier.dataset.gain), tier.dataset.type);
  tier.querySelector('[data-price]').textContent = fmt(Math.floor(q.price));
  tier.querySelector('[data-days]').textContent = days(q.days);
  tier.querySelectorAll('[data-bonus]').forEach((el) => { el.textContent = `+${q.bonus}`; });
});

{
  const $ = (id) => document.getElementById(id);
  const form = $('calcForm'), curNum = $('curNum'), desRange = $('desRange');
  const maxCurrent = PRICING.maxMMR - PRICING.minGain;
  let gain = 1000;   // remembered, so correcting current MMR keeps the same climb on the slider
  const readCurrent = () => {
    const v = parseInt(curNum.value, 10);
    return Number.isFinite(v) ? Math.min(maxCurrent, Math.max(0, v)) : null;
  };

  // the slider starts one minimum order above current and moves in whole wins (+25 each)
  function fitSlider(current) {
    const min = current + PRICING.minGain;
    const max = min + Math.floor((PRICING.maxMMR - min) / 25) * 25;
    desRange.min = min;
    desRange.max = max;
    desRange.value = Math.min(max, min + Math.max(0, Math.round((gain - PRICING.minGain) / 25) * 25));
    $('desMin').textContent = fmt(min);
    $('desMax').textContent = fmt(max);
  }

  // option toggles, built from OPTIONS
  $('optList').innerHTML = OPTIONS.map((o) => `
    <label class="opt" title="${o.tip}"><input type="checkbox" name="opt" value="${o.id}"${o.on ? ' checked' : ''}>
      <span class="opt-box"><i class="opt-tick" aria-hidden="true"></i><span class="opt-text"><b>${o.name}</b><small class="opt-tag" data-tag></small></span></span></label>`).join('');
  const optBox = (o) => form.querySelector(`input[name="opt"][value="${o.id}"]`);

  // lock what the rune doesn't include (unticking it); ticking default-on options as they unlock
  function applyRune(prev) {
    const type = form.elements.boostType.value;
    OPTIONS.forEach((o) => {
      const box = optBox(o), open = includes(type, o);
      if (!open) box.checked = false;
      else if (o.on && prev && !includes(prev, o)) box.checked = true;
      box.disabled = !open;
      box.closest('.opt').classList.toggle('locked', !open);
      box.closest('.opt').querySelector('[data-tag]').textContent = !open ? PRICING.types[o.from].name : o.surcharge ? `+${o.surcharge * 100}%` : '';
    });
    $('optCount').textContent = `${OPTIONS.filter((o) => includes(type, o)).length} of ${OPTIONS.length} included`;
  }
  function showDetails() {
    let any = false;
    OPTIONS.filter((o) => o.detail).forEach((o) => {
      const on = optBox(o).checked;
      form.querySelector(`.detail[data-for="${o.detail}"]`).hidden = !on;
      any ||= on;
    });
    $('optDetails').hidden = !any;
  }

  function render() {
    const current = readCurrent();
    const ok = current !== null;
    desRange.disabled = $('checkoutBtn').disabled = !ok;
    if (!ok) {
      $('rankNow').textContent = '';
      $('medalNow').hidden = true;
      $('resPrice').textContent = '$—';
      $('resDays').textContent = '—';
      $('resDetail').textContent = `Enter your current MMR (0 to ${fmt(maxCurrent)}).`;
      $('resNudge').textContent = '';
      return;
    }
    const desired = Number(desRange.value), min = Number(desRange.min), span = Number(desRange.max) - min;
    const type = form.elements.boostType.value;
    desRange.style.setProperty('--fill', `${span ? (desired - min) / span * 100 : 100}%`);
    desRange.setAttribute('aria-valuetext', `${fmt(desired)} MMR, ${rankOf(desired)}`);
    $('rankNow').textContent = rankOf(current);
    $('rankGoal').textContent = rankOf(desired);
    setMedal($('medalNow'), rankOf(current));
    setMedal($('medalGoal'), rankOf(desired));
    $('desOut').textContent = fmt(desired);
    const surcharge = OPTIONS.reduce((s, o) => s + (o.surcharge && optBox(o).checked ? o.surcharge : 0), 0);
    const q = quote(current, desired, type, surcharge);
    $('resPrice').textContent = `$${q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    $('resDays').textContent = days(q.days);
    $('resDetail').textContent = `+${fmt(q.gain)} MMR${q.bonus ? ` + ${q.bonus} bonus` : ''} · ${q.wins} wins · starts in ${PRICING.types[type].start}`;
    // point at the next bonus tier, if the MMR cap leaves room for it
    const next = PRICING.bonus.find(([need]) => need > q.gain);
    $('resNudge').textContent = !PRICING.types[type].bonus
      ? `Bonus MMR comes with ${RUNES.filter((t) => PRICING.types[t].bonus).map((t) => PRICING.types[t].name).join(' and ')}.`
      : next && current + next[0] <= Number(desRange.max) ? `Boost to ${fmt(current + next[0])} to get ${next[1]} bonus MMR.` : '';
  }

  let rune = form.elements.boostType.value;
  curNum.addEventListener('input', () => { const c = readCurrent(); if (c !== null) fitSlider(c); render(); });
  curNum.addEventListener('change', () => { const c = readCurrent(); if (c !== null) curNum.value = c; render(); });
  desRange.addEventListener('input', () => { gain = desRange.value - readCurrent(); render(); });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'boostType') { applyRune(rune); rune = e.target.value; showDetails(); render(); }
    if (e.target.name === 'opt') { showDetails(); render(); }
  });
  // a package card's button loads its rune and climb into the calculator on the way there
  document.querySelectorAll('.tier[data-gain] .tier-btn').forEach((btn) => btn.addEventListener('click', () => {
    const tier = btn.closest('.tier');
    const radio = form.querySelector(`input[name="boostType"][value="${tier.dataset.type}"]`);
    if (!radio.checked) { radio.checked = true; applyRune(rune); rune = radio.value; showDetails(); }
    gain = Number(tier.dataset.gain);
    if (readCurrent() !== null) fitSlider(readCurrent());
    render();
  }));
  applyRune();
  fitSlider(readCurrent());
  form.addEventListener('submit', (e) => e.preventDefault());
  $('checkoutBtn').addEventListener('click', () => { $('checkoutNote').hidden = false; });
  render();
}

/* ---------- the grimoire beside the form: flies in once it has loaded, renders only while on screen ---------- */
{
  const section = document.getElementById('calculator');
  let book = null, loading = false;
  if (document.documentElement.classList.contains('lite')) {
    // phones: a still of the same book, rising in when the section arrives (no WebGL)
    const box = section.querySelector('.calc-book');
    box.insertAdjacentHTML('beforeend', '<img class="book-still" src="media/lite/grimoire.webp" alt="" width="900" height="972" loading="lazy" decoding="async">');
    new IntersectionObserver(([e], io) => { if (e.isIntersecting) { box.classList.add('in'); io.disconnect(); } }, { rootMargin: '0px 0px -15% 0px' }).observe(box);
  } else new IntersectionObserver(async ([e]) => {
    if (e.isIntersecting && !book && !loading) {
      loading = true;
      try {
        const { initCalcBook } = await import('./calcbook.js');
        book = await initCalcBook({ canvas: document.getElementById('calcBook'), reduced, mobile, debug });
        if (reduced || !window.gsap) book.setEnter(1);
        else { const t = { v: 0 }; gsap.to(t, { v: 1, duration: 1.8, ease: 'power2.out', onUpdate: () => book.setEnter(t.v) }); }
        if (debug) window.__calcBook = book;
      } catch (err) { console.error(err); }
    }
    book?.setActive(e.isIntersecting);
  }, { rootMargin: '400px 0px' }).observe(section);
}
