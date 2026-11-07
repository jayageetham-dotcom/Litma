# Cover backgrounds (phone app)

JPEG renders of the eight genre backgrounds in `apps/web/public/covers/*.svg` (1500 × 2220, the
same 1875 × 2775 proportions). The SVGs use blur filters that flutter_svg can't draw, so the app
shows these pictures instead. When a background changes on the web, render them again:

    python3 scripts/render-mobile-covers.py apps/web/public/covers apps/mobile/assets/covers

(needs `pip install playwright` and `python3 -m playwright install chromium`).
