# Litma mobile (Flutter) — planned

The native iOS and Android app will live here. It is a separate session of work (navigation, offline sync and editor choices need their own design decisions), but the shared pieces are ready to use:

| What | Where | How Flutter uses it |
|---|---|---|
| UI strings (English, Malayalam, more Indian languages later) | `packages/i18n/locales/*.json` | load as assets; same keys as the web (`desk.newWork`, plural `_one` / `_other`) |
| Design tokens (colours light/dark, radii, fonts) | `packages/tokens/tokens.json` (generated from the web theme by `npm run tokens`) | build a `ThemeData` from it |
| Malayalam keyboard layouts | `packages/keyboards/layouts/*.json` | hardware-keyboard support on tablets |
| Writing types, Manglish engine, dictionary core, document serializers | `packages/shared/src/*.ts` (dependency-free TypeScript) | port to Dart, or call the same logic through the Supabase Edge Functions / MCP server |
| Backend | Supabase project `jdexadomaxjtxlvgtldu` (auth, documents, Story World, books, bookmarks) | `supabase_flutter` with the same RLS-protected tables |

The web app's mobile layout (`useScreen()` size classes, bottom tab bars, bottom sheets, keyboard accessory strip, kept selection) is the reference for the native UX.
