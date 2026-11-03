# Litma — notes for Claude

Malayalam literary writing app. **npm-workspaces monorepo**: `apps/web` (Next.js 15 **static export**, basePath `/litma`, React 19 + Tailwind v4 + SCSS + Tiptap 2), `apps/desktop` (Electron, macOS + Windows), `apps/mobile` (Flutter, planned), shared `packages/*`. Backend: Supabase project `jdexadomaxjtxlvgtldu`. Hosted on cPanel at https://www.jayageetham.com/litma, deployed by `.github/workflows/deploy.yml` (FTPS, same pattern as the jayageetham website repo). The owner plans a native mobile app and a `litma.com` domain later.

## Every change covers every app (owner's standing rule)
- Treat each request as applying to **all** Litma apps: web, desktop (Electron) and mobile (Flutter, once it exists). Don't fix only the website.
- Web and desktop share the same code in `apps/web`, but the desktop app ships its own bundled copy. A push to `main` updates only the website. The desktop app gets the change only after Actions → **Release** builds new installers. So after any user-visible change, check whether it touches desktop-only code (`apps/desktop`, `window.litmaDesktop`, `NEXT_PUBLIC_DESKTOP` branches) and update that too.
- When the work is done, tell the owner plainly whether a Release is needed for the desktop app (and later the phone app) to get it, and offer to start it if this session can.
- Mobile (`apps/mobile`): until the Flutter app exists, note in its README any change the native app must mirror (shared strings in `packages/i18n`, tokens via `npm run tokens`, logic in `packages/shared`). Once it exists, make the same change there.

## Fairness (owner's standing rule)
- Never discriminate by religion, caste, race, community, region, gender, age or ability, in anything: UI text, sample and template content, dictionary lists, quotes, examples, AI prompts, MCP text and emails.
- Treat every community the same way. Their words, festivals, food, names and customs sit side by side as equals: never in an "other" or "also" section, never as an afterthought, never labelled by community (ഉമ്മ beside അമ്മ, not under "Muslim words").
- Draw examples, sample texts, names and quotes from all of Kerala's communities, not one.
- No caste names, slurs or words that rank people. When a source (Olam, Datuk) words a definition in a dated or one-sided way, don't repeat that wording in Litma's own text.
- Before finishing content work, check it for this.

## Release notes (owner's standing rule)
- **Never show commit messages or a list of changes in updates** (update card, download page). They confuse writers.
- `scripts/release.mjs` takes notes only from the Release workflow's optional **notes** box, which the owner fills in himself. Left empty, writers see no notes at all. Don't add "What's new" lines to commits.

## Working on this repo
- The repo lives on the owner's Mac at `~/Documents/Litma` (GitHub `jayageetham-dotcom/Litma`, branch `main`). Commit there; **the owner runs `git push`** (pushing to `main` deploys the site; the Supabase job deploys functions and runs `db push` when `SUPABASE_ACCESS_TOKEN` is set).
- Commit messages: imperative summary + short bullet body.
- After pulling the monorepo change, run `npm install` once at the root (the old root `node_modules` and `.next` can be deleted).
- Before committing: `npm run typecheck` and `npm run build` (root scripts forward to the workspaces).
- Local test build without Supabase ("local mode", no sign-in, data in localStorage): `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run build`, then `npm run preview` → http://localhost:4173/litma/. Playwright works against that (desk → pick a writing type → editor). Cloud-only flows (MCP, AI keys, AI hand-over, sharing) can't be exercised in local mode.
- Desktop test without packaging: build `npm run build:desktop -w @litma/web` in local mode, `node apps/desktop/scripts/copy-web.mjs`, `npm run build -w @litma/desktop`, then drive it with Playwright's `_electron.launch({ cwd: "apps/desktop", args: ["--no-sandbox", "."] })` (under `xvfb-run` on Linux). Check every route both by loading it and by clicking in-app links; a page missing from `apps/desktop/app/web` shows the black Next 404.
- Network from cloud sandboxes usually can't reach supabase.co, olam.in or jayageetham.com; use Supabase MCP tools for logs/SQL.
- FTP deploy must **never delete** server files (`public_html` also holds the main site and `/onnayi`); the workflow has a guard step against `--delete`.

