// Careers page: checks the application, posts it to the team's Discord (api/apply.php), and shows it was sent.
import { SUPPORT_EMAIL } from './config.js';
import { formErrors, busy, postJSON, failMessage } from './forms.js';

const form = document.getElementById('applyForm'), done = document.getElementById('applyDone');
const errors = formErrors(form), btn = form.querySelector('button[type="submit"]');
const PROFILE = /^https:\/\/(www\.)?(dotabuff\.com|opendota\.com|stratz\.com)\/players\/\d+/i;
const picked = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (btn.disabled) return;
  const v = (name) => form.elements[name].value.trim();
  const data = {
    discord: v('discord').replace(/^@/, ''), email: v('email'), roles: picked('roles'), mmr: v('mmr'), peak: v('peak'),
    region: v('region'), hours: v('hours'), positions: picked('positions'), profile: v('profile'), languages: v('languages'),
    about: v('about'), website: v('website'),
  };
  const problems = {};
  if (data.discord.length < 2) problems.discord = 'Add your Discord username so we can reach you.';
  if (data.email && !form.elements.email.checkValidity()) problems.email = 'That email doesn\'t look right. Check it, or leave it empty.';
  if (!data.roles.length) problems.roles = 'Pick at least one thing you want to do.';
  if (!/^\d{1,5}$/.test(data.mmr) || Number(data.mmr) > 20000) problems.mmr = 'Enter your current MMR as a number.';
  if (data.peak && (!/^\d{1,5}$/.test(data.peak) || Number(data.peak) > 20000)) problems.peak = 'Enter your peak MMR as a number, or leave it empty.';
  if (!data.region) problems.region = 'Choose the region you play in.';
  if (!PROFILE.test(data.profile)) problems.profile = 'Paste your Dotabuff, OpenDota or STRATZ profile link.';
  if (Object.keys(problems).length) { errors.show(problems); return; }

  errors.clear();
  busy(btn, true);
  const res = await postJSON('api/apply.php', data);
  busy(btn, false);
  if (res.ok) {
    form.hidden = true;
    done.hidden = false;
    done.querySelector('h3').focus();
    return;
  }
  if (res.status === 422 && res.body?.errors) return errors.show(res.body.errors);
  errors.fail(failMessage('application', SUPPORT_EMAIL));
});
