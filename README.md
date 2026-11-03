# Litma · ലിറ്റ്മ

A Malayalam writing desk for novels, short stories, poems, screenplays, features, essays, plays, lyrics and diaries — on real A4 pages, typed in **Manglish** or **Malayalam**.

**Live:** https://getlitma.in · **MCP:** https://getlitma.in/mcp

(Litma used to live at https://www.jayageetham.com/litma; that address redirects to getlitma.in once the move is finished, see [Moving to getlitma.in](#moving-to-getlitmain).)

## Repository layout (npm workspaces)

```
apps/web           Next.js static site (served at the root of getlitma.in)
apps/desktop       Electron app for macOS and Windows (bundles apps/web)
apps/mobile        Flutter app for iOS and Android (planned; see its README)
packages/shared    dependency-free TypeScript shared with the Edge Functions (writing types, Manglish, dictionary, serializers)
packages/i18n      UI strings: locales/en.json, locales/ml.json (+ more languages), plain JSON for every app
packages/keyboards Malayalam keyboard layouts (Enhanced InScript) as JSON
packages/tokens    design tokens exported from the web theme for the native apps
supabase           migrations, Edge Functions (functions/_shared is synced from packages/shared)
scripts            dictionary builder, shared-code sync, token export, auth email templates
```

## How it's put together

| Piece | Where it runs |
|---|---|
| Web app — Next.js 15 static export, React 19, Tiptap 2, Tailwind v4 + SCSS | cPanel, getlitma.in's web root (FTPS from GitHub Actions) |
| Accounts, documents, versions, AI inbox, writing stats, profile pictures | Supabase project `jdexadomaxjtxlvgtldu` (Postgres + RLS, Auth, Storage `avatars`, Realtime) |
| Manglish predictions (Google Input Tools) | Edge Function `litma-transliterate` |
| AI companion (Claude / GPT, streamed) | Edge Function `litma-ai` (signed-in users only) |
| MCP server | Edge Function `litma-mcp`, exposed at `getlitma.in/mcp` by `apps/web/public/mcp.php` (a relay with no secrets) |

The site is static, so there are no server secrets on cPanel. Service keys stay inside Supabase.

## Releases, versions and updates

Litma has **one version number** for the website, the desktop app and the mobile app ([semver](https://semver.org): `major.minor.patch`), kept in the root `package.json` and every workspace, with the history in `CHANGELOG.md`.

**Make a release:** GitHub → Actions → **Release** → Run workflow, choose `patch` (fixes), `minor` (new features), `major` (big changes) or an exact version. It:

1. bumps the version everywhere, writes the changelog from the commit summaries since the last release, commits `Release vX.Y.Z` to `main` and tags it `vX.Y.Z`
2. deploys the website from the tag
3. builds the Mac and Windows apps and publishes the installers on the public `litma-releases` repository's GitHub Releases (the web host's quota is too small for them), with `downloads/latest.json` on the website pointing to them (setup: `apps/desktop/README.md` → Publishing)

Locally, `npm run release:dry -- minor` previews the next version and notes without changing anything.

**How each app updates itself**

| App | How it updates |
|---|---|
| Website | Every push to `main` deploys. Open tabs poll `version.json`; when a newer build is live they offer a reload (writing is journalled on the device, so nothing is lost). |
| Desktop | The app checks `downloads/latest.json` after launch and every 4 hours (and from **Check for Updates…** in the menu). A card offers **Update**; it downloads the installer, verifies its SHA-256 and installs on restart: silent installer on Windows, in-place app swap on macOS. Works without code-signing. A release can set a minimum desktop version to make the update required. The desktop app bundles the web app, so web changes reach it with the next release. |
| Mobile (planned) | Store updates, plus an in-app prompt and an optional forced minimum version from the same `latest.json` (see `apps/mobile/README.md`). |

Pushing a tag yourself (`git tag v1.2.3 && git push --tags`) also builds and publishes the desktop apps, without bumping files.

## Dictionary data

`npm run dict` downloads Olam's open datasets (Datuk — ODbL, EnMl — ODbL, E.K. Kurup — CC BY-SA 4.0) and writes sharded JSON to `apps/web/public/dict/` (git-ignored). CI does this on every deploy (cached), so the dictionary is served from `/dict/`.

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
3. if `SUPABASE_ACCESS_TOKEN` is set: deploys the three Edge Functions, and with `SUPABASE_DB_PASSWORD` also runs `supabase db push`

### One-time setup

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

The Edge Functions `litma-track` and `litma-admin` deploy with the others. Events are kept until you delete them (`delete from analytics_events where created_at < now() - interval '13 months'`).

### Search and sharing

Every page has a title, description and canonical URL (`src/lib/seo.ts`, `pageMetadata`), with Open Graph and Twitter cards using `public/og-image.jpg` (1200 × 630). Public pages (home, dictionary, download, sign-up, sign-in) are in `/sitemap.xml`; writers' own pages (desk, editor, books, reader, settings…) are `noindex` and disallowed in `/robots.txt`. The home page carries schema.org data (Organization, WebSite, SoftwareApplication). `/manifest.webmanifest` makes the site installable on phones and in Chrome, with icons in `public/icons/` made from the desktop app icon (`apps/desktop/build/icon.png`).

Optional: Authentication → Providers → Google (for "Continue with Google"). No AI keys are needed on the server — writers add their own.

## Features

- **Typing:** Manglish → Malayalam with Google predictions, an offline engine and in-place late correction; your own Malayalam keyboard; English. `Ctrl/⌘+M` switches. On-screen akshara palette.
- **A4 pages** by default (A5, Letter, Legal), page numbers, running heads, true-size PDF export.
- **Nine സാഹിത്യരൂപങ്ങൾ (writing types)**, each with its own template and toolbar — including the Kerala **screenplay** layout (Scene: N, location, time, cast on the right, action left, two-column dialogue) and **poems/lyrics** with akshara counts and laghu/guru metre marks.
- **Accounts:** sign up, sign in (password, email link, Google), forgot/reset password, **profile** with picture upload, pen name, bio, daily goal, default typing mode, writing heatmap and streaks.
- **Never lose a line:** every change is journaled on the device immediately and saved to the cloud within ~1 s (at least every 5 s while typing), with retry/back-off when offline and automatic recovery on reopen. Version history, trash with restore. **Empty new files are discarded** when you close them without writing.
- **Story World (കഥാലോകം)** for every writing type: characters (role, arc, voice, relationships, picture), locations, props/objects, a drag-and-drop beat/plot board, timeline, research notes, and reports (scene list, dialogue counts per character, locations; chapter word counts and name mentions; verse line/akshara spread). Character-name autocomplete in screenplay cues.
- **Dictionary (നിഘണ്ടു):** Malayalam→Malayalam (Datuk), English→Malayalam (Olam), Malayalam→English, synonyms (E.K. Kurup thesaurus) and opposites (Datamuse, mapped to Malayalam). In the editor (Ctrl/⌘+Shift+L, looks up the selection) and at `/dictionary/`.
- **Books:** collect works as chapters, add parts, preface/introduction/acknowledgements/about-the-author pages, dedication, epigraph, title, half-title and copyright pages, an automatic contents page with page numbers, and designed front/back covers. Export as one print-ready PDF (A4, A5 or Letter, mirrored margins, running heads, roman/arabic folios). Single documents export the same way.
- Outline, find & replace, focus and typewriter modes, night desk, zoom, notes & character bank, import `.txt`/`.md`, export PDF/Word/Markdown/text/HTML, public read-only links, keyboard shortcuts (`Ctrl/⌘+/`).
- **AI:** Claude/GPT companion in the editor, and an **MCP server** so any MCP-capable AI assistant (Claude, ChatGPT, Cursor, VS Code…) can read your works and send suggestions to the editor's live inbox.

## AI — every writer brings their own

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
packages/shared/src/      dependency-free code shared with Edge Functions (import as @litma/shared/<file>)
supabase/functions/ litma-transliterate · litma-ai · litma-mcp (+ _shared, synced from packages/shared/src)
supabase/migrations schema, RLS, storage policies
scripts/build-dictionary.mjs   Olam datasets → apps/web/public/dict shards (run by CI; `npm run dict` locally)
apps/web/public/mcp.php   /mcp relay   ·   apps/web/public/.htaccess  routing & caching
```
