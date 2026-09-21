<?php
// Checkout posts each confirmed order here; it goes on to the team's Discord channel through a webhook.
// The webhook URL lives in config.php beside this file (kept out of the repo, never sent to the browser):
//   <?php return ['discord_webhook' => 'https://discord.com/api/webhooks/…'];
header('Content-Type: application/json');
header('Cache-Control: no-store');
function done($code, $body) { http_response_code($code); echo json_encode($body); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') done(405, ['ok' => false]);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, ['https://plus25dota.com', 'https://www.plus25dota.com'], true)) done(403, ['ok' => false]);

$cfg = @include __DIR__ . '/config.php';
if (!is_array($cfg) || empty($cfg['discord_webhook'])) done(503, ['ok' => false, 'error' => 'not configured']);

// at most 6 orders per 10 minutes from one address, so the channel can't be flooded
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$log = sys_get_temp_dir() . '/p25-orders-' . md5($ip);
$now = time();
$hits = array_values(array_filter((array) json_decode((string) @file_get_contents($log), true), function ($t) use ($now) { return is_int($t) && $t > $now - 600; }));
if (count($hits) >= 6) done(429, ['ok' => false]);
$hits[] = $now;
@file_put_contents($log, json_encode($hits));

$in = json_decode((string) file_get_contents('php://input', false, null, 0, 20000), true);
if (!is_array($in)) done(400, ['ok' => false]);
// plain text only, no pings: "@everyone" and friends are broken up so a customer can't mention the whole server
function txt($v, $max) {
  $s = is_string($v) ? trim(preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', '', $v)) : '';
  $s = str_replace(['@', '`'], ["@\u{200B}", "'"], $s);
  return mb_substr($s, 0, $max);
}
$ref = txt($in['ref'] ?? '', 16);
if (!preg_match('/^P25-[A-Z0-9]{6}$/', $ref)) done(400, ['ok' => false]);
$service = txt($in['service'] ?? '', 40);
$total = txt($in['total'] ?? '', 20);
$discord = txt($in['discord'] ?? '', 40);
if ($service === '' || $discord === '') done(400, ['ok' => false]);

$fields = [];
foreach (array_slice(is_array($in['lines'] ?? null) ? $in['lines'] : [], 0, 20) as $l) {
  if (!is_array($l) || count($l) !== 2) continue;
  $k = txt($l[0], 40); $v = txt($l[1], 600);
  if ($k !== '' && $v !== '') $fields[] = ['name' => $k, 'value' => $v, 'inline' => mb_strlen($v) < 40];
}
$fields[] = ['name' => 'Discord', 'value' => $discord, 'inline' => true];
if (($email = txt($in['email'] ?? '', 120)) !== '') $fields[] = ['name' => 'Email', 'value' => $email, 'inline' => true];
if (($notes = txt($in['notes'] ?? '', 600)) !== '') $fields[] = ['name' => 'Notes', 'value' => $notes, 'inline' => false];

$colors = ['Replay analysis' => 0x4FC3FF, 'Coaching' => 0xC07BFF, 'MMR boost' => 0xFFA23A];
$payload = [
  'username' => 'Plus 25 orders',
  'allowed_mentions' => ['parse' => []],
  'embeds' => [[
    'title' => "New order $ref",
    'description' => $service . ($total !== '' ? " · $total" : ''),
    'color' => $colors[$service] ?? 0xF0AF5E,
    'fields' => $fields,
    'timestamp' => gmdate('c'),
  ]],
];

$ch = curl_init($cfg['discord_webhook']);
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode($payload), CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
done($status >= 200 && $status < 300 ? 200 : 502, ['ok' => $status >= 200 && $status < 300]);