## Rules
- No Next.js server features: no API routes, middleware, server actions or dynamic route segments. Use query params (`/write/?id=`, `/read/?s=`, `/book/?id=`, `/print/?doc=|book=`, `/desk/?view=books|trash`). Server work goes in `supabase/functions/*`.
- `packages/shared/src/*` (imported as `@litma/shared/<file>`) must stay dependency-free and import siblings with `.ts` extensions; `npm run sync:shared` copies it to `supabase/functions/_shared` (CI fails if they drift). The web build runs it.
- Workspace packages ship TypeScript source; `apps/web/next.config.ts` lists them in `transpilePackages`.
- Design tokens: edit `apps/web/src/styles/theme.css`, then `npm run tokens` to refresh `packages/tokens/tokens.json` (CI checks it) for the native apps.
- Paths below under `src/` mean `apps/web/src/`.
- Links: `next/link` handles the base path; raw `<a href>`/`window.location` need `BASE` / `appUrl()` from `src/lib/config.ts`.
- New tables: enable RLS with `(select auth.uid())` ownership policies, `to authenticated`, and run Supabase advisors.
- Never store raw MCP tokens — only SHA-256 hashes (`mcp_tokens.token_hash`). AI keys are per writer, AES-GCM encrypted in `ai_keys` (no RLS policies; only the `litma-ai` function touches them). No server-wide AI keys.
- New documents carry `settings.pristine = true` until the writer types; pristine docs are deleted on close and by the desk's cleanup. Story World cards closed without content are deleted too (`isBlankItem` in `src/lib/story.ts`).
- Don't change other users' data with SQL without asking the owner.

