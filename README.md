# Litma · ലിറ്റ്മ

A Malayalam writing desk for novels, short stories, poems, screenplays, features, essays, plays, lyrics and diaries, on real A4 pages, typed in **Manglish**, **Malayalam** or English, even offline. On the web, as a desktop app for macOS and Windows (a Linux AppImage is still built but not offered on the website for now), and as a phone app for iPhone and Android (store release pending).

**Live:** https://getlitma.in · **MCP:** https://getlitma.in/mcp

(Litma used to live at https://www.jayageetham.com/litma; that address redirects to getlitma.in once the move is finished, see [Moving to getlitma.in](#moving-to-getlitmain).)

## Repository layout (npm workspaces)

```
apps/web           Next.js static site (served at the root of getlitma.in)
apps/desktop       Electron app for macOS, Windows and Linux (bundles apps/web)
apps/mobile        Flutter app for iOS and Android (native, offline; see its README)
packages/shared    dependency-free TypeScript shared with the Edge Functions (writing types, Manglish, dictionary, serializers)
packages/i18n      UI strings: locales/en.json, locales/ml.json (+ more languages), plain JSON for every app
packages/keyboards Malayalam keyboard layouts (Enhanced InScript) as JSON
packages/tokens    design tokens exported from the web theme for the native apps
supabase           migrations, Edge Functions (functions/_shared is synced from packages/shared)
scripts            dictionary builder, shared-code sync, token export, phone assets, auth email templates
docs/changes       what changed in each app and what is still open (for maintainers)
```

## How it's put together

| Piece | Where it runs |
|---|---|
| Web app: Next.js 15 static export, React 19, Tiptap 2, Tailwind v4 + SCSS | cPanel, getlitma.in's web root (FTPS from GitHub Actions) |
| Desktop app: Electron, serving its own copy of the web build | the writer's Mac, Windows or Linux computer (installers on `litma-releases`) |
| Phone app: Flutter, native editor, SQLite copy for offline | iPhone and Android (App Store / Google Play, once the store accounts are set up) |
| Accounts, documents, versions, AI inbox, writing stats | Supabase project `jdexadomaxjtxlvgtldu` (Postgres + RLS, Auth, Storage, Realtime) |
| Manglish: offline engine first, Google Input Tools predictions on top | `packages/shared/src/manglish.ts` (Dart port in `apps/mobile/lib/core/manglish.dart`) + Edge Function `litma-transliterate` |
| AI companion (Claude / GPT / Gemini, streamed, writer's own key) | Edge Function `litma-ai` (signed-in users only) |
| MCP server | Edge Function `litma-mcp`, exposed at `getlitma.in/mcp` by `apps/web/public/mcp.php` (a relay with no secrets) |
| Usage statistics and the admin dashboard | Edge Functions `litma-track`, `litma-admin` |
| Sign-in emails through the getlitma.in mailbox | Edge Function `litma-send-email` (Supabase Send Email hook) |
| Malayalam spelling engine (a TypeScript port of SMC's mlmorph) | Edge Function `litma-spell` (signed-in users only; the editor falls back to its own checks when it can't be reached) |

The site is static, so there are no server secrets on cPanel. Service keys stay inside Supabase.

## Releases, versions and updates

Litma has **one version number** for the website, the desktop app and the mobile app ([semver](https://semver.org): `major.minor.patch`), kept in the root `package.json` and every workspace, with the history in `CHANGELOG.md`.

**Make a release:** GitHub → Actions → **Release** → Run workflow, choose `patch` (fixes), `minor` (new features), `major` (big changes) or an exact version. It:

1. bumps the version everywhere, writes the changelog from the commit summaries since the last release, commits `Release vX.Y.Z` to `main` and tags it `vX.Y.Z`
2. deploys the website from the tag
3. builds the Mac, Windows and Linux apps and publishes the installers on the public `litma-releases` repository's GitHub Releases (the web host's quota is too small for them), with `downloads/latest.json` on the website pointing to them (setup: `apps/desktop/README.md` → Publishing)

Locally, `npm run release:dry -- minor` previews the next version and notes without changing anything.

**How each app updates itself**

| App | How it updates |
|---|---|
| Website | Every push to `main` deploys. Open tabs poll `version.json`; when a newer build is live they offer a reload (writing is journalled on the device, so nothing is lost). |
| Desktop | The app checks `downloads/latest.json` after launch and every 4 hours (and from **Check for Updates…** in the menu). A card offers **Update**; it downloads the installer, verifies its SHA-256 and installs on restart: silent installer on Windows, in-place app swap on macOS. Works without code-signing. A release can set a minimum desktop version to make the update required. The desktop app bundles the web app, so web changes reach it with the next release. |
| Phone | Store updates (`mobile-release.yml`, run by Release once the store secrets exist), plus an in-app prompt and an optional forced minimum version from the same `latest.json` (see `apps/mobile/README.md`). |

Pushing a tag yourself (`git tag v1.2.3 && git push --tags`) also builds and publishes the desktop apps, without bumping files.

## Dictionary data

`npm run dict` downloads the open dictionary datasets and writes sharded JSON to `apps/web/public/dict/` (git-ignored). CI does this on every deploy (cached), so the dictionary is served from `/dict/`. At the end it runs `scripts/build-rhymes.mjs`, which writes the rhyme finder's files (`dict/rhyme/<s|e|f>-<hex>.json`, about 2,400 small files) and the spelling word lists (`dict/words/<shard>.txt`) from the same headwords. Entries that describe a caste or community, or abuse, are never suggested as rhymes.

## Spelling engine

`supabase/functions/litma-spell` runs `packages/shared/src/mlmorph.ts`, a TypeScript port of the mlmorph Malayalam morphology analyser. It answers the same as Python mlmorph on its test words and checks a word in about 17 µs. `scripts/build-mlmorph.mjs` downloads the pinned mlmorph wheel from PyPI (version and sha256 in the script), converts its transducer to `mlmorph.bin.gz` (about 7.6 MB) and its common-mistakes list to `mistakes.json`, into `supabase/functions/litma-spell/data/` (git-ignored). The deploy job runs it and deploys `litma-spell` with `--use-docker` as its last step, which may fail without stopping the rest of the deploy.

## Credits

All credits and licences for the open data, fonts and software Litma uses are kept in one place: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and for writers the help guide **Credits and licences** (`/help/?a=credits`, linked from Settings → About and the Terms). Name a source only there, not in UI text, other guides or marketing.

## Local development

```bash
npm install            # once, at the repo root
npm run dev            # http://localhost:3000/
npm run build          # static site → apps/web/out/
npm run preview        # serve it at http://localhost:4173/
npm run desktop        # the desktop app (see apps/desktop/README.md)
```

`.env.development` and `.env.production` point at the live Supabase project; the publishable key is safe in the browser (Row Level Security protects the data). Override in `.env.local`. Leave the Supabase values empty to run in **local mode** (documents in the browser only).

## Deployment (CI/CD)

Every push to `main` runs `.github/workflows/deploy.yml`, modelled on the main website:

1. installs, type-checks and builds the static export (`apps/web/out/`)
2. uploads `apps/web/out/` to **getlitma.in's web root** over FTPS with `lftp mirror` — parallel, retries and reconnects on cPanel's connection resets, skips files that haven't changed, and never deletes anything on the server (a guard step fails the build if a delete flag is added)
3. if `SUPABASE_ACCESS_TOKEN` is set: deploys the Edge Functions, and with `SUPABASE_DB_PASSWORD` also runs `supabase db push`

### One-time setup

Step-by-step guide for every Google and Supabase setting (sign-in, redirect addresses, emails, Edge Function secrets, migrations, Drive backup), with links: [`docs/setup/google-and-supabase.md`](docs/setup/google-and-supabase.md).

**Web host → FTP Accounts → Add FTP Account** for getlitma.in, with its Directory set to getlitma.in's web root (the folder the domain serves). Its home folder is then `/`.

**GitHub → Settings → Secrets and variables → Actions**

| Kind | Name | Value |
|---|---|---|
| Variable | `LITMA_FTP_USERNAME` | the getlitma.in FTP account (e.g. `deploy@getlitma.in`) |
| Secret | `LITMA_FTP_PASSWORD` | its password |
| Variable (optional) | `LITMA_FTP_SERVER` | FTP host, if not `ftp.getlitma.in` |
| Variable (optional) | `LITMA_FTP_DIR` | folder inside the account, if not `/` (e.g. `/public_html` when the account opens one level above the web root) |
| Secret (optional) | `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens (a scoped token for this project) |
| Secret (optional) | `SUPABASE_DB_PASSWORD` | Supabase → Project Settings → Database |
| Secret (keep) | `FTP_PASSWORD` | the old `litma@jayageetham.com` account, used once by the redirect workflow |

Until `LITMA_FTP_USERNAME` and `LITMA_FTP_PASSWORD` exist, pushes still build and check the site but skip the upload (a warning in the run), so nothing half-moves.

**Supabase → Authentication → URL Configuration**

- Site URL: `https://getlitma.in`
- Redirect URLs: `https://getlitma.in/**`, `http://localhost:3000/**`, and keep `https://www.jayageetham.com/litma/**` (desktop apps from before the move still send writers there; it redirects)

### Moving to getlitma.in

1. Point getlitma.in at the web host (DNS) and turn on HTTPS for it (cPanel → SSL/TLS Status → AutoSSL, for `getlitma.in` and `www.getlitma.in`).
2. Make the FTP account and add the variable and secret above, then run **Actions → Clear getlitma.in and redeploy** (type `getlitma.in`; first without Delete ticked to see what it would remove, then with it). It empties the new account's web root of cPanel's default files (keeps `.well-known` and `cgi-bin`) and uploads Litma to the root. Later updates just need a push (or **Actions → Deploy Litma → Run workflow**). Check https://getlitma.in, sign in, open the dictionary.
3. Supabase → Authentication → URL Configuration as above. Supabase → Edge Functions → Secrets: if `LITMA_SITE_URL` is set, change it to `https://getlitma.in` (or delete it; that is now the default).
4. Run **Actions → Redirect the old Litma address** (type `getlitma.in is live`). It swaps `public_html/litma/.htaccess` on jayageetham.com for `deploy/legacy-litma/.htaccess`, so every old link, bookmark, MCP address and the old desktop updater's `latest.json` lands on the same path at getlitma.in.
5. Run **Actions → Release** so the desktop app uses the new address too.
6. Google Search Console: add `https://getlitma.in` as a property, submit `https://getlitma.in/sitemap.xml`, and use **Change of address** from the old jayageetham.com property if it was registered.
7. Email templates: paste the regenerated `supabase/templates/*.html` (they link to getlitma.in) into Supabase → Authentication → Emails → Templates.

### Admin dashboard and usage statistics

https://getlitma.in/admin/ shows how Litma is used: visitors, active writers, sign-ups, words written, when people write, countries, devices, languages, referrers, the most used pages, buttons and features, and a list of writers with each one's activity. Writing is never collected: works are counted, not listed, and click labels are limited to Litma's own interface text. Writers can switch statistics off in Settings.

One-time setup, after the migration has run (push to `main` with `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` set, or `supabase db push`), in Supabase → SQL editor:

```sql
insert into public.app_admins (user_id) select id from auth.users where email = 'you@example.com';
```

The Edge Functions `litma-track` and `litma-admin` deploy with the others. Statistics are kept for **90 days**: the migration `writing_stats_retention` switches on pg_cron and schedules `prune_statistics()` every night, which deletes older rows from `analytics_events`, `writing_days` and `work_days`, so the database stays small. The dashboard's ranges are 7, 30 and 90 days.

### Search and sharing

Every page has a title, description and canonical URL (`src/lib/seo.ts`, `pageMetadata`), with Open Graph and Twitter cards using `public/og-image.jpg` (1200 × 630). Public pages (home, dictionary, download, sign-up, sign-in) are in `/sitemap.xml`; writers' own pages (desk, editor, books, reader, settings…) are `noindex` and disallowed in `/robots.txt`. The home page carries schema.org data (Organization, WebSite, SoftwareApplication). `/manifest.webmanifest` makes the site installable on phones and in Chrome, with icons in `public/icons/` made from the desktop app icon (`apps/desktop/build/icon.png`).

Optional: Authentication → Providers → Google (for "Continue with Google"). No AI keys are needed on the server — writers add their own.

### Google Drive backup (optional)

The website's **Settings → Backup → Save to Google Drive** uses Google's own sign-in popup in the browser with the `drive.file` permission (Litma sees only the files it makes). It costs nothing. To turn it on:

1. Google Cloud console, the project of Litma's Google sign-in: **APIs & Services → Library → Google Drive API → Enable**.
2. **Credentials**: use the existing Web OAuth client (or make one) and add `https://getlitma.in` to **Authorised JavaScript origins**.
3. **OAuth consent screen → Data access**: add the scope `.../auth/drive.file` (non-sensitive, so only the usual app verification, no security assessment). The Privacy Policy already describes it.
4. GitHub → Settings → Secrets and variables → Actions → **Variables**: `GOOGLE_CLIENT_ID` = that client id. The next deploy shows the button. Without it the button is hidden; download and the desktop folder backup work anyway.

## Changing Litma

Every addition, change or removal also updates the strings in both languages (`packages/i18n/locales`, checked by `npm run i18n:check`), the help guide (`apps/web/content/help`), and where it applies the Privacy Policy and Terms, credits, CSP, setup guide and change logs. The full checklist is in [`CLAUDE.md`](CLAUDE.md) under **Every change: the checklist**.

## Features

- **Typing:** Manglish → Malayalam with an offline engine that follows how people really type (see [Manglish typing](#manglish-typing)), Google predictions on top when online, and in-place late correction; a built-in Enhanced InScript keyboard or your own Malayalam keyboard; English. `Ctrl/⌘+M` switches. On-screen akshara palette.
- **Account and safety:** Settings → Delete account in every app (`litma-account`); the owner can block an account for some days or for good, or delete it, from /admin/ → Writers (`litma-admin`, logged in `admin_actions`). Rate limits on the public Edge Functions (`_shared/ratelimit.ts`), a Cloudflare Turnstile check on sign-in once CAPTCHA is on in Supabase (`/captcha/`), and HSTS + Content-Security-Policy in `apps/web/public/.htaccess`.
- **Your account, your call:** Settings → Delete account on every app (`litma-account`); admins can block an account for some days or for good, or delete it (/admin/ → Writers, `litma-admin`, logged in `admin_actions`).
- **Security:** rate limits on the public functions (`_shared/ratelimit.ts`), an optional Cloudflare Turnstile check before email sign-in, sign-up and reset (`/captcha/`, shown only when Supabase asks), and HSTS, CSP and frame rules in `apps/web/public/.htaccess`.
- **Works offline** on the web, desktop and phone: a copy of your works stays on the device and changes are sent when the connection returns.
- **A4 pages** by default (A5, Letter, Legal), page numbers, running heads, true-size PDF export.
- **Nine സാഹിത്യരൂപങ്ങൾ (writing types)**, each with its own template and toolbar — including the Kerala **screenplay** layout (Scene: N, location, time, cast on the right, action left, two-column dialogue) and **poems/lyrics** with akshara counts and laghu/guru metre marks.
- **Accounts:** sign up, sign in (password, email link, Google), forgot/reset password, **profile** with avatar pictures (photo uploads are paused for now), pen name, bio, default typing mode, writing heatmap.
- **Goals and statistics (`/goals/`):** daily and weekly word goals, streaks with rest days, a goal and finish date per work, a writing timer (sprint) with a chime and notification, a daily reminder (browser tab, desktop app main process, or the phone's own scheduled notification), and 7/30/90-day statistics (words, minutes, writing days, hours of the day, by writing type and work). Kept for 90 days.
- **Rhymes (പ്രാസം):** ദ്വിതീയാക്ഷര, അന്ത്യ and ആദി പ്രാസം from the dictionary's headwords with laghu–guru patterns (files built by `scripts/build-rhymes.mjs`), in the editor, the Dictionary's പ്രാസം tab, the phone and MCP (`find_rhymes`).
- **Spelling and grammar:** Litma's own spelling engine knows Malayalam word forms with all their endings and joins. It marks common misspellings in red with the right spelling, words it can't analyse as amber "Check spelling?" with likely fixes, broken Unicode letters, and spacing around punctuation (`packages/shared/src/spell.ts`, `punctuation.ts`, `mlmorph.ts`; Edge Function `litma-spell`). If the engine can't be reached the editor goes on with its own checks. **Check grammar** in the Spelling and grammar panel asks the writer's AI companion and shows each fix as a card to accept or skip. MCP `check_spelling`.
- **Read aloud** with the device's own Malayalam voice (Web Speech API; the phone's own speech engine on the phone), sentence by sentence with the line highlighted.
- **Backup:** everything as one zip (Word files + a restorable JSON), downloaded, saved to Google Drive, written daily into a folder by the desktop app, or shared from the phone; restore on the website or desktop app.
- **Pin the work in progress** to the top of the desk (one at a time, saved in the profile so every device and the phone show it; MCP `pin_document`).
- **Never lose a line:** every change is journaled on the device immediately and saved to the cloud within ~1 s (at least every 5 s while typing), with retry/back-off when offline and automatic recovery on reopen. Version history, trash with restore. **Empty new files are discarded** when you close them without writing.
- **Story World (കഥാലോകം)** for every writing type: characters (role, arc, voice, relationships, picture), locations, props/objects, a drag-and-drop beat/plot board, timeline, research notes, and reports (scene list, dialogue counts per character, locations; chapter word counts and name mentions; verse line/akshara spread). Character-name autocomplete in screenplay cues.
- **Dictionary (നിഘണ്ടു):** Malayalam→Malayalam (Datuk), English→Malayalam (Olam), Malayalam→English, synonyms (E.K. Kurup thesaurus), opposites (Datamuse, mapped to Malayalam) and rhymes (പ്രാസം). In the editor (Ctrl/⌘+Shift+L, looks up the selection) and at `/dictionary/`.
- **Books:** collect works as chapters, add parts, preface/introduction/acknowledgements/about-the-author pages, dedication, epigraph, title, half-title and copyright pages, an automatic contents page with page numbers, and designed front/back covers. Export as one print-ready PDF (A4, A5 or Letter, mirrored margins, running heads, roman/arabic folios). Single documents export the same way.
- Outline, find & replace, focus and typewriter modes, night desk, zoom, notes & character bank, import `.txt`/`.md`, export PDF/Word/Markdown/text/HTML, public read-only links, keyboard shortcuts (`Ctrl/⌘+/`).
- **AI:** Claude/GPT/Gemini companion in the editor, and an **MCP server** so any MCP-capable AI assistant (Claude, ChatGPT, Cursor, VS Code…) can read your works and send suggestions to the editor's live inbox.

## Manglish typing

Type Malayalam the way you would in a chat message. Each word turns into Malayalam when you press space; the list under the word (a strip above the keyboard on phones) offers other spellings, and "Aa" keeps it in English.

The offline engine (`packages/shared/src/manglish.ts`, ported to Dart for the phone) gives the first spelling. When online, Google Input Tools' predictions are added on top. On its own it follows common Manglish:

| You type | You get | Rule |
|---|---|---|
| `ente naadu`, `nammude`, `kadal` | എന്റെ നാട്, നമ്മുടെ, കടൽ | d between vowels is ട; at the start of a word or before y, r, v it is ദ (`daivam` ദൈവം, `vidya` വിദ്യ) |
| `veedu`, `undu`, `manassu` | വീട്, ഉണ്ട്, മനസ്സ് | a final u after ട, ണ്ട or സ്സ is the half-u ് |
| `chandran` | ചന്ദ്രൻ | nd before r is ന്ദ |
| `aanu`, `njan`, `aval`, `kadha`, `parayaam` | ആണ്, ഞാൻ, അവൾ, കഥ, പറയാം | everyday words that no rule settles have fixed spellings (`COMMON`) |
| `avan`, `maram`, `mazha` | അവൻ, മരം, മഴ | final n, l, r, m become chillu letters; zh is ഴ |

The suggestion list also offers റ for r, ള for l, ണ for n, long ഏ/ഓ, ദ for d and ു for a half-u, so the right spelling is one tap away even offline.

For exact control, capitals and marks spell letter by letter: `T` ട, `D` ഡ, `N` ണ, `L` ള, `R` റ, `S` ശ, `E` ഏ, `O` ഓ, `A` ആ; `_` breaks a cluster and keeps d as ദ between vowels (`u_dayam` ഉദയം), `~` adds a chandrakkala (`naad~` നാട്).

The website's and phone's engines must agree: `npm run mobile:assets` writes the web engine's answers to `apps/mobile/test/manglish_vectors.json` and `manglish_candidates.json`, and `flutter test` checks the Dart port against them.

## AI: every writer brings their own

**In the editor:** the ✦ panel streams Claude, GPT or Gemini (continue, rewrite, polish, proofread, synonyms, പ്രാസം rhymes, dialogue, description, titles, summary, translation, editor's notes, or ask anything). Each writer adds **their own API key** in **Settings → Your AI keys**; it is AES-GCM encrypted by the `litma-ai` Edge Function and stored in `ai_keys`, a table browsers cannot read. Only the last four characters are ever shown again. No shared server key is needed.

**Over MCP:** each writer connects the assistant they already use (any AI assistant that supports MCP (Claude, ChatGPT, Cursor, VS Code…)) with their own Litma token from **Settings → MCP**:

```bash
claude mcp add --transport http litma https://getlitma.in/mcp --header "Authorization: Bearer litma_…"
```

Cloud connectors (Claude.ai **Settings → Connectors → Add custom connector**, ChatGPT) call from data centres, which the shared host's firewall blocks at `/mcp`. They use the Edge Function directly, with the token in the URL:

```
https://jdexadomaxjtxlvgtldu.supabase.co/functions/v1/litma-mcp?key=litma_…
```

The project URL is public anyway (it ships in the app bundle with the publishable key); every call needs the writer's own token.

30 tools, all scoped to the token's owner:

| Area | Tools |
|---|---|
| Documents | `list_documents` `search_documents` `read_document` `create_document` `append_to_document` `replace_text` `update_document` `trash_document` |
| Versions | `list_versions` `save_version` `restore_version` |
| Inbox | `suggest_edit` (appears live in the editor) `list_suggestions` |
| Story World | `list_story_items` `create_story_item` `update_story_item` `delete_story_item` |
| Language | `dictionary_lookup` (meanings, synonyms, translations, opposites) `transliterate` `get_writing_guide` |
| Books | `list_books` `get_book` `create_book` `update_book` `add_to_book` `remove_from_book` `reorder_book` `export_pdf` |
| Writer | `get_profile` `writing_stats` |

## Project layout

```
apps/web/src/app/         pages (desk, write, book, print, dictionary, read, login, signup, profile, settings…)
apps/web/src/components/  UI; editor/ holds the Tiptap workspace, toolbar, panels
apps/web/src/extensions/  Tiptap extensions (manglish, pagination, screenplay, blocks, tools, keep-selection)
apps/mobile/lib/          phone app: core (tokens, Manglish), data (store, offline), editor, features
packages/shared/src/      dependency-free code shared with Edge Functions (import as @litma/shared/<file>)
supabase/functions/ litma-transliterate · litma-ai · litma-spell · litma-account · litma-mcp · litma-track · litma-admin · litma-send-email (+ _shared, synced from packages/shared/src)
supabase/migrations schema, RLS, storage policies
scripts/build-dictionary.mjs   Olam datasets → apps/web/public/dict shards (run by CI; `npm run dict` locally)
scripts/build-mlmorph.mjs      mlmorph wheel → litma-spell's data (run by CI before deploying litma-spell)
THIRD_PARTY_NOTICES.md         licences and credits for the open work Litma uses
apps/web/public/mcp.php   /mcp relay   ·   apps/web/public/.htaccess  routing & caching
```
