<?php
// Shared by order.php and apply.php: request checks, a per-address rate limit, text cleaning and the Discord webhook.
// The webhook URL lives in config.php beside this file (kept out of the repo, never sent to the browser):
//   <?php return ['discord_webhook' => 'https://discord.com/api/webhooks/…'];
// An endpoint can have a channel of its own: 'orders_webhook' for order.php, 'apply_webhook' for apply.php.
// Without one it posts to 'discord_webhook'.
header('Content-Type: application/json');
header('Cache-Control: no-store');
function done($code, $body) { http_response_code($code); echo json_encode($body); exit; }

// POST from the site itself only; returns the config and the decoded JSON body
function p25_request($bucket, $maxHits) {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') done(405, ['ok' => false]);
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin !== '' && !in_array($origin, ['https://plus25dota.com', 'https://www.plus25dota.com'], true)) done(403, ['ok' => false]);

  $cfg = @include __DIR__ . '/config.php';
  if (is_array($cfg) && !empty($cfg["{$bucket}_webhook"])) $cfg['discord_webhook'] = $cfg["{$bucket}_webhook"];
  if (!is_array($cfg) || empty($cfg['discord_webhook'])) done(503, ['ok' => false, 'error' => 'not configured']);

  // at most $maxHits posts per 10 minutes from one address, so the channel can't be flooded
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
  $log = sys_get_temp_dir() . "/p25-$bucket-" . md5($ip);
  $now = time();
  $hits = array_values(array_filter((array) json_decode((string) @file_get_contents($log), true), function ($t) use ($now) { return is_int($t) && $t > $now - 600; }));
  if (count($hits) >= $maxHits) done(429, ['ok' => false]);
  $hits[] = $now;
  @file_put_contents($log, json_encode($hits));

  $in = json_decode((string) file_get_contents('php://input', false, null, 0, 20000), true);
  if (!is_array($in)) done(400, ['ok' => false]);
  return [$cfg, $in];
}

// plain text only, no pings: "@everyone" and friends are broken up so a visitor can't mention the whole server
function txt($v, $max) {
  $s = is_string($v) ? trim(preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', '', $v)) : '';
  $s = str_replace(['@', '`'], ["@\u{200B}", "'"], $s);
  return mb_substr($s, 0, $max);
}
// the same checks the form makes in the browser, repeated here because the browser's can be skipped
function valid_discord($s) { return mb_strlen($s) >= 2 && mb_strlen($s) <= 40; }
function valid_email($s) { return $s === '' || filter_var(str_replace("@\u{200B}", '@', $s), FILTER_VALIDATE_EMAIL) !== false; }

function p25_post($cfg, $username, $embed) {
  $ch = curl_init($cfg['discord_webhook']);
  curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['username' => $username, 'allowed_mentions' => ['parse' => []], 'embeds' => [$embed + ['timestamp' => gmdate('c')]]]),
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
  curl_exec($ch);
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  $ok = $status >= 200 && $status < 300;
  done($ok ? 200 : 502, ['ok' => $ok]);
}