## Desktop (apps/desktop)
- Electron serves the web build (made with `npm run build:desktop -w @litma/web`, empty base path, `NEXT_PUBLIC_DESKTOP=1`) from `app://litma/`; `/dict/*` is fetched from the website. OAuth returns to the website's `/auth/callback/`, which the main process redirects into `app://litma/auth/callback/`. External links open in the browser. Preload exposes `window.litmaDesktop` (the home page hides its download section there).
- Downloads: `/download/` page (`app/download/page.tsx`) detects the OS (`lib/release.ts`: `detectPlatform`, `useRelease` reads latest.json, falling back to the releases repo) and leads with that platform; all platforms below, App Store / Google Play buttons as "Coming soon" until `STORE_LINKS` are filled (`components/StoreBadges.tsx`), install steps appear after a click. Download links: header (`DownloadNavLink` in `HomeNav` and `AppHeader`), hero (`HeroDownload`), home section and a card at the bottom of the desk (`DesktopDownload variant="card"`). All hidden inside the desktop app.
- Releases: `.github/workflows/desktop.yml` builds `Litma-<v>-mac.dmg` (universal) and `Litma-<v>-win.exe` and publishes them on GitHub Releases of the **public** repo `jayageetham-dotcom/litma-releases` (secret `RELEASES_TOKEN`; the cPanel quota can't hold installers, never upload them there). Only `latest.json` (with full download URLs + sha256) goes to `public_html/litma/downloads/`; the updater falls back to the releases repo's `latest/download/latest.json`. `DesktopDownload` on the home page reads `latest.json`. Signing is optional via secrets (see `apps/desktop/README.md`).

## Versions and releases
- One semver version for web, desktop and mobile: root `package.json` (+ every workspace), `CHANGELOG.md`. Don't bump by hand: Actions → **Release** (`release.yml`) runs `scripts/release.mjs`, commits `Release vX.Y.Z`, tags `vX.Y.Z`, then calls `deploy.yml` and `desktop.yml` (both `workflow_call`-able with a `ref`).
- Web: `next.config.ts` inlines `NEXT_PUBLIC_APP_VERSION` and `NEXT_PUBLIC_BUILD_ID` (version+commit); `scripts/write-version.mjs` writes `out/version.json`; `UpdateNotice` offers a reload when it changes. Settings → About shows the version.
- Desktop: `apps/desktop/src/updater.ts` reads `downloads/latest.json` (`desktop.version`, `minimumVersion`, per-platform file + sha256), downloads, verifies, installs (NSIS `/S --force-run`; macOS dmg swap script). The web app's `UpdateNotice` renders the card via `window.litmaDesktop` (`lib/desktop.ts`). `LITMA_UPDATE_FEED` / `LITMA_UPDATE_PLATFORM` env vars point it at a test server.
- `latest.json` also carries a `mobile` block (version, minimumVersion, store links) for the Flutter app.

## Map
- `src/extensions/` manglish · pagination (A4) · screenplay · blocks (styled blocks; legacy page breaks are stripped) · tools (metre, search, typewriter) · bold (`SmartBold`) · keep-selection
- `src/lib/store.ts` data layer (Supabase or localStorage) · `auth.tsx` guards/helpers · `functions.ts` Edge Function calls · `useLayout.ts` screen classes + keyboard inset
- `src/components/editor/Workspace.tsx` the editor shell; `Toolbar.tsx` (+ `MobileFormatStrip`); `Panels.tsx` (Outline, AI, Inbox, History, Keys, Page); `src/lib/autosave.ts` journal + cloud saver
- `src/components/story/StoryWorld.tsx` Story World (characters, places, objects, beat board, timeline, notes, reports); `src/lib/story.ts` field definitions per writing type (സാഹിത്യരൂപം)
- `src/lib/paginate.ts` print paginator; `src/lib/book-sections.ts` book/document → pages; `src/app/print` PDF view; `src/app/book` book editor
- `src/lib/dictionary.ts` + `scripts/build-dictionary.mjs` Olam dictionary/thesaurus (data built in CI into `apps/web/public/dict`); `components/SavedWords.tsx` bookmarks
- `src/components/landing/` home page (from the owner's Figma Make design, Nov 2026): `TypesShowcase` (night band, nine coloured type cards as tabs + real `TemplatePreview` page), `HowItWorks` (colourful bento of six demos), `Marquee` (tilted lime ribbon), `DesktopDownload variant="pop"` (violet card). Hero demo is `components/TryManglish.tsx` (self-typing with suggestions; visitors can click in and type real Manglish). `HeroActions`/`HomeNav`/`FooterCta` in `HomeActions.tsx` stay session-aware.
- `src/components/ui/` `Select` (custom dropdown), `Sheet` (bottom sheet / drawer / dock), `Confirm` (`useConfirm`); `src/components/icons/Typewriter.tsx`; `src/components/icons/Brands.tsx` shows the platform logos (Apple, Windows, Android, Google Play) for download links from `apps/web/public/brands/*.svg`: original files from the open `logos` collection (CC0, see its README). Never draw or edit brand logos; replace a file with the library's newer original. Only Apple's mark may switch to its white version (`onDark`). Use these, not generic icons, wherever a platform or store is named
- `supabase/functions/litma-mcp` MCP server (stateless Streamable HTTP, 30 tools incl. `suggest_edit`); `public/mcp.php` relays `/litma/mcp` to it. The cPanel firewall blocks data-centre callers, so cloud connectors (Claude.ai, ChatGPT) use `MCP_DIRECT_URL` (the function URL + `?key=`) — Settings shows it.
- `supabase/functions/litma-ai` streams Claude/GPT/Gemini with the writer's own key; `litma-transliterate` proxies Google Input Tools.

## Editor behaviour (keep these working)
- Pages flow naturally (Google Docs style): `extensions/pagination.ts` measures top-level blocks and inserts spacer decorations; breaks live in `paginationKey` state (`breaks[i].pos` = first block of page i+2). A page exists only while text reaches it, so deleting the last character of a page removes it.
- **Insert page** is the only way to force a page: the "+ Insert page" button in the gap between two sheets (always visible on touch) calls `insertPageAt(pos)`, adding `[pageBreak] [empty paragraph] [pageBreak]`. The `pageBreak` node is invisible and not selectable (no dashed line, no label, no toolbar button, no Ctrl+Enter: the owner found the visible component annoying). Backspace at the start of a page removes the break before it; on an empty inserted page it removes the whole page; Delete at a line end removes a following break. Don't add delete buttons for pages.
- Body text of every writing type is ragged-right (`text-align: start`) like Google Docs, in the editor and the PDF/book output, so short Malayalam lines never open wide word gaps (the owner asked twice). Justify only when the writer picks it on the toolbar. Indent/alignment rules use `> p:not(.sb)` so styled blocks (title, standfirst…) never inherit them.
- Reader view (`app/read`): one continuous sheet like a pageless Google Doc (inserted pages are a small pause, `.reader-sheet .page-break`), an outline beside it on wide screens, reading progress, one Close in the header. HTML for reading, books and print comes from `renderDocHtml` (`lib/doc-html.ts`), which adds the editor's `own-first-colour` class that plugins can't add in generateHTML.
- Novel/story drop cap (first letter after a chapter) uses the accent colour only when that letter has no text colour of its own; `FirstLetterColour` (extensions/blocks.ts) adds `.own-first-colour` to such paragraphs, because `::first-letter` would otherwise paint over the writer's colour.
- Text colour and highlight are two tools (`components/editor/ColorTools.tsx`): swatches, a custom colour picker with recent colours, "Automatic" / "None". Text swatches are fresh tones that each keep ≥ 4.5:1 on white paper. Coloured spans carry the colour as `--tc` with class `.tc` (Color extension in `extensions.ts`), so dark mode can show them lighter (OKLCH lightness ≥ 0.78) without changing the stored colour; highlighted text turns dark in dark mode.
- `extensions/keep-selection.ts` keeps the selection when the editor blurs (phones collapse it when the keyboard closes) and shows it as `.kept-selection`. Phones get a floating selection bar (Look up · Ask AI · B · I · Copy) and Look up / Ask AI buttons in the keyboard strip; sheets take `bottomOffset={kb}` so they sit above the on-screen keyboard.
- Malayalam input mode has a built-in **Enhanced InScript** keyboard (`src/keyboards/ml-inscript.json`, physical `KeyboardEvent.code` → text; `]` after consonant+് makes the atomic chillu). It only translates ASCII key output, so a system Malayalam keyboard passes through. Layout "system" leaves typing to the device (default on touch screens). Keyboard map popover in `KeyboardTools.tsx`.
- Manglish suggestions end with a "Keep English" row (the touch version of Esc); the popup measures against the visual viewport so it stays above the phone keyboard.
- Saved words: `bookmarks` in `store.ts` (table `word_bookmarks`, falls back to localStorage until the migration has run). Bookmark button in `DictionaryView`; `SavedWords` list on /dictionary (beside the dictionary on wide screens, a tab on phones) and as the editor's "Saved words" panel (tap to insert).
- Malayalam synonyms are ranked in `shared/dict.ts`: each word scores from every thesaurus set it appears in, weighted by how early that set's English headword comes in the entry's translations; single words before phrases.
- Bold: `toggleSmartBold` (Ctrl/⌘+B) can un-bold naturally bold blocks (titles, chapters) via `textStyle.fontWeight = "400"`; `boldIsOn()` drives the button state.
- Alignment buttons show for every writing type; disabled on screenplay scene/dialogue nodes.
- Metre marks (akshara count, laghu/guru) are hidden by default; toolbar toggle വൃത്തം and Ctrl/⌘+Alt+V, saved as `settings.showMetre`.
- Typewriter scrolling only follows the cursor right after typing keys (not on clicks or selection).
- Phones: no autofocus on open; the editor shows a keyboard accessory strip while focused and the tab bar otherwise.

## നാട്ടറിവ് (Dictionary tab, owner's rules)
- Categories of Malayalam words with English meanings, shown in the Dictionary as Look up · നാട്ടറിവ് · Saved. Data: `packages/shared/src/nattarivu.ts` (plain data, synced to `supabase/functions/_shared`; the mobile app ports it). UI: `components/Nattarivu.tsx`. URLs: `/dictionary/?view=nattarivu&c=<id>`; a word opens as `?w=<word>&from=<id>` with a chip back to its category.
- **Only words that have a dictionary entry whose meaning matches.** Never add a word without an entry, and drop a word whose entry means something else (ചമ്പ is dried fish, not the tala; ബുധൻ is not Wednesday, so the weekdays use ബുധനാഴ്ച). Check every word against the built `apps/web/public/dict` data (build it with `node scripts/build-dictionary.mjs --cache .dict-cache`) and read Datuk's definitions for the less common ones.
- Words that belong to Malayalam and Kerala. Leave out vocabulary shared across South Indian languages as a technical list (no ragas or Carnatic talas; Kerala-specific ones like ചെമ്പട, പഞ്ചാരി, സോപാനം are fine).
- Cover all of Kerala's communities evenly (Hindu, Muslim, Christian and others): festivals, food, dress, ornaments, arts, music and the words families use. Customs and festivals are fine; prayers, rituals and deities are not. No occupation words that double as caste names. Many Mappila and Christian words (ദഫ്മുട്ട്, മാർഗംകളി, നെയ്ച്ചോറ്, വട്ടയപ്പം…) are missing from Olam, and ഒപ്പന is there only as "agreement", so they can't be added until the dictionary has them.
- Familiar-first order, not alphabetical. English is a plain meaning; named art forms and instruments get a short description ("Kathakali, classical dance-drama").
- Sections: a line `# മലയാളം | English` starts one. Use sections when a category splits naturally (കല: art forms, instruments, folk games, festivals, music); no one-word sections; small related categories are merged into one with sections (കാലം holds seasons, months, birth stars, times of day, weekdays).
- Words from different communities for the same thing sit together as equals (ഉമ്മ and അമ്മച്ചി beside അമ്മ, ഇക്ക beside ചേട്ടൻ), never in a separate "other" section.
- Short category names (ഉപകരണങ്ങൾ, not നാടൻ ഉപകരണങ്ങൾ; ഭൂപ്രദേശം for terrain). Keep a word in one category. When a category is merged or renamed, keep its old id working in `MOVED`.
- Card titles stay on one line inside their card (long single words shrink to fit; on phones such a card spans the row).

## AI companion (Panels.tsx `AIPanel`)
- With an API key for the chosen provider (Claude/GPT/Gemini), answers stream into the panel.
- Without a key, or when the provider says the key has no credit / is invalid (`classifyAIError`), the panel shows Litma's own message (never the raw provider error) and an **Open Claude** button. It opens `https://claude.ai/new?q=` with a prompt from `claudeAppPrompt()` (work title + id, task, selected passage, "send with suggest_edit"), so it runs on the writer's own Claude plan. Afterwards the panel points to the **Assistant inbox** (`onOpenInbox`).
- If none of the writer's Litma tokens has ever been used (`last_used_at`), it says "Connect Litma to Claude first" with a button to `/settings/#mcp`.
- Claude Pro/Max does not include API credit; that's why the hand-over exists.

## Story World
- Beat/plot board columns are saved per work in `settings.beatColumns` (passed from Workspace as `columns`/`onColumns`). Columns: rename in place, remove when empty, drag (desktop) or ← → buttons. Cards: drag (desktop) or ↑ ↓ ← → buttons (always visible on touch).
- Esc in the card editor closes only the card (capture-phase listener).

## i18n
- UI strings live in `src/i18n/locales/<code>.json` (en is the source; others fall back to it). Use `useT()` from `@/i18n/react`: `t("desk.newWork")`, `t("common.words", { count })` (plural keys `_one`/`_other`). Add a language by adding a JSON file and a line in `LOCALES` (`src/i18n/index.ts`). The JSON is plain data so Electron and the Flutter app share it. Settings → Language switches it (per device, `litma:locale`). New UI text goes into the JSON files, not inline.

## Pictures (no uploads for now)
- Photo uploads are off to save storage cost: `PHOTO_UPLOADS = false` in `src/lib/config.ts` hides the profile photo, cover picture, author photo and Story World picture uploads (the upload code stays; flip the flag to bring them back). Pictures uploaded earlier still show and can be removed.
- Avatars: the owner's pictures in `apps/web/public/avatars/avatar-f-<n>.svg` and `avatar-m-<n>.svg` (list and order in `avatars.json`, shared with the desktop and phone apps), plus the writer's first letter in a `tint-*` colour. `components/art/Avatars.tsx` (`AVATAR_IMAGES`, `AvatarArt`, `profileAvatar`); pickers show the pictures alternating, side by side as equals, never labelled by gender. Saved as `preferences.avatar` / `preferences.avatarTint`; the back-cover author picture is `cover.authorAvatar`. An unknown id shows the first letter.
- Covers: eight print-ready genre backgrounds in `apps/web/public/covers/<id>.svg` (fantasy, thriller, romance, scifi, horror, literary, historical, selfhelp): 6 × 9 in + 0.125 in bleed, `viewBox="0 0 1875 2775"`, pure vector, no text; top 30% calm for the title, bottom 15% clear for the author. Their source is a generator kept outside the repo; edit the SVGs directly or replace them whole. `components/art/CoverArt.tsx` lists them with matching text/accent colours (`COVER_ART`), maps the first version's drawing ids (`MOVED`) and renders them as `<img>` (`CoverArtSvg`). Template `art` ("Artwork") fills the cover with one; the back cover repeats it mirrored under a scrim of the cover colour. Back-cover author picture is `cover.authorAvatar` (letter, avatar picture or none). The print view waits for the artwork to load before printing.
- Cover designer (`CoverFront` / `CoverBack` in `components/book/Cover.tsx`, `CoverDesigner` in `app/book/page.tsx`): a chosen background fills the cover in every design (Frame, Artwork, Solid colour, Big type, Minimal) and sets its matching colours. Title fonts (`COVER_FONTS`) include SMC's Karumbi, Dyuthi, Uroob, Meera and Rachana, bundled in `apps/web/public/fonts/smc` (SIL OFL, `@font-face` in `app/layout.tsx`). Title effects: drop shadow, background box. Divider: line, flourish or none. Edition badge (text defaults to Book details → edition), publisher mark. Parts in `COVER_PARTS` are draggable in the designer preview (arrow keys nudge, Shift for 5 mm) and keep `cover.offsets` in millimetres, so the PDF matches. Back cover: title and author beside the author picture in an offset frame, blurb, author note, and a white imprint strip (publisher box: Litma Publishing House by default, `DEFAULT_PUBLISHER`, until the writer names their own; genre line, cover credit, website, category, price and an EAN-13 barcode from the ISBN, `components/book/Barcode.tsx`).
- Cover presets (`COVER_PRESETS`, `presetPatch` in `Cover.tsx`): ten finished looks (layout + background + colours + title font + divider + title effects) shown as live mini previews of the writer's own cover; picking one, or another layout, clears dragged positions and sizes. New books start from "classic". Clicking a cover part selects it and shows a size slider (the title changes `titleScale`; other parts scale via `cover.sizes`). Re-check every preset by eye after changing a template or a background.
- Sample values (`lib/book-samples.ts`, `withSamples`): book details and cover fields that were never set (undefined/null) get real sample text when the book opens, so writers edit instead of filling blanks; a cleared field stays empty. The sample ISBN is all zeros with a valid check digit and must be replaced before printing.

## Loading
- `components/ui/Skeleton.tsx`: `Skeleton`, `SkeletonLines`, `DeskSkeleton`, `BooksSkeleton`, `EditorSkeleton`, `ListSkeleton`, `FormSkeleton`, `PagesSkeleton`, `InkLoader` (full screen: a nib writing a line under ലിറ്റ്മ), `InkDots`; CSS `.skeleton`, `.ink-spinner`, `.fade-in`, `.pop-in`, `.sheet-up` in globals.css. Shape skeletons like the content that is coming; don't use bare spinners.

## Design system
- **All tokens live in `src/styles/theme.css`** (light in `:root`, dark in `.dark`): canvas · surface · subtle · paper · header · ink · muted · line · primary · accent (violet, from the home page) · highlight (amber) · tint-* (violet, coral, sky, lime, tangerine) · danger, option-hover/selected, demo-*, plus radius, shadows, fonts and the solid `--brand` / `--brand-mark`. Edit there to restyle the app.
- Contrast: text tokens meet WCAG AA (muted ≥ 6:1, highlight ≥ 4.5:1 on its soft background); `--line` is for decorative dividers, `--line-strong` (≥ 3:1) for field, select and outline-button edges. Disabled filled buttons use `--disabled-bg/-ink`, not opacity. Danger buttons: `.btn-danger`.
- Use the generated classes (`bg-surface`, `text-accent`, `bg-primary text-primary-ink`, `text-highlight`…); never hard-code colours in components. Buttons: `.btn` + `btn-primary` (ink-black) / `btn-accent` (indigo) / `btn-outline` / `btn-ghost`. Top bars: `.app-bar` (sticky, translucent) or `bg-header`.
- Inside the app the home page's freshness shows only lightly, so writers keep their focus: a faint lilac canvas, the violet accent, `tint-*` colours on tool icons (each editor rail tool and phone "More" tile has its own, via `tint`) and a small dot per writing type on desk cards (`kindDot` in `src/lib/tints.ts`, same order as the home page). Never tint text, the page or large surfaces in the app.
- App chrome stays calm: the logo is solid ink `ലിറ്റ്മ` with an indigo dot (`.brand-text`), thin accent lines `.brand-bar`, no gradients in the app (the owner rejected Instagram-like ones there).
- The home page is the exception: it uses the colourful landing palette (`--mist`, `--night`, `--violet`, `--coral`, `--lime`, `--sky`, `--tangerine`, `--on-pop` for text on bright fills, `--violet-text`/`--coral-text` for AA text), soft blurred colour fields, and the lime→sky→violet gradient on the footer line. The owner approved these gradients. `.on-night` re-maps ink/muted/line for dark bands; Latin text there uses `--font-landing` (Manrope).
- The document page uses `--paper` so writing stays black on white; colour belongs to the chrome, not the text. Page thumbnails (`.tpl-preview`) are ragged-right so tiny justified lines don't look gappy.
- Fonts: Inter for Latin UI, Anek Malayalam for display/Malayalam UI, Noto Serif/Sans Malayalam, Manjari, Gayathri etc. for documents.

## Layout (mobile-first, mirrors the planned native app)
- `useScreen()` in `src/lib/useLayout.ts`: phone < 768 · tablet < 1280 · desktop < 1536 · wide.
- Phones: bottom tab bars (`MobileNav` on desk/dictionary/profile/settings; Format · Contents · Story · Dictionary · More in the editor; Contents · Page · Details in the book editor), panels as bottom sheets (`components/ui/Sheet.tsx`), a keyboard accessory (`MobileFormatStrip`) while writing, floating New work / New book button on the desk.
- Viewport has `maximum-scale=1` and fields are 16px on phones so iPhone Safari doesn't zoom the app on focus (that zoom made sheets look cut off).
- Tablets/laptops: editor panels slide **over** the page (never shrink it); they dock only on wide screens. The right rail is icons only and expands with labels on hover (or keyboard focus).
- Each panel shows its title once (in the Sheet header); don't add a second heading inside panels. Panels have roomy padding (px-5 py-5) and group their controls into small titled sections with a tint dot (see `AIPanel`: "For the whole work" / "For selected text" / "Ask in your own words").
- Dialogs and bottom sheets: `.scrim` on the backdrop and `.dialog` on the panel (tokens `--scrim`, `--dialog`, `--dialog-edge`, `--dialog-shadow`). Never `bg-black/40` + `bg-canvas`: in dark mode the panel vanished into the page.
- Global `.btn` sets `display`, so hide buttons with `max-md:!hidden`, not `hidden md:inline-flex`. Touch-only visibility: `[@media(hover:none)]:opacity-100`.
- Dropdowns, menus and suggestion popups: padded list (`p-1.5`), a 2px gap between rows and gently rounded rows (`rounded-[6px]`; note `rounded-lg` here is the 18px `--radius-lg` token), so the hover and selected highlights never touch.
- No native `<select>`: use `components/ui/Select.tsx` (accessible combobox + listbox, keyboard and type-ahead, portal so toolbars never clip it; `preventFocusSteal` for editor pickers). Confirmations use `useConfirm()` from `components/ui/Confirm.tsx`, not `window.confirm` (a few old ones remain in Story World card delete and version restore).
- Landing/auth are session-aware: signed-in writers never see Sign in / Create account (`HomeActions.tsx`, `useRedirectIfSignedIn`). Logo links to `/desk/` when signed in. Home also forwards stray `?code=` / `#access_token` to `/auth/callback/`.
- Public pages (home, /login, /signup, /forgot-password, /reset-password, /auth/callback, /download) share the colourful landing style and are **always light**: their root carries `.landing`, and `html:has(.landing)` in theme.css takes the light values over `.dark` (the `dark:` variant skips them too). No theme toggle there; the writer's theme applies once inside the app. Shared pieces: `components/landing/LandingChrome.tsx` (`LandingNav` pill nav, `ColourField` hero background, `LandingFooter` with the gradient line). `.landing` also makes buttons pills, rounds fields and sets violet as the accent.
- `AuthShell.tsx` frames the auth screens: the form card on a stack of violet/lime sheets, and a night quote card (M. T. Vasudevan Nair on sign-in, Vaikom Muhammad Basheer on sign-up); `quote={false}` gives one centred card, `switchTo` puts the other way in (Sign in / Create account) in the nav. Password fields have a show/hide eye button.

## Auth emails
- Branded templates are generated by `node scripts/build-email-templates.mjs` into `supabase/templates/*.html` (+ `subjects.json`; site URL at the top of the script, switch to litma.com later). The owner pastes them into Supabase → Authentication → Emails → Templates. Sender "Litma <no-reply@…>" needs custom SMTP in Supabase (cPanel mailbox or a service like Resend). Don't run `supabase config push` until the rest of `[auth]` is described in `config.toml`.

## MCP servers (.mcp.json)
- `supabase` — hosted Supabase MCP for this project (OAuth on first use)
- `litma` — Litma's own server; set `LITMA_MCP_TOKEN` (Settings → MCP)

## Copy
- Plain, human wording in UI text, emails and MCP descriptions. No em dashes (—) or filler phrasing; use a full stop, comma, colon or brackets instead. "—" is fine only as an empty-value placeholder.

## Vocabulary
- Novel, story, poem, screenplay… are **writing types — സാഹിത്യരൂപം** (plural സാഹിത്യരൂപങ്ങൾ). Never call them "forms" in UI, docs or MCP text. (Code keeps the `kind` / `DocKind` / `shared/forms.ts` names.)
- Character/location notes are **Story World — കഥാലോകം**. Avoid religious terms.
- Say "any AI assistant", not specific vendors like IBM Bob.

## Open items
- Branded auth emails: paste templates and set up custom SMTP (owner, in the Supabase dashboard).
- Optional branded MCP URL (host firewall allow-list for `/litma/mcp`, or a subdomain via Supabase custom domain / Cloudflare Worker).
- Remaining native `confirm()` calls (Story World card delete, version restore) could move to `useConfirm()`.
