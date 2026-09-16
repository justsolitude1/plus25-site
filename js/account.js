// Account page: the signed-in customer's profile, member pricing status and orders. Everything is read with the
// customer's own session, so row level security (supabase/schema.sql) limits it to their rows. Values from the
// database are only ever written with textContent.
import { getSupabase, isConfigured } from './supabase.js';

const $ = (id) => document.getElementById(id);
const SERVICE = { mmr_boost: ['MMR boost', 'el-exort'], replay_analysis: ['Replay analysis', 'el-quas'], coaching: ['Coaching', 'el-wex'] };
const STATUS = { pending: 'Awaiting payment', paid: 'Paid, starting soon', in_progress: 'In progress', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled' };
const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const el = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text != null) n.textContent = text; return n; };

function showError(text) {
  $('accountLoading').textContent = text;
  $('accountLoading').classList.add('is-error');
}

if (!isConfigured) {
  $('accountLoading').hidden = true;
  $('authSetup').hidden = false;
} else {
  const supabase = await getSupabase();
  // on the way back from a login provider or email link, this also finishes signing in (detectSessionInUrl)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) showError(sessionError.message);
  else if (!session) location.replace('login.html' + location.search);
  else {
    const user = session.user;
    history.replaceState(null, '', location.pathname);   // drop the one-time ?code= from the address bar

    const [{ data: profile, error: profileError }, { data: orders, error: ordersError }] = await Promise.all([
      supabase.from('profiles').select('display_name, avatar_url, is_member').eq('id', user.id).maybeSingle(),
      supabase.from('orders').select('id, service, status, summary, total_usd, progress, created_at').order('created_at', { ascending: false }),
    ]);
    if (profileError || ordersError) showError((profileError || ordersError).message);
    else render(user, profile, orders);
  }

  function render(user, profile, orders) {
    const name = profile?.display_name || user.email?.split('@')[0] || 'player';
    $('accName').textContent = name;
    $('accEmail').textContent = user.email || '';
    const avatar = profile?.avatar_url;
    if (avatar && /^https:\/\//.test(avatar)) { $('accAvatar').src = avatar; $('accAvatar').hidden = false; }

    $('memberStatus').textContent = profile?.is_member
      ? 'Active. Member pricing applies to your orders.'
      : 'Not active yet. Returning customers get member pricing on every tier.';
    $('memberStatus').classList.toggle('is-member', Boolean(profile?.is_member));

    $('nameInput').value = profile?.display_name || '';
    $('nameForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = $('nameInput').value.trim();
      if (!value) { $('nameMsg').textContent = 'Enter a display name.'; $('nameMsg').classList.add('is-error'); return; }
      const { error } = await supabase.from('profiles').update({ display_name: value }).eq('id', user.id);
      $('nameMsg').classList.toggle('is-error', Boolean(error));
      $('nameMsg').textContent = error ? error.message : 'Saved';
      if (!error) $('accName').textContent = value;
    });

    const list = $('orderList');
    list.replaceChildren(...orders.map((o) => {
      const [label, elClass] = SERVICE[o.service] || [o.service, ''];
      const li = el('li', `order-item ${elClass}`);
      const top = el('div', 'order-top');
      top.append(el('span', 'order-service', label), el('span', `order-status is-${o.status}`, STATUS[o.status] || o.status));
      li.append(top);
      if (o.summary) li.append(el('p', 'order-summary', o.summary));
      if (o.status === 'in_progress' && Number.isFinite(o.progress)) {
        const bar = el('div', 'order-progress');
        bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuenow', String(o.progress)); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
        bar.style.setProperty('--p', `${o.progress}%`);
        li.append(bar);
      }
      const meta = el('p', 'order-meta', `${date(o.created_at)}${o.total_usd != null ? ` · ${money(o.total_usd)}` : ''}`);
      li.append(meta);
      return li;
    }));
    $('ordersEmpty').hidden = orders.length > 0;

    $('signOut').addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.replace('login.html');
    });

    $('accountLoading').hidden = true;
    $('accountView').hidden = false;
  }
}
