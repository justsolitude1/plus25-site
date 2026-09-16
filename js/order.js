// Order panels on the replay analysis and coaching pages. Each form[data-order-form] prices a package
// (input[name="package"] with data-price / data-label) times any ticked extras (data-surcharge, e.g. 0.3 = +30%),
// and fills the summary from [data-out] and [data-out-picks] elements. Checkout isn't live yet (see site.js).
const money = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

document.querySelectorAll('form[data-order-form]').forEach((form) => {
  const out = (key) => form.querySelector(`[data-out="${key}"]`);
  const ids = form.querySelector('[data-match-ids]');

  function render() {
    const pkg = form.querySelector('input[name="package"]:checked');
    const extras = [...form.querySelectorAll('input[data-surcharge]:checked')];
    const total = extras.reduce((sum, x) => sum * (1 + Number(x.dataset.surcharge)), Number(pkg.dataset.price));
    out('package').textContent = pkg.dataset.label;
    out('extras').textContent = extras.length ? extras.map((x) => x.dataset.label).join(', ') : 'None';
    out('total').textContent = money(Math.round(total * 100) / 100);
    form.querySelectorAll('[data-out-picks]').forEach((el) => {
      const picked = [...form.querySelectorAll(`input[name="${el.dataset.outPicks}"]:checked`)].map((i) => i.value);
      el.textContent = picked.length ? picked.join(', ') : el.dataset.empty;
    });
    form.querySelectorAll('[data-out-field]').forEach((el) => {
      const field = form.elements[el.dataset.outField];
      el.textContent = field.value || el.dataset.empty;
    });
    // replay analysis: one Dota match ID (a long number) per replay in the package
    if (ids) {
      const need = Number(pkg.dataset.replays), have = (ids.value.match(/\d{6,}/g) || []).length;
      const note = form.querySelector('[data-ids-note]');
      note.textContent = have > need ? `${have} match IDs added: this package covers ${need}` : `${have} of ${need} match IDs added`;
      note.classList.toggle('warn', have > need);
      out('ids').textContent = `${Math.min(have, need)} of ${need}`;
    }
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', (e) => e.preventDefault());
  render();
});

// package cards further down the page pick their package in the order form on the way up
document.querySelectorAll('[data-pick-package]').forEach((btn) => btn.addEventListener('click', () => {
  const radio = document.querySelector(`form[data-order-form] input[name="package"][value="${btn.dataset.pickPackage}"]`);
  if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
}));
