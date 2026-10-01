// Thank-you page: the order code and details saved by checkout.js, the Discord invite, and a copy button.
import { readOrder, DONE_KEY } from './cart.js';
import { DISCORD_INVITE } from './config.js';

const $ = (id) => document.getElementById(id);
const order = readOrder();
let who = null;
try { who = JSON.parse(sessionStorage.getItem(DONE_KEY)); } catch (e) { /* none */ }
if (!order || !who || who.at !== order.at) who = null;

function detailsText(o, w) {
  return [`Plus 25 order ${w.ref}`, `${o.service}${o.total ? ` · ${o.total}` : ''}`,
    ...o.lines.map(([k, v]) => `${k}: ${v}`),
    `Discord: ${w.discord}`, w.email && `Email: ${w.email}`, w.notes && `Notes: ${w.notes}`].filter(Boolean).join('\n');
}

const invite = $('tyInvite');
if (DISCORD_INVITE) invite.href = DISCORD_INVITE;
else { invite.setAttribute('aria-disabled', 'true'); invite.textContent = 'Discord invite coming soon'; }

if (who) {
  $('tyRef').textContent = who.ref;
  $('tyRefRow').hidden = false;
  $('tyCopy').hidden = false;
  $('tyCopy').addEventListener('click', async () => {
    const t = detailsText(order, who);
    try { await navigator.clipboard.writeText(t); $('tyCopyMsg').textContent = 'Copied. Paste it in #orders once you have joined.'; }
    catch (e) { $('tyCopyMsg').textContent = t; }
  });
  $('ty-title').focus();
} else {
  $('ty-title').textContent = 'Thanks for ordering';
  $('tyNoOrder').hidden = false;
}
