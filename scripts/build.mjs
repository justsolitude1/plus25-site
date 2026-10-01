// Stamps the shared parts of every page from scripts/site.mjs, then writes the files search engines read.
//   node scripts/build.mjs
// - the SEO block in each page's head, between <!-- seo --> and <!-- /seo -->: title, description, canonical, robots,
//   share cards, icons and structured data (JSON-LD). A service page's FAQ markup is read from its own <details>.
// - the footer, phone call-to-action bar and Discord chat button, between <!-- foot --> and <!-- /foot -->
// - js/config.js (the Discord invite and support email, for the scripts that need them)
// - sitemap.xml (indexable pages, lastmod from git) and robots.txt
// Run it after changing site.mjs or adding a page; it only rewrites files whose output changed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SITE, PRIMARY_CTA, PAGES } from './site.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => { if (!fs.existsSync(path.join(root, f)) || read(f) !== s) { fs.writeFileSync(path.join(root, f), s); console.log('wrote', f); } };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const urlOf = (p) => `${SITE.origin}/${p.path ?? p.file}`;
const ORG_ID = `${SITE.origin}/#organization`;
const warnings = [];

/* ---------- structured data ---------- */
function organization() {
  return {
    '@type': 'Organization', '@id': ORG_ID, name: SITE.name, url: `${SITE.origin}/`,
    logo: `${SITE.origin}/brand/plus25-icon-square.png`,
    ...(SITE.email && { email: SITE.email, contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: SITE.email } }),
    ...(SITE.discordInvite && { sameAs: [SITE.discordInvite] }),
  };
}
// the page's own FAQ, as written in its <details><summary>…</summary><p>…</p></details>
function faqFrom(html) {
  const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const items = [...html.matchAll(/<details><summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map(([, q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } }));
  return items.length ? { '@type': 'FAQPage', mainEntity: items } : null;
}
function schemaFor(page, html) {
  const graph = [organization()];
  for (const s of page.schema || []) {
    if (s === 'website') graph.push({ '@type': 'WebSite', '@id': `${SITE.origin}/#website`, url: `${SITE.origin}/`, name: SITE.name, publisher: { '@id': ORG_ID } });
    else if (s.service) {
      graph.push({
        '@type': 'Service', name: s.name, serviceType: s.service, url: urlOf(page), provider: { '@id': ORG_ID }, areaServed: 'Worldwide',
        offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: s.lowPrice, ...(s.highPrice && { highPrice: s.highPrice }) },
      });
      graph.push({ '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.origin}/` },
        { '@type': 'ListItem', position: 2, name: s.name, item: urlOf(page) },
      ] });
      const faq = faqFrom(html);
      if (faq) graph.push(faq);
    }
  }
  // < in JSON can't close the script tag early
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

