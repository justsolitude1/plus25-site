<?php
// Checkout posts each confirmed order here; it goes on to the team's Discord channel through a webhook (lib.php).
require __DIR__ . '/lib.php';
[$cfg, $in] = p25_request('orders', 6);

$ref = txt($in['ref'] ?? '', 16);
if (!preg_match('/^P25-[A-Z0-9]{6}$/', $ref)) done(400, ['ok' => false]);
$service = txt($in['service'] ?? '', 40);
$total = txt($in['total'] ?? '', 20);
$discord = txt($in['discord'] ?? '', 40);
$email = txt($in['email'] ?? '', 120);
if ($service === '') done(400, ['ok' => false]);
// field problems go back by name, so checkout can show each one beside its field
$errors = [];
if (!valid_discord($discord)) $errors['discord'] = 'Add your Discord username so we can find you.';
if (!valid_email($email)) $errors['email'] = 'That email doesn\'t look right. Check it, or leave it empty.';
if ($errors) done(422, ['ok' => false, 'errors' => $errors]);

$fields = [];
foreach (array_slice(is_array($in['lines'] ?? null) ? $in['lines'] : [], 0, 20) as $l) {
  if (!is_array($l) || count($l) !== 2) continue;
  $k = txt($l[0], 40); $v = txt($l[1], 600);
  if ($k !== '' && $v !== '') $fields[] = ['name' => $k, 'value' => $v, 'inline' => mb_strlen($v) < 40];
}
$fields[] = ['name' => 'Discord', 'value' => $discord, 'inline' => true];
if ($email !== '') $fields[] = ['name' => 'Email', 'value' => $email, 'inline' => true];
if (($notes = txt($in['notes'] ?? '', 600)) !== '') $fields[] = ['name' => 'Notes', 'value' => $notes, 'inline' => false];

$colors = ['Replay analysis' => 0x4FC3FF, 'Coaching' => 0xC07BFF, 'MMR boost' => 0xFFA23A];
p25_post($cfg, 'Plus 25 orders', [
  'title' => "New order $ref",
  'description' => $service . ($total !== '' ? " · $total" : ''),
  'color' => $colors[$service] ?? 0xF0AF5E,
  'fields' => $fields,
]);
