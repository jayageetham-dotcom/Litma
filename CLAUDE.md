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
- `src/components/editor/Workspace.tsx` the editor shell
- `supabase/functions/litma-mcp` MCP server (stateless Streamable HTTP); `public/mcp.php` relays `/litma/mcp` to it

## MCP servers (.mcp.json)
- `supabase` — hosted Supabase MCP for this project (OAuth on first use)
- `litma` — Litma's own server; set `LITMA_MCP_TOKEN` (Settings → MCP)
