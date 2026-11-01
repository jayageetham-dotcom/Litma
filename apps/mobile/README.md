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

## Versions and updates (plan for the Flutter app)

Litma uses **one version number** for the website, the desktop app and the mobile app (root `package.json`, bumped by the Release workflow; see the main README). For the Flutter app:

1. **Version**: `pubspec.yaml` `version: X.Y.Z+N` takes X.Y.Z from the release and N from the CI run number (stores need a growing build number). The Release workflow will gain a `mobile` job that sets it and builds.
2. **Store updates**: releases go to TestFlight / App Store and the Play Console through CI (Fastlane or `flutter build ipa` + App Store Connect API key, `flutter build appbundle` + Play service account). Phones update from the stores as usual.
3. **In-app prompt**: on launch the app reads `https://www.jayageetham.com/litma/downloads/latest.json`. The `mobile` block (`version`, `minimumVersion`, `ios`, `android` store links) is already in the file (filled in once the app ships):
   - newer `version` → a gentle "Update available" card linking to the store (Android can use Play's in-app updates)
   - `minimumVersion` above the installed one → a blocking "Please update" screen (for backend changes old apps can't handle)
4. **Instant fixes without a store review (optional)**: Shorebird code push can patch Dart code between store releases.
5. **Content never waits for an app update**: documents, Story World, the dictionary and AI all come from Supabase and the website, so most improvements reach phones without a new build.
