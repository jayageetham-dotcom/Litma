# Instagram reels for Litma

How the Litma reels are made, so the next one is quick and still looks like a person made it.
Sources live in `marketing/reels/`. Claude can do all of this with the **litma-reels** skill
(prompts at the end).

## What's there

| Folder | What it is |
| --- | --- |
| `marketing/reels/capture/` | Playwright scripts that screen-record the real app at phone size (1080 × 1920) with human typing rhythm, and grab each writing type's real first page. |
| `marketing/reels/reel-manglish/` | Reel 1, **HyperFrames** (HTML + GSAP). A short story typed in Manglish turns into Malayalam. 16 s. |
| `marketing/reels/reel-types/` | Reel 2, **Remotion** (React). Nine writing types land on the desk as a pile. 16.7 s. |

Footage, pages and renders are not committed (`marketing/reels/.gitignore`); the capture scripts
make them again in about a minute.

## One-time setup on the Mac

```bash
brew install node ffmpeg yt-dlp whisper-cpp     # Node 22+, FFmpeg, yt-dlp, Whisper (fast C++ build)
pip3 install -U openai-whisper                 # optional: the Python Whisper too
cd ~/Documents/Litma/marketing/reels/capture && npm install && npx playwright install chromium
cd ../reel-types && npm install                 # Remotion
# HyperFrames needs no install: its scripts run `npx hyperframes@0.9.26`
```

## Make the footage

```bash
cd ~/Documents/Litma
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run build   # local mode, no sign-in
npm run preview                                                         # http://localhost:4173, leave it running
cd marketing/reels/capture
npm run all        # fonts, then story.mp4, picker.mp4 and the nine pages
```

`npm run story`, `npm run picker` or `npm run pages` re-make one piece. `LITMA_URL=https://getlitma.in`
records the live site instead (the local-mode note is hidden either way; signed-in writers never see it).

## Preview, change, render

```bash
cd marketing/reels/reel-manglish && npm run dev      # HyperFrames Studio; npm run check; npm run render
cd marketing/reels/reel-types   && npm run dev       # Remotion Studio; npm run render
```

Renders land in `reel-manglish/renders/` and `reel-types/out/`. If you re-record the footage, look at the
frames again: reel 1's cuts point at seconds inside `story.mp4` (`data-media-start` in `index.html`).

## The rules that keep it from looking generated

- **Only the real product.** Screen recordings of the actual app and its real pages. No phone mockups,
  no invented screens, no redrawn logo (use `apps/desktop/build/icon.png` and the `ലിറ്റ്മ.` wordmark in
  Anek Malayalam 800 with the violet dot).
- **One small story per reel**, told by the footage: someone types a line, a pile of pages grows.
  Not a feature list, not three cards in a row.
- **Captions look like Instagram's own text tool**: a black (or brand-colour) box, bold Anek Malayalam,
  short Malayalam lines a person would type. They pop in and leave on a cut. No sliding, fading, glow.
- **Cuts like a phone editor**: hard zoom cuts, sped-up typing, one camera move at most. Clean screen
  recordings get no grain.
- **Banned**: dark voids with floating UI, glow, particles, purple mesh gradients, glass cards, swooshes,
  emoji walls, "AI-powered", "seamless", "unlock", "in seconds".
- **True claims only**, from getlitma.in (for example "Free to use", "nine writing types",
  "എഴുതൂ, മലയാളത്തിൽ."). No em dashes.
- **Fairness** (CLAUDE.md): names, words and sample lines from all of Kerala's communities side by side
  (reel 1 has മീര and ഉമ്മ; the pages have റസിയ, ലിസി മാത്യു, രാഹുൽ). Never labelled by community.

## Instagram specs

- 1080 × 1920, 30 fps, H.264, under 90 s (15 to 20 s works best).
- Everything that must be read sits between y 168 and y 1330 (Instagram's top bar and the caption,
  handle and buttons cover the rest); nothing under the right-hand button column.
- Frame 0 is the cover: it already shows the hook (reel 1 opens on "mazha" being typed).
- The reels are **silent on purpose**: add a track in Instagram's own music picker (licensed for
  Reels). Cuts sit on a steady grid (0.5 s in reel 1, 0.9 s in reel 2), so most tracks line up.

## Prompts for Claude

With the **litma-reels** skill installed, start a session on the Litma folder and say:

- "Make a Litma reel about the dictionary's നാട്ടറിവ് tab: someone looks up a word their grandmother used."
- "New reel: a poem being typed, then വൃത്തം marks turned on. 9:16, about 15 s, Remotion."
- "Make a reel of the cover designer: a writer tries three presets and picks one. HyperFrames."
- "Re-record reel 1 with a different opening line and render it again."
- "Make an English-caption version of reel 2 for readers outside Kerala."

The skill reads this file, records real footage, writes the captions in plain Malayalam, renders a
1080 × 1920 MP4 and checks the frames before handing it over.
