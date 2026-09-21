// Carries an order from a service page to checkout.html. The whole order rides in the link's #fragment, which never
// reaches the server and survives a refresh or a copied link; sessionStorage keeps a copy as a fallback.
// An order is { service, el, back, lines: [[label, value], …], total }, all plain text.
const KEY = 'p25-order';

const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export function goToCheckout(order) {
  const o = { ...order, back: order.back || location.pathname.split('/').pop() || './', at: Date.now() };
  const json = JSON.stringify(o);
  try { sessionStorage.setItem(KEY, json); } catch (e) { /* private mode: the link still carries it */ }
  location.href = 'checkout.html#o=' + toB64(json);
}

// The fragment is anyone's to edit, so only well-formed text comes through, trimmed to sane lengths.
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function clean(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.lines)) return null;
  const lines = o.lines.filter((l) => Array.isArray(l) && l.length === 2).slice(0, 24)
    .map(([k, v]) => [text(k, 40), text(v, 600)]).filter(([k, v]) => k && v);
  const service = text(o.service, 40), total = text(o.total, 20);
  if (!service || !lines.length) return null;
  return { service, total, lines, el: /^(quas|wex|exort)$/.test(o.el) ? o.el : '', back: /^[\w-]+\.html$/.test(o.back) ? o.back : './', at: Number(o.at) || 0 };
}

export function readOrder() {
  const m = /[#&]o=([\w-]+)/.exec(location.hash);
  if (m) { try { return clean(JSON.parse(fromB64(m[1]))); } catch (e) { /* fall through to the stored copy */ } }
  try { return clean(JSON.parse(sessionStorage.getItem(KEY))); } catch (e) { return null; }
}

// the summary lines as a service page shows them: <li><span>Label</span><span>Value</span></li>
export const linesFrom = (list) => [...list.querySelectorAll('li')].map((li) => [...li.children].map((s) => s.textContent.trim())).filter((p) => p.length === 2);
