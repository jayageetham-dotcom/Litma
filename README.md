# Litma · ലിറ്റ്മ

A Malayalam writing desk for novels, short stories, poems, screenplays, features, essays, plays, lyrics and diaries — on real A4 pages, typed in **Manglish** or **Malayalam**.

**Live:** https://www.jayageetham.com/litma · **MCP:** https://www.jayageetham.com/litma/mcp

## How it's put together

| Piece | Where it runs |
|---|---|
| Web app — Next.js 15 static export, React 19, Tiptap 2, Tailwind v4 + SCSS | cPanel, `public_html/litma` (FTPS from GitHub Actions) |
| Accounts, documents, versions, AI inbox, writing stats, profile pictures | Supabase project `jdexadomaxjtxlvgtldu` (Postgres + RLS, Auth, Storage `avatars`, Realtime) |
| Manglish predictions (Google Input Tools) | Edge Function `litma-transliterate` |
| AI companion (Claude / GPT, streamed) | Edge Function `litma-ai` (signed-in users only) |
| MCP server | Edge Function `litma-mcp`, exposed at `/litma/mcp` by `public/mcp.php` (a relay with no secrets) |

The site is static, so there are no server secrets on cPanel. Service keys stay inside Supabase.

## Local development

```bash
npm install
npm run dev            # http://localhost:3000/litma/
npm run build          # static site → out/
npm run preview        # serve out/ at http://localhost:4173/litma/
```

`.env.development` and `.env.production` point at the live Supabase project; the publishable key is safe in the browser (Row Level Security protects the data). Override in `.env.local`. Leave the Supabase values empty to run in **local mode** (documents in the browser only).

## Deployment (CI/CD)

Every push to `main` runs `.github/workflows/deploy.yml`, modelled on the main website:

1. installs, type-checks and builds the static export (`out/`)
2. syncs `out/` to **public_html/litma** over FTPS (`SamKirkland/FTP-Deploy-Action`, incremental, `dangerous-clean-slate: false` with a guard step)
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

Optional: Authentication → Providers → Google (for "Continue with Google"); Edge Functions → Secrets → `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (otherwise writers paste their own key in Settings).

## Features

- **Typing:** Manglish → Malayalam with Google predictions, an offline engine and in-place late correction; your own Malayalam keyboard; English. `Ctrl/⌘+M` switches. On-screen akshara palette.
- **A4 pages** by default (A5, Letter, Legal), page numbers, running heads, true-size PDF export.
- **Nine forms**, each with its own template and toolbar — including the Kerala **screenplay** layout (Scene: N, location, time, cast on the right, action left, two-column dialogue) and **poems/lyrics** with akshara counts and laghu/guru metre marks.
- **Accounts:** sign up, sign in (password, email link, Google), forgot/reset password, **profile** with picture upload, pen name, bio, daily goal, default typing mode, writing heatmap and streaks.
- **Never lose a line:** autosave, offline backup with restore, version history, trash with restore. **Empty new files are discarded** when you close them without writing.
- Outline, find & replace, focus and typewriter modes, night desk, zoom, notes & character bank, import `.txt`/`.md`, export PDF/Word/Markdown/text/HTML, public read-only links, keyboard shortcuts (`Ctrl/⌘+/`).
- **AI:** Claude/GPT companion in the editor, and an **MCP server** so Claude, ChatGPT, IBM Bob, Cursor or VS Code can read your works and send suggestions to the editor's live inbox.

## MCP

Create a token in **Settings → MCP**, then e.g.

```bash
claude mcp add --transport http litma https://www.jayageetham.com/litma/mcp --header "Authorization: Bearer litma_…"
```

Tools: `list_documents`, `search_documents`, `read_document`, `get_writing_guide`, `suggest_edit`, `append_to_document`, `create_document`, `transliterate`.

## Project layout

```
src/app/            pages (desk, write, read, login, signup, profile, settings…)
src/components/     UI; editor/ holds the Tiptap workspace, toolbar, panels
src/extensions/     Tiptap extensions (manglish, pagination, screenplay, blocks, tools)
src/shared/         dependency-free code shared with Edge Functions
supabase/functions/ litma-transliterate · litma-ai · litma-mcp (+ _shared, synced from src/shared)
supabase/migrations schema, RLS, storage policies
public/mcp.php      /litma/mcp relay   ·   public/.htaccess  routing & caching
```
