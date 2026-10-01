// Login page: Discord, Google, or a one-time email link. There are no passwords on this site; the first login creates
// the account (and its profile row, via the trigger in supabase/schema.sql).
import { getSupabase, isConfigured, accountUrl } from './supabase.js';
import { formErrors, busy as busyButton } from './forms.js';

const $ = (id) => document.getElementById(id);
const msg = (text, isError = false) => { $('authMsg').textContent = text; $('authMsg').classList.toggle('is-error', isError); };
const buttons = [...document.querySelectorAll('[data-provider]'), $('emailForm').querySelector('button')];
const busy = (on) => buttons.forEach((b) => { b.disabled = on; });

// a provider that failed sends the customer back with ?error_description=…
const params = new URLSearchParams(location.search);
if (params.get('error_description')) msg(params.get('error_description'), true);

if (!isConfigured) {
  $('authSetup').hidden = false;
  busy(true);
} else {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) location.replace(accountUrl());

  document.querySelectorAll('[data-provider]').forEach((btn) => btn.addEventListener('click', async () => {
    busy(true);
    msg('Opening ' + (btn.dataset.provider === 'discord' ? 'Discord' : 'Google') + '…');
    const { error } = await supabase.auth.signInWithOAuth({ provider: btn.dataset.provider, options: { redirectTo: accountUrl() } });
    if (error) { busy(false); msg(error.message, true); }
  }));

  const errors = formErrors($('emailForm')), emailBtn = $('emailForm').querySelector('button');
  $('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('authEmail'), email = input.value.trim();
    if (!input.checkValidity() || !email) { errors.show({ email: 'Enter a valid email address, like you@example.com.' }); return; }
    errors.clear();
    busy(true);
    busyButton(emailBtn, true);
    msg('Sending your login link…');
    let error;
    try { ({ error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: accountUrl() } })); }
    catch (err) { error = { message: 'Something went wrong sending your link. Check your connection and try again.' }; }
    busyButton(emailBtn, false);
    busy(false);
    if (error) msg(error.message, true);
    else msg(`Check ${email} for your login link. Open it in this browser.`);
  });
}
