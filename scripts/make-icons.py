# Builds the browser and home-screen icons from the brand's +25 icon (brand/plus25-icon-square.png / .svg).
#   python scripts/make-icons.py      (needs Pillow)
# Small sizes use a tighter crop so "+25" stays legible in a browser tab.
import json, re
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
src = Image.open(root / 'brand/plus25-icon-square.png').convert('RGBA')   # 1024×1024, "+25" centred on the site's void
tight = src.crop((142, 142, 882, 882))                                    # the mark with a little margin

tight.resize((48, 48), Image.LANCZOS).save(root / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
src.resize((180, 180), Image.LANCZOS).convert('RGB').save(root / 'apple-touch-icon.png', optimize=True)
for s in (192, 512):
    src.resize((s, s), Image.LANCZOS).convert('RGB').save(root / f'icon-{s}.png', optimize=True)

# the vector icon: the brand SVG, cropped the same way as the small PNGs
svg = (root / 'brand/plus25-icon-square.svg').read_text(encoding='utf8')
x, y, w, _ = map(float, re.search(r'viewBox="([^"]+)"', svg).group(1).split())
k = w / 1024
svg = re.sub(r'viewBox="[^"]+"', f'viewBox="{x + 142 * k:.2f} {y + 142 * k:.2f} {740 * k:.2f} {740 * k:.2f}"', svg, count=1)
svg = re.sub(r' width="\d+" height="\d+"', '', svg, count=1)
(root / 'icon.svg').write_text(svg, encoding='utf8')

(root / 'site.webmanifest').write_text(json.dumps({
    'name': 'Plus 25: Dota 2 MMR boost, coaching and replay analysis',
    'short_name': 'Plus 25',
    'start_url': '/',
    'display': 'standalone',
    'background_color': '#06070d',
    'theme_color': '#06070d',
    'icons': [
        {'src': '/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': '/icon.svg', 'sizes': 'any', 'type': 'image/svg+xml'},
    ],
}, indent=2) + '\n', encoding='utf8')
print('icons written')
