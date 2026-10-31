# Litma — notes for Claude

Malayalam literary writing app. Next.js 15 **static export** (basePath `/litma`) + React 19 + Tailwind v4 + SCSS + Tiptap 2. Backend: Supabase project `jdexadomaxjtxlvgtldu`. Hosted on cPanel at https://www.jayageetham.com/litma, deployed by `.github/workflows/deploy.yml` (FTPS, same pattern as the jayageetham website repo).

## Rules
- No Next.js server features: no API routes, middleware, server actions or dynamic route segments. Use query params (`/write/?id=`, `/read/?s=`). Server work goes in `supabase/functions/*`.
- `src/shared/*` must stay dependency-free and import siblings with `.ts` extensions; `npm run sync:shared` copies it to `supabase/functions/_shared` (CI fails if they drift).
- Links: `next/link` handles the base path; raw `<a href>`/`window.location` need `BASE` / `appUrl()` from `src/lib/config.ts`.
- New tables: enable RLS with `(select auth.uid())` ownership policies, `to authenticated`, and run Supabase advisors.
- Never store raw MCP tokens — only SHA-256 hashes (`mcp_tokens.token_hash`).
- New documents carry `settings.pristine = true` until the writer types; pristine docs are deleted on close and by the desk's cleanup.

## Map
- `src/extensions/` manglish · pagination (A4) · screenplay · blocks · tools (metre, search, typewriter)
- `src/lib/store.ts` data layer (Supabase or localStorage) · `auth.tsx` guards/helpers · `functions.ts` Edge Function calls
- `src/components/editor/Workspace.tsx` the editor shell; `src/lib/autosave.ts` journal + cloud saver
- `src/components/story/StoryWorld.tsx` Story World (characters, locations, beats…); `src/lib/story.ts` field definitions per writing type (സാഹിത്യരൂപം)
- `src/lib/paginate.ts` print paginator; `src/lib/book-sections.ts` book/document → pages; `src/app/print` PDF view; `src/app/book` book editor
- `src/lib/dictionary.ts` + `scripts/build-dictionary.mjs` Olam dictionary/thesaurus
- `supabase/functions/litma-mcp` MCP server (stateless Streamable HTTP); `public/mcp.php` relays `/litma/mcp` to it. The cPanel firewall blocks data-centre callers, so cloud connectors (Claude.ai, ChatGPT) use `MCP_DIRECT_URL` (the function URL + `?key=`) — Settings shows it.

## Design system
- **All tokens live in `src/styles/theme.css`** (light in `:root`, dark in `.dark`): canvas · surface · subtle · paper · header · ink · muted · line · primary · accent · highlight · danger, plus radius, shadows, fonts and the solid `--brand` / `--brand-mark`. Edit there to restyle the app.
- Use the generated classes (`bg-surface`, `text-accent`, `bg-primary text-primary-ink`, `text-highlight`…); never hard-code colours in components. Buttons: `.btn` + `btn-primary` (ink-black) / `btn-accent` (indigo) / `btn-outline` / `btn-ghost`. Top bars: `.app-bar` (sticky, translucent) or `bg-header`. No gradients: the logo uses `.brand-text`, thin accent lines `.brand-bar`.
- The document page uses `--paper` so writing stays black on white; colour belongs to the chrome, not the text.

## Layout (mobile-first, mirrors the planned native app)
- `useScreen()` in `src/lib/useLayout.ts`: phone < 768 · tablet < 1280 · desktop < 1536 · wide.
- Phones: bottom tab bars (`MobileNav` on desk/dictionary/profile/settings; Format · Contents · Story · Dictionary · More in the editor; Contents · Page · Details in the book editor), panels as bottom sheets (`components/ui/Sheet.tsx`), and a keyboard accessory (`MobileFormatStrip`) while writing.
- Tablets/laptops: editor panels slide **over** the page (never shrink it); they dock only on wide screens.
- Global `.btn` sets `display`, so hide buttons with `max-md:!hidden`, not `hidden md:inline-flex`.
- No native `<select>`: use `components/ui/Select.tsx` (accessible combobox + listbox, keyboard and type-ahead, portal so toolbars never clip it; `preventFocusSteal` for editor pickers). Confirmations use `useConfirm()` from `components/ui/Confirm.tsx`, not `window.confirm`.
- Landing/auth are session-aware: signed-in writers never see Sign in / Create account (`HomeActions.tsx`, `useRedirectIfSignedIn`).

## MCP servers (.mcp.json)
- `supabase` — hosted Supabase MCP for this project (OAuth on first use)
- `litma` — Litma's own server; set `LITMA_MCP_TOKEN` (Settings → MCP)

## Vocabulary
- Novel, story, poem, screenplay… are **writing types — സാഹിത്യരൂപം** (plural സാഹിത്യരൂപങ്ങൾ). Never call them "forms" in UI, docs or MCP text. (Code keeps the `kind` / `DocKind` / `shared/forms.ts` names.)
- Character/location notes are **Story World — കഥാലോകം**. Avoid religious terms.
