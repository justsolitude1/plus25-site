// Checkout: shows the order carried over from the service page (cart.js), takes the customer's Discord username,
// then hands out the order code and the Discord invite. Payment and scheduling happen on Discord with the team.
import { readOrder } from './cart.js';

// The Plus 25 Discord invite (Server Settings → Invites, set to never expire).
const DISCORD_INVITE = '';
// Confirmed orders are posted to the team's Discord channel by this script (api/order.php, on the live host only).
const ORDER_ENDPOINT = 'api/order.php';

const $ = (id) => document.getElementById(id);
const order = readOrder();
const DONE_KEY = 'p25-confirmed';

const show = (id) => ['coEmpty', 'coForm', 'coDone'].forEach((k) => { $(k).hidden = k !== id; });

// a short code the customer can post and we can search for: P25- and six characters that can't be misread
function makeRef() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(6));
  return 'P25-' + [...r].map((b) => abc[b % abc.length]).join('');
}

function detailsText(o, who) {
  return [`Plus 25 order ${who.ref}`, `${o.service}${o.total ? ` · ${o.total}` : ''}`,
    ...o.lines.map(([k, v]) => `${k}: ${v}`),
    `Discord: ${who.discord}`, who.email && `Email: ${who.email}`, who.notes && `Notes: ${who.notes}`].filter(Boolean).join('\n');
}

function showDone(who) {
  $('coRef').textContent = who.ref;
  const invite = $('coInvite');
  if (DISCORD_INVITE) invite.href = DISCORD_INVITE;
  else { invite.removeAttribute('href'); invite.setAttribute('aria-disabled', 'true'); invite.textContent = 'Discord invite coming soon'; }
  $('coCopy').onclick = async () => {
    const t = detailsText(order, who);
    try { await navigator.clipboard.writeText(t); $('coCopyMsg').textContent = 'Copied. Paste it in #orders once you have joined.'; }
    catch (e) { $('coCopyMsg').textContent = t; }
  };
  show('coDone');
  $('coDone').querySelector('h1').focus?.();
}

if (!order) show('coEmpty');
else {
  // the order as it was picked
  document.querySelector('.co-sum').classList.add(...(order.el ? [`el-${order.el}`] : []));
  $('coService').textContent = order.service;
  $('coTotal').textContent = order.total || '—';
  $('coEdit').href = order.back;
  for (const [k, v] of order.lines) {
    const li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('span');
    a.textContent = k; b.textContent = v; li.append(a, b); $('coLines').append(li);
  }

  // already confirmed in this tab (a refresh on step 2): straight back to it
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(DONE_KEY)); } catch (e) { /* none */ }
  if (saved && saved.at === order.at) showDone(saved);
  else show('coForm');

  $('coForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, msg = $('coMsg');
    const discord = f.discord.value.trim().replace(/^@/, ''), email = f.email.value.trim(), notes = f.notes.value.trim();
    msg.classList.remove('is-error');
    if (discord.length < 2) { msg.textContent = 'Add your Discord username so we can find you.'; msg.classList.add('is-error'); f.discord.focus(); return; }
    if (email && !f.email.checkValidity()) { msg.textContent = 'That email doesn\'t look right.'; msg.classList.add('is-error'); f.email.focus(); return; }
    const who = { ref: makeRef(), discord, email, notes, at: order.at };
    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true; msg.textContent = 'Confirming…';
    // tell the team; the customer goes on to Discord either way, carrying the code and details themselves
    try {
      await fetch(ORDER_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: who.ref, service: order.service, total: order.total, lines: order.lines, discord, email, notes }),
        signal: AbortSignal.timeout?.(8000) });
    } catch (err) { /* not reachable here (e.g. the GitHub Pages copy): the customer's own post covers it */ }
    try { sessionStorage.setItem(DONE_KEY, JSON.stringify(who)); } catch (err) { /* fine */ }
    msg.textContent = '';
    btn.disabled = false;
    showDone(who);
  });
}
