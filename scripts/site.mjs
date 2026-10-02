// Everything the build (scripts/build.mjs) needs to know about the site: the production address, the brand, and one
// entry per page with its title, description and search settings. Edit here, then run `node scripts/build.mjs`.
export const SITE = {
  origin: 'https://plus25dota.com',
  name: 'Plus 25',
  themeColor: '#06070d',
  locale: 'en_US',
  // Real contact details go here once confirmed; empty values are left out of the page and the structured data.
  // TODO(owner): support email, and a business address if you want one shown.
  email: '',
  discordInvite: 'https://discord.com/invite/Hm8dxu2Uy',
};

// The site's one main action: shown in the home page's hero and in the phone bar on pages without their own.
export const PRIMARY_CTA = { label: 'Order MMR boost', href: 'mmr-boost.html#calculator' };

// index: false keeps a page out of search (noindex) and out of the sitemap.
// og: the share picture in media/og/, 1200×630. cta: the phone bar's button (false for none).
// schema: extra structured data for the page (see build.mjs).
export const PAGES = [
  {
    file: 'index.html', path: '', index: true, og: 'home',
    title: 'Dota 2 MMR Boost, Coaching & Replay Analysis | Plus 25',
    description: 'Climb the Dota 2 ladder your way: MMR boosting from $22, live one-to-one coaching and replay analysis from high-MMR players. Pick a service, see your price.',
    schema: ['website'],
  },
  {
    file: 'mmr-boost.html', index: true, og: 'boost',
    title: 'Dota 2 MMR Boost from $22: Offline, Live-Tracked | Plus 25',
    description: 'Dota 2 MMR boosting by top-ladder players, +25 a win. Offline mode, region-matched VPN, live match tracking and bonus MMR. Set your goal and see your price.',
    cta: { label: 'Calculate my boost', href: '#calculator' },
    schema: [{ service: 'Dota 2 MMR boosting', name: 'MMR boost', lowPrice: 22 }],
  },
  {
    file: 'coaching.html', index: true, og: 'coaching',
    title: 'Dota 2 Coaching – 1-on-1 with a High-MMR Coach | Plus 25',
    description: 'Live one-to-one Dota 2 coaching on Discord: review games together, play while your coach watches, and leave with drills for your role and heroes. From $25.',
    cta: { label: 'Book coaching', href: '#order' },
    schema: [{ service: 'Dota 2 coaching', name: 'Coaching', lowPrice: 25, highPrice: 190 }],
  },
  {
    file: 'replay-analysis.html', index: true, og: 'replay',
    title: 'Dota 2 Replay Analysis by High-MMR Analysts | Plus 25',
    description: 'Send your match IDs and a high-MMR analyst breaks down your Dota 2 replays: timestamped notes on laning, fights, draft and items, delivered in 48 hours.',
    cta: { label: 'Order an analysis', href: '#order' },
    schema: [{ service: 'Dota 2 replay analysis', name: 'Replay analysis', lowPrice: 15, highPrice: 69 }],
  },
  {
    file: 'careers.html', index: true, og: 'home',
    title: 'Become a Dota 2 Booster or Coach – Apply Now | Plus 25',
    description: 'Work with Plus 25 as a Dota 2 booster, coach or replay analyst. Tell us your rank, roles and region, link your match history, and we reply on Discord.',
    cta: { label: 'Apply now', href: '#apply' },
  },
  {
    file: 'contact.html', index: true, og: 'home',
    title: 'Contact Us – Dota 2 Boosting & Coaching Support | Plus 25',
    description: 'Questions about a Dota 2 boost, coaching session or replay analysis? Reach the Plus 25 team on Discord, or find out how to get help with an existing order.',
  },
  {
    file: 'privacy.html', index: true, og: 'home',
    title: 'Privacy Policy: What Data We Collect and Why | Plus 25',
    description: 'What Plus 25 collects when you order or log in, why we need it, which services handle it, how long we keep it, and how to see, change or delete your data.',
  },
  {
    file: 'terms.html', index: true, og: 'home',
    title: 'Terms of Service for Dota 2 Boosting & Coaching | Plus 25',
    description: 'The terms for ordering Dota 2 MMR boosting, coaching and replay analysis from Plus 25: orders, payment, account risk, refunds, conduct and your rights.',
  },
  { file: 'checkout.html', index: false, og: 'home', cta: false, title: 'Checkout | Plus 25', description: 'Confirm your Plus 25 order and join our Discord to get started.' },
  { file: 'thank-you.html', index: false, og: 'home', cta: false, title: 'Order received | Plus 25', description: 'Your Plus 25 order is in. Join our Discord and post your order code to get started.' },
  { file: 'login.html', index: false, og: 'home', cta: false, title: 'Log in | Plus 25', description: 'Log in to Plus 25 to track your orders and get member pricing.' },
  { file: 'account.html', index: false, og: 'home', cta: false, title: 'Your account | Plus 25', description: 'Your Plus 25 account: orders and member pricing.' },
  { file: '404.html', index: false, og: 'home', root: true, title: 'Page not found | Plus 25', description: 'This page doesn\'t exist. Find Dota 2 MMR boosting, coaching and replay analysis at Plus 25.' },
  { file: '500.html', index: false, og: 'home', root: true, cta: false, title: 'Something went wrong | Plus 25', description: 'Something went wrong on our side. Please try again in a moment.' },
];
