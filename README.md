# Litma · ലിറ്റ്മ

A Malayalam writing desk for novels, short stories, poems, screenplays, features, essays, plays, lyrics and diaries — on real A4 pages, typed in **Manglish** or **Malayalam**.

**Live:** https://www.jayageetham.com/litma · **MCP:** https://www.jayageetham.com/litma/mcp

## Repository layout (npm workspaces)

```
apps/web           Next.js static site (the app at /litma)
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
| Web app — Next.js 15 static export, React 19, Tiptap 2, Tailwind v4 + SCSS | cPanel, `public_html/litma` (FTPS from GitHub Actions) |
| Accounts, documents, versions, AI inbox, writing stats, profile pictures | Supabase project `jdexadomaxjtxlvgtldu` (Postgres + RLS, Auth, Storage `avatars`, Realtime) |
| Manglish predictions (Google Input Tools) | Edge Function `litma-transliterate` |
| AI companion (Claude / GPT, streamed) | Edge Function `litma-ai` (signed-in users only) |
| MCP server | Edge Function `litma-mcp`, exposed at `/litma/mcp` by `apps/web/public/mcp.php` (a relay with no secrets) |

The site is static, so there are no server secrets on cPanel. Service keys stay inside Supabase.

## Dictionary data

`npm run dict` downloads Olam's open datasets (Datuk — ODbL, EnMl — ODbL, E.K. Kurup — CC BY-SA 4.0) and writes sharded JSON to `apps/web/public/dict/` (git-ignored). CI does this on every deploy (cached), so the dictionary is served from `/litma/dict/`.

## Local development

```bash
npm install            # once, at the repo root
npm run dev            # http://localhost:3000/litma/
npm run build          # static site → apps/web/out/
npm run preview        # serve it at http://localhost:4173/litma/
npm run desktop        # the desktop app (see apps/desktop/README.md)
```

`.env.development` and `.env.production` point at the live Supabase project; the publishable key is safe in the browser (Row Level Security protects the data). Override in `.env.local`. Leave the Supabase values empty to run in **local mode** (documents in the browser only).

## Deployment (CI/CD)

Every push to `main` runs `.github/workflows/deploy.yml`, modelled on the main website:

1. installs, type-checks and builds the static export (`apps/web/out/`)
2. uploads `apps/web/out/` to **public_html/litma** over FTPS with `lftp mirror` — parallel, retries and reconnects on cPanel's connection resets, skips files that haven't changed, and never deletes anything on the server (a guard step fails the build if a delete flag is added)
3. if `SUPABASE_ACCESS_TOKEN` is set: deploys the three Edge Functions, and with `SUPABASE_DB_PASSWORD` also runs `supabase db push`

### One-time setup

**cPanel → Files → FTP Accounts → Add FTP Account**

| Field | Value |
|---|---|
| Log In | `litma` (→ `litma@jayageetham.com`) |
| Password | generate one |
| Directory | `public_html/litma` |

**GitHub → Settings → Secrets and variables → Actions**

| Kind | Name | Value |
|---|---|---|
| Secret | `FTP_PASSWORD` | the FTP account's password |
| Secret (optional) | `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens (a scoped token for this project) |
| Secret (optional) | `SUPABASE_DB_PASSWORD` | Supabase → Project Settings → Database |
| Variable (optional) | `FTP_USERNAME` / `FTP_SERVER_DIR` | only if you use a different FTP account (e.g. `admin@…` with `/litma/`) |

**Supabase → Authentication → URL Configuration**

- Site URL: `https://www.jayageetham.com/litma`
- Redirect URLs: `https://www.jayageetham.com/litma/**` and `http://localhost:3000/litma/**`

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
claude mcp add --transport http litma https://www.jayageetham.com/litma/mcp --header "Authorization: Bearer litma_…"
```

Cloud connectors (Claude.ai **Settings → Connectors → Add custom connector**, ChatGPT) call from data centres, which the shared host's firewall blocks at `/litma/mcp`. They use the Edge Function directly, with the token in the URL:

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
apps/web/public/mcp.php   /litma/mcp relay   ·   apps/web/public/.htaccess  routing & caching
```
