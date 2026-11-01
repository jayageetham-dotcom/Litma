# Litma — notes for Claude

Malayalam literary writing app. **npm-workspaces monorepo**: `apps/web` (Next.js 15 **static export**, basePath `/litma`, React 19 + Tailwind v4 + SCSS + Tiptap 2), `apps/desktop` (Electron, macOS + Windows), `apps/mobile` (Flutter, planned), shared `packages/*`. Backend: Supabase project `jdexadomaxjtxlvgtldu`. Hosted on cPanel at https://www.jayageetham.com/litma, deployed by `.github/workflows/deploy.yml` (FTPS, same pattern as the jayageetham website repo). The owner plans a native mobile app and a `litma.com` domain later.

## Working on this repo
- The repo lives on the owner's Mac at `~/Documents/Litma` (GitHub `jayageetham-dotcom/Litma`, branch `main`). Commit there; **the owner runs `git push`** (pushing to `main` deploys the site; the Supabase job deploys functions and runs `db push` when `SUPABASE_ACCESS_TOKEN` is set).
- Commit messages: imperative summary + short bullet body.
- After pulling the monorepo change, run `npm install` once at the root (the old root `node_modules` and `.next` can be deleted).
- Before committing: `npm run typecheck` and `npm run build` (root scripts forward to the workspaces).
- Local test build without Supabase ("local mode", no sign-in, data in localStorage): `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run build`, then `npm run preview` → http://localhost:4173/litma/. Playwright works against that (desk → pick a writing type → editor). Cloud-only flows (MCP, AI keys, AI hand-over, sharing) can't be exercised in local mode.
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
- `src/components/ui/` `Select` (custom dropdown), `Sheet` (bottom sheet / drawer / dock), `Confirm` (`useConfirm`); `src/components/icons/Typewriter.tsx`
- `supabase/functions/litma-mcp` MCP server (stateless Streamable HTTP, 30 tools incl. `suggest_edit`); `public/mcp.php` relays `/litma/mcp` to it. The cPanel firewall blocks data-centre callers, so cloud connectors (Claude.ai, ChatGPT) use `MCP_DIRECT_URL` (the function URL + `?key=`) — Settings shows it.
- `supabase/functions/litma-ai` streams Claude/GPT/Gemini with the writer's own key; `litma-transliterate` proxies Google Input Tools.

## Editor behaviour (keep these working)
- Pages flow naturally (Google Docs style): `extensions/pagination.ts` measures top-level blocks and inserts spacer decorations; breaks live in `paginationKey` state (`breaks[i].pos` = first block of page i+2). A page exists only while text reaches it, so deleting the last character of a page removes it.
- **Insert page** is the only way to force a page: the "+ Insert page" button in the gap between two sheets (always visible on touch) calls `insertPageAt(pos)`, adding `[pageBreak] [empty paragraph] [pageBreak]`. The `pageBreak` node is invisible and not selectable (no dashed line, no label, no toolbar button, no Ctrl+Enter: the owner found the visible component annoying). Backspace at the start of a page removes the break before it; on an empty inserted page it removes the whole page; Delete at a line end removes a following break. Don't add delete buttons for pages.
- Body text of every writing type is ragged-right (`text-align: start`) like Google Docs, in the editor and the PDF/book output, so short Malayalam lines never open wide word gaps (the owner asked twice). Justify only when the writer picks it on the toolbar. Indent/alignment rules use `> p:not(.sb)` so styled blocks (title, standfirst…) never inherit them.
- Novel/story drop cap (first letter after a chapter) uses the accent colour only when that letter has no text colour of its own; `FirstLetterColour` (extensions/blocks.ts) adds `.own-first-colour` to such paragraphs, because `::first-letter` would otherwise paint over the writer's colour.
- Text colour and highlight are two tools (`components/editor/ColorTools.tsx`): swatches, a custom colour picker with recent colours, "Automatic" / "None".
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

## Loading
- `components/ui/Skeleton.tsx`: `Skeleton`, `SkeletonLines`, `DeskSkeleton`, `BooksSkeleton`, `EditorSkeleton`, `ListSkeleton`, `FormSkeleton`, `PagesSkeleton`, `InkLoader` (full screen: a nib writing a line under ലിറ്റ്മ), `InkDots`; CSS `.skeleton`, `.ink-spinner`, `.fade-in`, `.pop-in`, `.sheet-up` in globals.css. Shape skeletons like the content that is coming; don't use bare spinners.

## Design system
- **All tokens live in `src/styles/theme.css`** (light in `:root`, dark in `.dark`): canvas · surface · subtle · paper · header · ink · muted · line · primary · accent (indigo) · highlight (amber) · danger, option-hover/selected, demo-*, plus radius, shadows, fonts and the solid `--brand` / `--brand-mark`. Edit there to restyle the app.
- Contrast: text tokens meet WCAG AA (muted ≥ 6:1, highlight ≥ 4.5:1 on its soft background); `--line` is for decorative dividers, `--line-strong` (≥ 3:1) for field, select and outline-button edges. Disabled filled buttons use `--disabled-bg/-ink`, not opacity. Danger buttons: `.btn-danger`.
- Use the generated classes (`bg-surface`, `text-accent`, `bg-primary text-primary-ink`, `text-highlight`…); never hard-code colours in components. Buttons: `.btn` + `btn-primary` (ink-black) / `btn-accent` (indigo) / `btn-outline` / `btn-ghost`. Top bars: `.app-bar` (sticky, translucent) or `bg-header`.
- App chrome stays calm: the logo is solid ink `ലിറ്റ്മ` with an indigo dot (`.brand-text`), thin accent lines `.brand-bar`, no gradients in the app (the owner rejected Instagram-like ones there).
- The home page is the exception: it uses the colourful landing palette (`--mist`, `--night`, `--violet`, `--coral`, `--lime`, `--sky`, `--tangerine`, `--on-pop` for text on bright fills, `--violet-text`/`--coral-text` for AA text), soft blurred colour fields, and the lime→sky→violet gradient on the footer line. The owner approved these gradients. `.on-night` re-maps ink/muted/line for dark bands; Latin text there uses `--font-landing` (Manrope).
- The document page uses `--paper` so writing stays black on white; colour belongs to the chrome, not the text. Page thumbnails (`.tpl-preview`) are ragged-right so tiny justified lines don't look gappy.
- Fonts: Inter for Latin UI, Anek Malayalam for display/Malayalam UI, Noto Serif/Sans Malayalam, Manjari, Gayathri etc. for documents.

## Layout (mobile-first, mirrors the planned native app)
- `useScreen()` in `src/lib/useLayout.ts`: phone < 768 · tablet < 1280 · desktop < 1536 · wide.
- Phones: bottom tab bars (`MobileNav` on desk/dictionary/profile/settings; Format · Contents · Story · Dictionary · More in the editor; Contents · Page · Details in the book editor), panels as bottom sheets (`components/ui/Sheet.tsx`), a keyboard accessory (`MobileFormatStrip`) while writing, floating New work / New book button on the desk.
- Viewport has `maximum-scale=1` and fields are 16px on phones so iPhone Safari doesn't zoom the app on focus (that zoom made sheets look cut off).
- Tablets/laptops: editor panels slide **over** the page (never shrink it); they dock only on wide screens. The right rail is icons only and expands with labels on hover (or keyboard focus).
- Each panel shows its title once (in the Sheet header); don't add a second heading inside panels.
- Global `.btn` sets `display`, so hide buttons with `max-md:!hidden`, not `hidden md:inline-flex`. Touch-only visibility: `[@media(hover:none)]:opacity-100`.
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