/* ---------- the head's SEO block ---------- */
function seoBlock(page, html) {
  const r = page.root ? '/' : '';   // error pages are served at any address, so they link from the site root
  const og = `${SITE.origin}/media/og/${page.og}.jpg`;
  if (!fs.existsSync(path.join(root, `media/og/${page.og}.jpg`))) warnings.push(`${page.file}: missing media/og/${page.og}.jpg`);
  const lines = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.index ? `<link rel="canonical" href="${urlOf(page)}">` : '<meta name="robots" content="noindex">',
    // copies of the site anywhere but the real domain (the GitHub Pages mirror, previews) stay out of search
    `<script>if(!/^(www\\.)?plus25dota\\.com$|^localhost$|^127\\.0\\.0\\.1$/.test(location.hostname)){var m=document.createElement('meta');m.name='robots';m.content='noindex';document.head.appendChild(m)}</script>`,
    `<meta name="theme-color" content="${SITE.themeColor}">`,
    `<link rel="icon" href="${r}favicon.ico" sizes="48x48">`,
    `<link rel="icon" href="${r}icon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${r}apple-touch-icon.png">`,
    `<link rel="manifest" href="${r}site.webmanifest">`,
    `<meta property="og:site_name" content="${esc(SITE.name)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="${SITE.locale}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${urlOf(page)}">`,
    `<meta property="og:image" content="${og}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(SITE.name)}: Dota 2 MMR boost, coaching and replay analysis">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    `<meta name="twitter:image" content="${og}">`,
  ];
  if (page.index) lines.push(`<script type="application/ld+json">${schemaFor(page, html)}</script>`);
  return lines.join('\n');
}

/* ---------- the footer, the phone CTA bar and the chat button ---------- */
function footBlock(page) {
  const r = page.root ? '/' : '';
  const link = (href, text) => `<li><a href="${r}${href}"${page.file === href ? ' aria-current="page"' : ''}>${text}</a></li>`;
  const cta = page.cta === false ? null : page.cta || PRIMARY_CTA;
  const ctaHref = cta && (cta.href.startsWith('#') ? cta.href : r + cta.href);
  return [
    '<footer class="site-foot">',
    '  <div class="foot-in">',
    '    <nav class="foot-nav" aria-label="Footer">',
    '      <ul>' + [link('replay-analysis.html', 'Replay analysis'), link('coaching.html', 'Coaching'), link('mmr-boost.html', 'MMR boost'), link('careers.html', 'Work with us')].join('') + '</ul>',
    '      <ul>' + [link('contact.html', 'Contact'), link('privacy.html', 'Privacy'), link('terms.html', 'Terms')].join('') + '</ul>',
    '    </nav>',
    `    <p>No tracking or advertising cookies. <a href="${r}privacy.html#storage">What we store</a></p>`,
    `    <p>© ${new Date().getFullYear()} ${esc(SITE.name)}. Not affiliated with Valve Corporation. Dota 2 is a trademark of Valve Corporation.</p>`,
    '  </div>',
    '</footer>',
    ...(SITE.discordInvite ? [
      `<a class="chat-fab" href="${esc(SITE.discordInvite)}" target="_blank" rel="noopener" aria-label="Chat with us on Discord (opens in a new tab)">`,
      '  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>',
      '  <span class="chat-fab-label">Live chat</span>',
      '</a>',
    ] : []),
    ...(cta ? [
      '<div class="sticky-cta is-hidden" data-sticky-cta>',
      `  <a class="btn btn-gold" href="${ctaHref}">${esc(cta.label)}</a>`,
      '</div>',
    ] : []),
  ].join('\n');
}

const between = (html, tag, body, file) => {
  const re = new RegExp(`<!-- ${tag} -->[\\s\\S]*?<!-- /${tag} -->`);
  if (!re.test(html)) { warnings.push(`${file}: no <!-- ${tag} --> markers`); return html; }
  return html.replace(re, () => `<!-- ${tag} -->\n${body}\n<!-- /${tag} -->`);
};

/* ---------- pages ---------- */
for (const page of PAGES) {
  if (!fs.existsSync(path.join(root, page.file))) { warnings.push(`${page.file}: listed in site.mjs but missing`); continue; }
  let html = read(page.file);
  html = between(html, 'seo', seoBlock(page, html), page.file);
  html = between(html, 'foot', footBlock(page), page.file);
  write(page.file, html);
  if (page.index) {
    if (page.title.length < 50 || page.title.length > 60) warnings.push(`${page.file}: title is ${page.title.length} chars (aim for 50–60)`);
    if (page.description.length < 140 || page.description.length > 160) warnings.push(`${page.file}: description is ${page.description.length} chars (aim for 140–160)`);
  }
}
const titles = PAGES.map((p) => p.title), descs = PAGES.map((p) => p.description);
if (new Set(titles).size !== titles.length) warnings.push('two pages share a title');
if (new Set(descs).size !== descs.length) warnings.push('two pages share a description');

/* ---------- config for the page scripts ---------- */
write('js/config.js', `// Written by scripts/build.mjs from scripts/site.mjs; edit it there.\nexport const DISCORD_INVITE = ${JSON.stringify(SITE.discordInvite)};\nexport const SUPPORT_EMAIL = ${JSON.stringify(SITE.email)};\n`);

/* ---------- sitemap and robots ---------- */
function lastmod(file) {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd: root, encoding: 'utf8' }).trim();
    if (d) return d.slice(0, 10);
  } catch { /* not a git checkout */ }
  return fs.statSync(path.join(root, file)).mtime.toISOString().slice(0, 10);
}
const urls = PAGES.filter((p) => p.index).map((p) => `  <url><loc>${urlOf(p)}</loc><lastmod>${lastmod(p.file)}</lastmod></url>`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
write('robots.txt', [
  'User-agent: *',
  'Disallow: /api/',
  'Disallow: /mobile-preview.html',
  'Disallow: /loader-preview.html',
  '',
  `Sitemap: ${SITE.origin}/sitemap.xml`,
  '',
].join('\n'));

if (warnings.length) { console.warn('\n' + warnings.map((w) => '! ' + w).join('\n')); process.exitCode = 1; }
else console.log('build ok');
