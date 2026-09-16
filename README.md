# Plus 25 — Dota 2 replay analysis, coaching and MMR boosting

A static site served by GitHub Pages straight from this repository's root. One page per service, each tied to one of
Invoker's orbs:

| Page | Orb | What's on it |
| --- | --- | --- |
| `index.html` | all three | 3D scroll story (Invoker, the Astral Grimoire, the orbs) introducing the services, service cards, reviews, blog |
| `replay-analysis.html` | Quas | Order form, guarantee, about, how it works, packages, reviews, FAQ |
| `coaching.html` | Wex | Same layout as replay analysis, for coaching sessions |
| `mmr-boost.html` | Exort | MMR calculator (runes, options, bonus MMR, medals) plus the same sections |

Customer accounts: `login.html` and `account.html`, backed by Supabase (`js/supabase.js`, `js/login.js`,
`js/account.js`). They stay switched off until the project URL and public key are added; setup steps and the
database schema are in [`supabase/`](supabase/README.md).

Shared files: `css/site.css` (all styles), `js/site.js` (nav, package cards, reviews carousel), `js/order.js` (order
forms on replay analysis and coaching), `js/boost.js` (MMR calculator and the grimoire beside it). The 3D scenes are
in `js/scene.js` (home story), `js/calcbook.js` (the grimoire, on home and the boost page) and `js/heroorb.js` (each
service page's orb in its header).

## Run it locally

The pages use JavaScript modules, which browsers won't load from a double-clicked file, so serve the folder:

```bash
python3 -m http.server 5178
```

Then open http://localhost:5178/. Add `?debug` to the URL for the dev capture hooks (`window.__invoke`).

## Replace before launch

- **MMR boost prices** — set 10% under VikingDOTA's MMR boost, from their price formula (checked 2026-09-15). The
  `PRICING` table in `js/boost.js` drives both the calculator and the package cards' "from" prices; re-check if Viking
  changes rates. Boost types Bounty / Haste / Double Damage use Viking's Eco / Plus / Ultimate rates, bonus MMR tiers
  and options (`OPTIONS`). The MMR cap is 7,000. The home page's "from $22" is written by hand.
- **Replay analysis and coaching prices and packages** are placeholders, set in each page's order form
  (`data-price`) and package cards, and on the home page's service cards.
- **Guarantees and FAQ answers** on every service page are draft promises; confirm each one before launch.
- **Reviews** and **blog posts** are samples for layout. Show only real reviews, with their real rating and count.
- **Checkout** buttons show a "not live yet" note: payments and order creation still need to be built (custom, no Shopify).

## Credits

Invoker model: "Invoker DOTA 2" by ansaldotoys2 (https://sketchfab.com/ansaldotoys2), licensed under CC-BY-4.0 —
see `models/invoker/license.txt`. Rank medal icons in `media/medals/` are 64px images wrapped in SVG, made from the
supplied medal PNGs. Dota 2 is a trademark of Valve Corporation; Plus 25 is not affiliated with Valve.
