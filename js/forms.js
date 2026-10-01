// Form states shared by checkout, careers, login and account: an error beside each field (tied to it with
// aria-describedby and aria-invalid), a summary at the top that takes focus when a submit fails, and a busy button.
// Errors are { fieldName: 'message' }; a field is found by its name, and a group of boxes by its <fieldset>.

const fieldsOf = (form, name) => [...form.querySelectorAll(`[name="${name}"]`)];

export function formErrors(form) {
  const summary = document.createElement('div');
  summary.className = 'form-errors';
  summary.tabIndex = -1;
  summary.hidden = true;
  summary.setAttribute('role', 'alert');
  form.prepend(summary);

  function clearField(name) {
    for (const f of fieldsOf(form, name)) {
      f.removeAttribute('aria-invalid');
      const ids = (f.getAttribute('aria-describedby') || '').split(' ').filter((id) => id && id !== `err-${name}`);
      if (ids.length) f.setAttribute('aria-describedby', ids.join(' ')); else f.removeAttribute('aria-describedby');
    }
    form.querySelector(`#err-${CSS.escape(name)}`)?.remove();
  }
  function clear() {
    new Set([...form.querySelectorAll('[aria-invalid="true"]')].map((f) => f.name)).forEach(clearField);
    summary.hidden = true;
    summary.replaceChildren();
  }
  // shows every error and moves focus to the summary, so a screen reader hears what went wrong first
  function show(errors, lead) {
    clear();
    const entries = Object.entries(errors);
    const list = document.createElement('ul');
    for (const [name, text] of entries) {
      const fields = fieldsOf(form, name);
      if (fields.length) {
        const msg = document.createElement('p');
        msg.className = 'field-error';
        msg.id = `err-${name}`;
        msg.textContent = text;
        // a group of boxes gets one message at the end of its fieldset; a single field right after itself
        const group = fields.length > 1 || /radio|checkbox/.test(fields[0].type) ? fields[0].closest('fieldset') : null;
        if (group) group.append(msg); else (fields[0].closest('.mmr-box') || fields[0]).after(msg);
        for (const f of fields) {
          f.setAttribute('aria-invalid', 'true');
          f.setAttribute('aria-describedby', [f.getAttribute('aria-describedby'), msg.id].filter(Boolean).join(' '));
        }
      }
      const li = document.createElement('li');
      if (fields[0]?.id) { const a = document.createElement('a'); a.href = `#${fields[0].id}`; a.textContent = text; li.append(a); }
      else li.textContent = text;
      list.append(li);
    }
    const head = document.createElement('p');
    head.textContent = lead || (entries.length === 1 ? 'One thing needs fixing:' : `${entries.length} things need fixing:`);
    summary.replaceChildren(head, list);
    summary.hidden = false;
    summary.focus();
  }
  // a message for the whole form (a network failure, say), in the same place as the field summary
  function fail(node) {
    clear();
    summary.replaceChildren(node);
    summary.hidden = false;
    summary.focus();
  }
  // fixing a field clears its message straight away
  form.addEventListener('input', (e) => { if (e.target.name && e.target.getAttribute('aria-invalid')) clearField(e.target.name); });
  form.addEventListener('change', (e) => { if (e.target.name && e.target.getAttribute('aria-invalid')) clearField(e.target.name); });
  return { show, fail, clear };
}

// the submit button while a request is out: disabled, a spinner, and a word for what's happening
export function busy(button, on, label = 'Sending…') {
  if (on) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
    button.append(label);
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
}

// POSTs JSON; resolves to { ok, status, body } and never throws (a network failure is { ok: false, status: 0 })
export async function postJSON(url, data, ms = 10000) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout?.(ms) });
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    return { ok: res.ok && body?.ok !== false, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

// "try again or reach us" for when a request fails, with the support email if there is one
export function failMessage(what, email) {
  const p = document.createElement('p');
  p.append(`Something went wrong sending your ${what}. Your details are still here: try again in a moment, or `);
  const a = document.createElement('a');
  if (email) { a.href = `mailto:${email}`; a.textContent = `email us at ${email}`; }
  else { a.href = 'contact.html'; a.textContent = 'contact us'; }
  p.append(a, '.');
  return p;
}
