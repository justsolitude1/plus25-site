# Plus 25 — Dota 2 MMR boosting site

A static site: a 3D scroll story (Invoker, the Astral Grimoire, and the Quas / Wex / Exort orbs), an MMR
calculator, pricing, reviews and blog. Served by GitHub Pages straight from this repository's root.

## Run it locally

The page uses JavaScript modules, which browsers won't load from a double-clicked file, so serve the folder:

```bash
python3 -m http.server 5178
```

Then open http://localhost:5178/. Add `?debug` to the URL for the dev capture hooks (`window.__invoke`).

## Replace before launch

- **Prices** — the `PRICING` table in `index.html` (calculator rates) and the three tier cards.
- **Reviews** and **blog posts** are samples for layout.
- **Story copy** (region-matched VPN, pause anytime, replay-vetted boosters…) is draft text.

## Credits

Invoker model: "Invoker DOTA 2" by ansaldotoys2 (https://sketchfab.com/ansaldotoys2), licensed under CC-BY-4.0 —
see `models/invoker/license.txt`. Dota 2 is a trademark of Valve Corporation; Plus 25 is not affiliated with Valve.
