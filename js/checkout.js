// Checkout: shows the order carried over from the service page (cart.js), takes the customer's Discord username,
// posts the order to the team (api/order.php) and moves on to thank-you.html with the order code and Discord invite.
// Payment and scheduling happen on Discord with the team.
import { readOrder, DONE_KEY } from './cart.js';
import { DISCORD_INVITE, SUPPORT_EMAIL } from './config.js';
import { formErrors, busy, postJSON, failMessage } from './forms.js';

// Confirmed orders are posted to the team's Discord channel by this script (on the live host only).
const ORDER_ENDPOINT = 'api/order.php';

const $ = (id) => document.getElementById(id);
const order = readOrder();

const show = (id) => ['coEmpty', 'coForm'].forEach((k) => { $(k).hidden = k !== id; });

// a short code the customer can post and we can search for: P25- and six characters that can't be misread
function makeRef() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(6));
  return 'P25-' + [...r].map((b) => abc[b % abc.length]).join('');
}

function finish(who) {
  try { sessionStorage.setItem(DONE_KEY, JSON.stringify(who)); } catch (err) { /* thank-you shows the generic note */ }
  location.href = 'thank-you.html';
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

  // already confirmed in this tab (back from the thank-you page): straight on to it
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(DONE_KEY)); } catch (e) { /* none */ }
  if (saved && saved.at === order.at) location.replace('thank-you.html');
  else show('coForm');

  const form = $('coForm'), errors = formErrors(form), btn = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    const discord = form.discord.value.trim().replace(/^@/, ''), email = form.email.value.trim(), notes = form.notes.value.trim();
    const problems = {};
    if (discord.length < 2) problems.discord = 'Add your Discord username so we can find you.';
    if (email && !form.email.checkValidity()) problems.email = 'That email doesn\'t look right. Check it, or leave it empty.';
    if (Object.keys(problems).length) { errors.show(problems); return; }

    errors.clear();
    const who = { ref: makeRef(), discord, email, notes, at: order.at };
    busy(btn, true, 'Confirming…');
    const res = await postJSON(ORDER_ENDPOINT, { ref: who.ref, service: order.service, total: order.total, lines: order.lines, discord, email, notes });
    busy(btn, false);
    if (res.ok) return finish(who);
    if (res.status === 422 && res.body?.errors) return errors.show(res.body.errors);
    // the team didn't get it: say so, keep everything typed, and offer to carry on by posting the code on Discord
    const note = failMessage('order', SUPPORT_EMAIL);
    if (DISCORD_INVITE) {
      const skip = document.createElement('button');
      skip.type = 'button'; skip.className = 'text-btn'; skip.textContent = 'Continue and post my order on Discord myself';
      skip.addEventListener('click', () => finish(who));
      note.append(' ', skip);
    }
    errors.fail(note);
  });
}
