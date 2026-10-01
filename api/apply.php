<?php
// The careers page posts each booster / coach / analyst application here; it goes to the team's Discord (lib.php).
require __DIR__ . '/lib.php';
[$cfg, $in] = p25_request('apply', 3);

// a field people can't see: anything in it came from a bot, which gets a quiet "thanks" and nothing posted
if (txt($in['website'] ?? '', 200) !== '') done(200, ['ok' => true]);

$ROLES = ['MMR boosting', 'Coaching', 'Replay analysis'];
$REGIONS = ['SEA', 'Japan', 'Australia', 'Europe', 'USA', 'South America', 'Other'];
$HOURS = ['Under 10', '10–20', '20–40', '40+'];

$discord = txt($in['discord'] ?? '', 40);
$email = txt($in['email'] ?? '', 120);
$roles = array_values(array_intersect($ROLES, array_map(function ($r) { return txt($r, 40); }, is_array($in['roles'] ?? null) ? $in['roles'] : [])));
$mmr = filter_var($in['mmr'] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 20000]]);
$peak = trim((string) ($in['peak'] ?? '')) === '' ? null : filter_var($in['peak'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 20000]]);
$region = txt($in['region'] ?? '', 40);
$profile = txt($in['profile'] ?? '', 200);
$hours = txt($in['hours'] ?? '', 20);

$errors = [];
if (!valid_discord($discord)) $errors['discord'] = 'Add your Discord username so we can reach you.';
if (!valid_email($email)) $errors['email'] = 'That email doesn\'t look right. Check it, or leave it empty.';
if (!$roles) $errors['roles'] = 'Pick at least one thing you want to do.';
if ($mmr === false) $errors['mmr'] = 'Enter your current MMR as a number.';
if ($peak === false) $errors['peak'] = 'Enter your peak MMR as a number, or leave it empty.';
if (!in_array($region, $REGIONS, true)) $errors['region'] = 'Choose the region you play in.';
if (!preg_match('~^https://(www\.)?(dotabuff\.com|opendota\.com|stratz\.com)/players/\d+~i', str_replace("@\u{200B}", '@', $profile))) $errors['profile'] = 'Paste your Dotabuff, OpenDota or STRATZ profile link.';
if ($hours !== '' && !in_array($hours, $HOURS, true)) $errors['hours'] = 'Choose how many hours a week you can give.';
if ($errors) done(422, ['ok' => false, 'errors' => $errors]);

$fields = [
  ['name' => 'Discord', 'value' => $discord, 'inline' => true],
  ['name' => 'Applying for', 'value' => implode(', ', $roles), 'inline' => true],
  ['name' => 'MMR', 'value' => (string) $mmr . ($peak !== null ? " (peak $peak)" : ''), 'inline' => true],
  ['name' => 'Region', 'value' => $region, 'inline' => true],
  ['name' => 'Profile', 'value' => $profile, 'inline' => false],
];
if ($hours !== '') $fields[] = ['name' => 'Hours a week', 'value' => $hours, 'inline' => true];
if ($email !== '') $fields[] = ['name' => 'Email', 'value' => $email, 'inline' => true];
if (($langs = txt($in['languages'] ?? '', 120)) !== '') $fields[] = ['name' => 'Languages', 'value' => $langs, 'inline' => true];
$positions = array_slice(array_filter(array_map(function ($r) { return txt($r, 20); }, is_array($in['positions'] ?? null) ? $in['positions'] : [])), 0, 5);
if ($positions) $fields[] = ['name' => 'Positions', 'value' => implode(', ', $positions), 'inline' => false];
if (($about = txt($in['about'] ?? '', 1000)) !== '') $fields[] = ['name' => 'About', 'value' => $about, 'inline' => false];

p25_post($cfg, 'Plus 25 careers', [
  'title' => 'New application: ' . implode(', ', $roles),
  'description' => "$discord · $mmr MMR · $region",
  'color' => 0xF0AF5E,
  'fields' => $fields,
]);
