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

## Changes to mirror in the native app
Behaviour fixed on the web that the Flutter app must match:
- **Sign in / Create account / Forgot password:** the main button stays active (it greys out only while working). Read the field values when it's pressed, so values filled in by the system's password autofill always count, and show a plain message for an empty field ("Enter your email address.", "Enter your password."). Don't disable the button just because a field looks empty.
- **Update prompt:** show it only when `latest.json` (`mobile.version`) is newer than the installed app, never on a timer by itself, and never on public screens (welcome, sign in, sign up).
- **Session storage:** keep the Supabase session in the app's own persistent storage (supabase_flutter's default), never in web cookies. The desktop app lost every sign-in when the session lived in cookies.
- **Dictionary:** use the same data files (`/dict`), which list a word's English translations and meanings most-likely first (കവി → poet). Show translations without the source's homograph numbers ("wind-1" → "wind").
- **നാട്ടറിവ് (Dictionary):** categories of Malayalam words with English meanings come from `packages/shared/src/nattarivu.ts` (plain data). Show the category grid, a category's word list with a filter, and open a word in the dictionary with a way back to its category.
- **No photo uploads (for now):** to keep storage costs down there is no profile photo, cover picture, author photo or Story World picture upload (`PHOTO_UPLOADS = false` in `apps/web/src/lib/config.ts`). Pictures uploaded earlier still show.
  - **Avatar:** the writer picks their first letter or a drawn character (`AVATAR_ART` in `apps/web/src/components/art/Avatars.tsx`: generic people with no gender, plus owl, cat, tortoise, fish, parrot, elephant, butterfly, moon) and one of the five `tint-*` colours. Saved in `profiles.preferences` as `avatar` (`"letter"` or the drawing id) and `avatarTint`. A writer who never picked one gets their first letter (a whole Malayalam akshara, ക്ഷ not ക) in a colour chosen steadily from their name (`tintFor`). Port the SVG paths as they are.
  - **Book covers:** `cover.art` names one of eight genre backgrounds served from the website at `/covers/<id>.svg` (fantasy, thriller, romance, scifi, horror, literary, historical, selfhelp; ids from the first version are mapped in `MOVED` in `apps/web/src/components/art/CoverArt.tsx`, which also lists each one's text and accent colours). The "Artwork" template (`template: "art"`) fills the cover with it (title at the top, author at the bottom); other templates show it in their picture slot; the back cover repeats it mirrored under a 62% scrim of the cover colour. `cover.authorAvatar` is the back-cover author picture: `"letter"` (default), a drawn avatar id or `"none"`.
- **Cover designer:** match the web's `CoverFront`/`CoverBack` (`apps/web/src/components/book/Cover.tsx`): background fills every design; title shadow and box (`titleShadow`, `titleBox`, `titleBoxColor`, `titleBoxOpacity`); divider `ornament` (line, flourish, none); `badge`/`badgeText` (defaults to the edition); `publisherMark`; dragged positions in `cover.offsets` (millimetres, per part id: title, author, badge, mark, back-head, back-text, back-imprint); back-cover `backTitle`, imprint strip fields (`genreLine`, `category`, `coverCredit`, `publisherTagline`, `website`, price) and an EAN-13 barcode from the ISBN. Bundle the SMC title fonts from `apps/web/public/fonts/smc`.
