# Mac App Store screenshots (2880 x 1800)

Made from the website in local mode at 1440 x 900, Retina (2x), filled with the reviewer account's works
(`seed_data.py`, read from jagath.gj+review@gmail.com; long works cut to their opening).

1. `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run build` (with the dictionary built into
   apps/web/public/dict), then `npm run preview` (http://localhost:4173).
2. `cd marketing/reels/capture && npm install && node make-fonts-css.cjs` (fonts without Google Fonts).
3. `python3 shoot.py` (Python Playwright with Chrome) → `raw/*.png`; paths in `common.py`.
4. Caption and colour: same as the iPhone/iPad sets (see the compose step in the session that made them:
   caption Inter Bold 104 px at y 190, screen 1430 px tall at y 330 with rounded corners and a soft shadow).
