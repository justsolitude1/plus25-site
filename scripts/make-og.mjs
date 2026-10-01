// Renders the share pictures in media/og/ from scripts/og.html (1200×630 JPEG, well under 1 MB).
//   node scripts/make-og.mjs     (needs playwright-core and a local Chrome or Edge; set BROWSER to its path)
// Serves the repo on a local port so the page can load the brand and orb pictures.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(fs.readFileSync(file));
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
fs.mkdirSync(path.join(root, 'media/og'), { recursive: true });
for (const p of ['home', 'boost', 'coaching', 'replay']) {
  await page.goto(`http://localhost:${port}/scripts/og.html?p=${p}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(root, `media/og/${p}.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
  console.log(`media/og/${p}.jpg`, fs.statSync(out).size, 'bytes');
}
await browser.close();
server.close();
