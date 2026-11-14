# Cross-platform changes

Work that touches more than one Litma app (web, desktop, phone). Per-app details live in
`web.md`, `desktop.md` and `mobile.md` next to this file.

**Every session:** read these four files before starting, then add what you changed (newest
first) and update **Open items** before you finish. Keep entries short: what changed, where in
the code, and what is still unverified.

## 2026-11-14: Mac app submitted to the App Store

macOS App 0.7.26 (build 4, from **Desktop store builds**) submitted for review at 22:50 IST, manual release, same listing as the iPhone app (Apple ID 6834719757). Checked by the owner in TestFlight for Mac: installs, dictionary suggestions. iPhone 0.7.24 (6) still waiting for review. After approval: release both by hand; then the next iPhone build should be 0.7.26 (dictionary joiner fix, Manglish suggestions are web-only). Open: `STORE_LINKS` in `apps/web/src/lib/release.ts` has only `ios`/`android`; the download page could add a Mac App Store link (https://apps.apple.com/app/id6834719757 opens the Mac listing on a Mac) once the Mac app is live.

## 2026-11-14: Dictionary finds words typed with a stray joiner

Owner on the iPhone (build 6): കാട് gave "No entry", and no suggestions while typing. The keyboard had put an invisible U+200C after ്. `spellings()` in `packages/shared/src/dict.ts` (synced to `supabase/functions/_shared`, so MCP `dictionary_lookup` too) and in the phone's `lib/data/dictionary.dart`: `lookup` and `suggest` try the word as typed, then with old-style chillu (consonant + ് + U+200D) made atomic and joiners removed. As typed first, because 756 dictionary words keep a joiner. Checked on the web side against the built data (കാട് + U+200C / U+200D → കാട്); phone test in `test/phases_test.dart` not run here (no Flutter). **Reaches the iPhone only with the next store build** (0.7.24 build 6 is in review without it); website with the push; desktop with a Release / store build.

## 2026-11-14: Dictionary suggestions for Manglish

Website and desktop: the dictionary box now suggests Malayalam words for Manglish as you type (like Olam), next to English completions, with ↑ ↓ Enter. The phone already suggested Manglish spellings. Details in `web.md`; desktop gets it with the next Release (and Mac App Store build). Help `06-dictionary.md#look-up`.

## 2026-11-14: Mac App Store signing

The five Mac App Store secrets are set (Apple Distribution and Mac Installer certificates, Mac App Store profile for `in.getlitma.litma`). The first store build failed in electron-builder's own keychain step; `apps/desktop/scripts/build-mas.sh` now signs with a keychain of its own; run #2 passed. Next: TestFlight for Mac, then attach the build to the macOS version (manual release). Details in `desktop.md`.

## 2026-11-14: iPad screenshots for the App Store

Phone app screenshot test renders eight iPad 13" shots (`ipad-0N-*`, 2064 x 2752); `scripts/store-ipad-screens.py` adds the iPhone set's captions and colours into `marketing/store/app-store/ipad/`. Needs a manual run of the Mobile workflow (the screens job), then the script. Details in `mobile.md`.

## 2026-11-14: Clear button and Esc in name fields

The work title (editor top bar, phone rename box) and the Book details Title, Subtitle and Author fields get a × that empties them, and Esc puts back the text from before the writer clicked in (web, desktop, phone with a hardware keyboard). A work title left empty gets its old name back. New string `field.clear` (en + ml). Help: `01-getting-started.md` (Rename a work), `02-typing.md#manglish-fields`. Unverified: `npm run build` (couldn't run in the sandbox), phone `flutter analyze`/`flutter test`; desktop needs a Release.

## 2026-11-14: Desktop app for the stores

Mac App Store (sharing the iPhone app's listing), Microsoft Store and Snap Store packages of the desktop app: `electron-builder.stores.yml`, `src/store.ts` (store copies don't self-update), workflow **Desktop store builds** (`.github/workflows/desktop-stores.yml`). Setup guide Part 11. Details and what is unverified in `desktop.md`.

## 2026-11-14: Phone editing fixes, title in Manglish

Phone app: a selection can run over many lines and pages (handles, bar, typing replaces it), Backspace removes an empty page, Move to trash closes the editor at once, rename takes Manglish. Web and desktop: the title box turns Manglish into Malayalam. Details in `mobile.md` and `web.md`. Phone changes pass CI and were checked by the owner on TestFlight build 0.7.24 (6) on an iPhone; desktop needs a Release. App Store: build 6 is the one to submit (Apple ID 6834719757, manual release); after it is live, fill `STORE_LINKS` and the `mobile.ios` link in `latest.json`.

## 2026-11-14: Store setup

Apple and Google Play developer accounts bought. Setup guide Part 10 (phone stores, Mac signing); iOS store build now signs with the App Store Connect key (`mobile-release.yml`). Details in `mobile.md` and `desktop.md`.

App Store Connect app made (Apple ID 6834719757, 13+); listing and iPhone screenshots in `marketing/store/app-store/`; `Info.plist` declares no non-exempt encryption. Open: `ASC_*` secrets, first TestFlight build, iPad or iPhone-only (see `mobile.md`).

## Open items

### Still open (after the 2026-11-07 work)

Security (2026-11-13): owner to create the Turnstile widget, set `TURNSTILE_SITE_KEY`, then switch on Supabase Captcha protection and leaked-password protection (setup guide 3.5). Deleting an account also deletes its community posts, including removed ones kept for the IT Rules' 180 days; if that record must survive deletion, copy removed posts to a separate table first.

Reels (2026-11-09): reel 3 (launch ad) can be re-voiced with Despina (Gemini) when the TTS quota allows; post the reels with a track from Instagram's music picker; on the Mac, run the one-time setup in `docs/marketing/reels.md` (Whisper and yt-dlp could not reach their downloads from the cloud sandbox).


Spelling engine (2026-11-09): Edge Function `litma-spell` (mlmorph) is deployed by the push as the last Supabase step (`--use-docker`, allowed to fail). Check the Actions log for "Deploy the spelling engine" and that litma-spell appears in the Supabase dashboard; if it fails, writers simply get the old spelling checks. Phone app: not yet using it (README). Desktop: next Release.

Grammar check (2026-11-09): the web/desktop Spelling and grammar panel checks grammar itself with fix cards; the push deploys the `litma-ai` function with the new `grammarCheck` action (until then the check answers "Unknown action"). The phone app still uses the old flow (see `apps/mobile/README.md`).

Litma Community (2026-11-09):
- **Push** also runs migration `20261109140000_shared_author` (writer's name on shared links); until then the shared page shows the author line from the work itself.
- **Push**, then check migration `20261109120000_community` ran and the cron job `litma-prune-community` exists. Until then /community/ shows "Something went wrong" to signed-in writers.
- Run the Supabase security and performance advisors after the migration (the sandbox could not reach the project).
- **Legal:** have a lawyer read `/community/guidelines/` (#responsibility, #contact), Terms #community and Privacy #community. India's IT Rules 2021 expect a named **Grievance Officer** (name and contact) on the site; the pages give only support@getlitma.in and promise 24-hour acknowledgement and 15-day resolution. Add the name when decided.
- Moderators are `app_admins` rows; there are no email notifications for new reports yet (check **Reports** on /community/).
- Desktop gets the community only after a **Release**; the phone app links to the website until native screens exist.

Only the owner can do these (accounts, secrets, dashboards):
- **Phone app in the stores (accounts bought 2026-11-14):** follow `docs/setup/google-and-supabase.md`
  Part 10: App ID with Sign in with Apple, App Store Connect app + Admin API key, Play Console app,
  upload keystore (first `.aab` uploaded by hand), service account, store forms, demo account for
  reviewers. Then fill `STORE_LINKS` and the `mobile` block of `latest.json`; until then the web's
  store buttons say "Coming soon". The iOS CI signing change (mobile.md 2026-11-14) is untested.
- **Desktop signing:** macOS done (signed and notarised download, 14 Nov). Windows: `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` (a paid code-signing certificate); until then the Windows installer shows SmartScreen's warning.
- **Optional branded MCP URL** (see CLAUDE.md).

Needs a real device (emulators and CI can't fully check these):
- Help links: desktop Help → Litma Help and Settings → Help and guide open the browser (not an app
  window); phone Settings → Help and guide opens the browser.
- Phone app on an iPhone and an Android phone: cover designer (drag, sizes), book and cover PDFs
  (fonts, margins, page breaks), Book details script switch, usage statistics arriving in /admin/.
- Website on iOS Safari: Manglish words typed mid-line convert when you tap away (checked with
  Chromium's iPhone and Pixel emulation only; WebKit couldn't be installed in the sandbox).

Help site:
- When a feature changes, update its guide in `apps/web/content/help/` (and its picture). Guides for
  sharing, sign-in and offline have no pictures yet (cloud-only screens); the dictionary lookup
  picture is the phone's.

Known differences by design:
- A book PDF made on the phone has no page numbers, running heads or right-hand chapter starts
  (the phone's web engine can't paginate like the web's print view). The phone makes the pages
  and the cover as two PDFs.

- Desktop app gets all 2026-11-07 changes only after Actions → **Release**.

From the 2026-11-08 writing aids (owner actions, free):
- **Push**, then check the Supabase job ran migration `20261108100000_writing_stats_retention` (it turns on pg_cron and schedules `prune_statistics`). Until then the apps fall back to `add_words_today` and the Goals page shows no minutes or hours.
- **Google Drive backup on the website:** enable the Drive API, add `getlitma.in` as a JavaScript origin of the Web OAuth client, add the `drive.file` scope to the consent screen, set the repo variable `GOOGLE_CLIENT_ID` (README → Google Drive backup). Without it the button stays hidden.
- **Desktop Release** for read aloud, rhymes, spelling, goals, the reminder kept by the main process, and the daily folder backup. **Phone store build** for the same on the phone.
- Unverified: the phone code (no Flutter SDK in the sandbox; new plugins flutter_local_notifications 22, timezone, flutter_tts, Android desugaring). Watch CI `mobile.yml` (`flutter analyze`, tests incl. `goals_test.dart`, `spell_test.dart`). Real devices: reminders after a reboot, the timer notification in the background, Google's Malayalam voice on Android, Edge's Malayalam voices on Windows.

## 2026-11-13: i18n gaps filled, and the every-change checklist

- `ml.json`: 98 writer-facing strings that existed only in English (Litma Community moderation, reasons, agreement, errors; AI grammar check; Settings admin link) now have Malayalam. Only `admin.*` (owner's dashboard) stays English.
- New `scripts/check-i18n.mjs` (`npm run i18n:check`): every en key in every other language except `admin.*`, no extra keys, same `{placeholders}`. Runs in the deploy job (fails the build).
- `CLAUDE.md` **Every change: the checklist**: strings in both languages, help guide, Privacy/Terms, credits, CSP and rate limits, setup guide, project docs and change logs, checks, Release. Pointers from `README.md` (Changing Litma) and `apps/web/content/help/README.md`.

## 2026-11-13: Help guides and sign-in messages for the security work

- Help: `01-getting-started.md` new guides **The quick security check** (`?a=security-check`) and **If your account is blocked** (`?a=blocked`), leaked-password note; `11-account.md` Get help links; `13-community.md` account blocks. Privacy: Cloudflare Turnstile listed, hashed-address rate limits. Sign-in messages for blocked accounts, leaked passwords and an unfinished check (web `lib/auth.tsx`, phone `authMessage`); the auth callback page explains Google's error too. README and phone README updated.

## 2026-11-13: Account deletion, admin blocking, rate limits, CAPTCHA, security headers

- **Delete account in every app** (App Store and Google Play rule): Edge Function `litma-account` (`{op:"delete",confirm:"DELETE"}`; removes storage files via `_shared/accounts.ts`, then `auth.admin.deleteUser`; every table cascades). Web/desktop `components/settings/DeleteAccount.tsx` (Settings, last section; then `forgetAccount` in `lib/offline.ts`, sign out, `/login/?deleted=1`). Phone `_DeleteAccount` in `settings_screen.dart`, `lib/data/account.dart`, `LocalDb.forget`. Help `/help/?a=delete-account` (public link for Google Play). Privacy and Terms updated (13 Nov).
- **Admin: block or delete an account** (/admin/ → Writers → a writer → Account, `components/admin/AccountActions.tsx`): block for 1/3/7/30/90/365/any days or for good (Supabase `ban_duration`; 36500 days), unblock, delete (type the email). `litma-admin` ops `block`/`unblock`/`delete`; refuses self and admins; every action in `admin_actions` (migration `20261113120000_admin_moderation.sql`, which also adds `banned_until` to `admin_users`). Blocked badge in the list. Terms and Privacy say so.
- **Rate limits:** `_shared/ratelimit.ts` (in-memory per instance, hashed IP or user id): `litma-transliterate` 600/min per address, `litma-track` 60 batches/min (extra dropped silently), `litma-spell` 120/min per writer, `litma-account` 5 per 10 min.
- **CAPTCHA (Cloudflare Turnstile), off until the owner turns it on:** page `/captcha/` (needs repo variable `TURNSTILE_SITE_KEY` → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`), framed by web/desktop (`components/auth/Captcha.tsx`, `useCaptcha`) and shown in a web view on the phone (`lib/features/auth/captcha.dart`, new dependency `webview_flutter`). Every sign-in, sign-up, email-link and reset call runs first without a token; only when Supabase answers `captcha_failed` does the check appear and the call repeat with the token. Setup: `docs/setup/google-and-supabase.md` 3.5 (also leaked-password protection).
- **Security headers** in `apps/web/public/.htaccess`: HSTS (1 year, no subdomains), Content-Security-Policy (self + Supabase, Google sign-in/Drive/Fonts, Datamuse, GitHub, Turnstile; `'unsafe-inline'` scripts for Next's static export), `frame-ancestors 'self'` + `X-Frame-Options SAMEORIGIN` (the `/captcha/` page also allows `app:` for the desktop app), Permissions-Policy.
- **Dictionary share-alike:** credits section and `THIRD_PARTY_NOTICES.md` say the files at `/dict/` are under ODbL 1.0 / CC BY-SA 4.0; `build-dictionary.mjs` writes `dict/LICENSE.txt`.
- Checked: web typecheck; a cloud-mode build with a mocked Supabase and Turnstile in Playwright (CSP headers served like .htaccess): no CSP violations on home, help, dictionary, legal, download, community, login, desk, settings, admin; sign-in shows the check and retries with the token; Delete account calls the function and lands on the notice; admin block/unblock/delete. Not checked: real Turnstile, the Edge Functions on Supabase (deploy), the phone (no Flutter here: run `flutter pub get && flutter analyze && flutter test`), the desktop iframe.

## 2026-11-13: Credits in one place only (owner)

- Removed source names from everywhere but the help section Credits and licences and `THIRD_PARTY_NOTICES.md`: the "Data: … from Olam. Opposites via Datamuse." line under dictionary entries (`DictionaryView.tsx`), the Olam link on the home page (`app/page.tsx`) and in `HowItWorks.tsx`, "Google Input Tools" in the home features and the Manglish panel (now "Online suggestions"), the mlmorph note in `03-editor.md`, Olam in `06-dictionary.md`, `rhyme.source` (en, ml; phone uses the same string). Terms → Dictionary, spelling and fonts now links to the credits section. README trimmed the same way. Privacy still names Google Input Tools as a service that sees data (a disclosure, not a credit).

## 2026-11-13: Credits for mlmorph and the other open work

- New `THIRD_PARTY_NOTICES.md` (repo root): mlmorph (full MIT text, Santhosh Thottingal and contributors, SMC; what was ported; sources of its mistakes list), Olam datasets (ODbL, CC BY-SA 4.0), Datamuse, SMC / Noto / Google fonts (SIL OFL), the `logos` collection (CC0). Header notes in `packages/shared/src/mlmorph.ts` and `litma-spell/index.ts` point to it.
- Help: new guide section **Credits and licences** (`content/help/11-account.md#credits`, `/help/?a=credits`); the editor guide's spelling note credits mlmorph and links there.
- Settings → About links to it on web and desktop (`AboutLitma`, opens in the browser on desktop via `useHelpHref`) and on the phone (Settings ListTile). New string `legal.credits`.
- README: spelling and grammar feature text, a **Spelling engine** and a **Credits** section, `litma-spell` in the table and layout. CLAUDE.md: credits rule under the spelling engine.
- Unverified: not built or clicked here (typecheck only); `flutter analyze` not run (no SDK in the cloud). Desktop gets the About link with the next Release.

## 2026-11-09: Litma Community (forum), guidelines and user-content notices

- New public-styled page `/community/` (web and desktop share it): categories, search (Manglish-aware), threads, replies, likes, edit/delete own posts, report, guideline agreement before the first post, and moderation for `app_admins` (close, reopen, remove, restore, pin, remove reply, stop a writer posting, reports queue). Details in `web.md`.
- Database: `supabase/migrations/20261109120000_community.sql` (tables `community_threads`, `community_replies`, `community_likes`, `community_reports`, `community_members`, `community_mod_log`; RLS, triggers, functions, 180-day purge by cron `litma-prune-community`). Checked in PGlite (Postgres 16 in WASM) with stand-in `auth.uid()`, roles and `app_admins`: 40+ cases incl. posting before agreeing, forged author/status fields, closed threads, bans, removed posts' visibility, admin-only functions, rate limit. Not yet run on Supabase.
- Legal: new `/community/guidelines/` (what is never allowed, moderation, "Who is responsible for posts", grievances); Terms of Use get a "Community and other people's content" section (user content is the writer's responsibility, intermediary status, indemnity) and a line in "The service"; Privacy Policy gets a "Litma Community" section. All dated 9 November 2026. The notice is not shown inside the writing app, only on the community, guidelines, Terms and Privacy pages.
- Desktop: no desktop-only code; it gets the pages with the next **Release**. Phone: Settings links to the community and the guidelines in the browser (`apps/mobile/lib/features/settings/settings_screen.dart`); native screens noted in `apps/mobile/README.md`. Strings `community.*` in `packages/i18n` (en + ml), copied by `npm run mobile:assets`.

## 2026-11-09: Instagram posters folder (marketing only, no app change)

- `marketing/posters/`: finished posters (`*_1080.png` to post, `*_master@3x.png` 3240 wide). `marketing/posters/.gitignore` allows only those two kinds of file plus the README.
- `.github/workflows/deploy.yml`: `marketing/**` added to `paths-ignore`, so poster and reel commits don't redeploy getlitma.in.

## 2026-11-09: Reel 3, 30 s launch ad with Malayalam voiceover (marketing only, no app change)

- `marketing/reels/reel-launch/` (HyperFrames, `SPEC.md`): the app in dark mode inside a plain phone frame on a
  soft colour-field backdrop, writer questions in bubbles, a monitor for the desktop beat, end card with
  getlitma.in. Owner's choices for this reel (override `docs/marketing/reels.md`): dark screens, phone frame,
  Malayalam voiceover, no subtitles. Reference: Sleeko Studio's HowDo launch ad.
- Footage: `marketing/reels/capture/rec-launch.cjs` (dark mode, 1170 x 2394 phone, 1920 x 1200 desktop).
- Voice: TTSForFree "Sobhana (Natural)" ml-IN; the Gemini voice did not fit the free daily quota. Cut into
  `assets/vo1..8.wav` at the pauses; the sentence-to-pause mapping was matched by timing, not heard.
- No music (HeyGen catalog needs a sign-in). No Release needed: nothing in the apps changed.

## 2026-11-09: Clearer FTP sign-in errors in the website deploy

- CI only (`deploy.yml`): port-21 check and the server's own replies when the getlitma.in sign-in fails. A deploy failed with "max-retries exceeded"; cause not yet known (password, username or the host blocking GitHub). Details in `web.md`.

## 2026-11-09: Desktop build retries and caches Electron

- CI only (`.github/workflows/desktop.yml`): Electron download cached, electron-builder retried 3 times after a GitHub 504 failed a Mac build. `npm ci` no longer downloads the Electron binary in CI (`ELECTRON_SKIP_BINARY_DOWNLOAD=1` in `desktop.yml` and `deploy.yml`). Details in `desktop.md`.

## 2026-11-09: Instagram reels (marketing only, no app change)

- Two 9:16 reels made from real footage of the app: `marketing/reels/reel-manglish` (HyperFrames: a short story typed in Manglish becomes Malayalam) and `marketing/reels/reel-types` (Remotion: the nine writing types land on the desk). Footage comes from `marketing/reels/capture` (Playwright screen recording of a local-mode build at 1080 x 1920, Google Fonts served from Fontsource). Workflow, rules and prompts: `docs/marketing/reels.md`; Claude skill `litma-reels`.
- No change to web, desktop or phone code: no Release or store build needed.
- Unverified: the reels are silent (music is meant to be added in Instagram); captures were made in a cloud sandbox, so check them once on the Mac with `npm run all` before re-rendering.

## 2026-11-08: Pages in the phone app's editor (phone only)

- The phone app's editor now shows pages as you write (about a printed page each, the next page when one fills, a small + between pages). The website on phones keeps its continuous sheet with the Pages switch; web and desktop unchanged. Details in `mobile.md`.

## 2026-11-08: Read aloud: voice, pitch, volume, word underline (all apps); save as audio (phone)

- Web and desktop: Pitch and Volume beside Speed, spoken word underlined when the voice reports words, settings apply from the next sentence. Phone: the same plus a voice picker, and **Save as an audio file** (WAV, made on the phone). Browsers can't record speech, so saving audio stays phone-only. Details in `web.md`, `desktop.md`, `mobile.md`. Desktop needs a Release; the phone needs a store build.

## 2026-11-08: Phone read aloud without a plugin (phone only)

- The phone app reads aloud through its own small channel instead of flutter_tts, so iOS builds use Swift Package Manager only and no CocoaPods. Details and what to check on devices: `mobile.md`. Web and desktop unchanged.

## 2026-11-08: Editor tools grouped (phone app, website on phones)

- The phone app's tools sheet was one flat 3-column grid of 17 tiles. It now has labelled groups in 4 columns: **Words** (Dictionary, Rhymes, Check, Saved words), **Plan and assist** (AI companion, Story World, Goals), **Page** (Format, Page setup, Contents, Pages, Insert page), **Review and share** (Listen, Version history, Share & export), then **For this work** (footnote, fill cast, scene tools, diary entry, only for their writing types).
- Phone app: Find moved to its own top-bar button; the Assistant inbox tile left the sheet and opens from an inbox icon in the AI companion's header (the keyboard strip's Inbox stays). Insert page stays a tile because Pages is a PDF preview and can't insert.
- Website on phones: the More sheet's tiles use the same group names (Inbox keeps its tile there for its count badge). Desktop and wide screens unchanged (the More sheet is phone-only).
- Strings `app.tools.group*` in `packages/i18n` (en, ml), `npm run mobile:assets` run. Help: `03-editor.md`, `09-ai.md`.
- Web typecheck passes; the web sheet and the phone code are unchecked in a browser or on a device (no Flutter SDK). Needs a phone store build; no desktop Release needed.

## 2026-11-08: Pin the work in progress (all apps, MCP)

- One work can be pinned to the top of the desk (Pinned badge, accent border, first whatever the sort). Stored as `profiles.preferences.pinnedWork` (one id, so pinning another moves the pin; follows the writer to every device; local mode `litma:pinned`). No migration.
- Web/desktop: `apps/web/src/lib/pin.ts`, pin button on each desk card (`app/desk/page.tsx`). Phone: long-press action and badge (`desk_screen.dart`, `pinnedWork()`). MCP: `pin_document`, `list_documents` lists the pinned work first as PINNED.
- Help `01-getting-started.md#pin`, README, CLAUDE.md. Checked on the web in local mode (pin, move, reload, unpin, phone width). Needs a desktop Release and a phone build; the phone part is unverified (no Flutter SDK).

## 2026-11-08: Free writing aids: rhymes, spelling, read aloud, goals and reminders, backup (all apps)

Owner asked for the features that cost nothing (no paid voice, no server-held Google access).
- **Rhymes (പ്രാസം):** `shared/rhyme.ts` + `scripts/build-rhymes.mjs` (188k headwords in 2,402 files under `dict/rhyme/`); editor panel, Dictionary പ്രാസം tab, phone tools sheet (`lib/data/rhyme.dart`), MCP `find_rhymes`.
- **Spelling and grammar:** `shared/spell.ts` + `dict/words/*.txt` (256k words); editor marks (`extensions/writing-aids.ts`) and Check panel; phone Check sheet (`lib/data/spell.dart`, a list); grammar via the AI `grammar` action (web, phone, Claude hand-over); MCP `check_spelling`.
- **Read aloud:** device voices only (Web Speech API; `flutter_tts`). Platform help when there is no Malayalam voice.
- **Goals, timer, reminders, statistics:** `shared/goals.ts` (Dart port `lib/data/goals.dart`), `/goals/` page, editor Goal and timer panel + timer chip, reminders (web tab, desktop main process `reminders.ts`, phone scheduled notifications), per-work goal with finish date (`settings.deadline`). New RPC `log_writing` and table `work_days`; `writing_days` gets `minutes` and `hours`.
- **Statistics kept 90 days** (owner): nightly pg_cron `prune_statistics()` on `analytics_events`, `writing_days`, `work_days`; admin ranges 7/30/90; best streak remembered in `preferences.goals.bestStreak`.
- **Backup:** zip with Word files + restorable JSON; download, Google Drive (website, `drive.file`), daily folder backup (desktop), share sheet + daily copy (phone); restore on web/desktop.
- Help: new topic `12-goals.md`, guides `#rhymes`, `#spelling`, `#read-aloud`, `#backup`, `#restore`; pictures `rhymes.webp`, `spelling.webp`, `goals.webp`. Privacy Policy dated 8 Nov 2026 (writing statistics, 90 days, Drive, voices). README, CLAUDE.md, mobile README.
- Checked (web, local mode, Playwright): rhymes in the panel and the Dictionary tab, spelling marks and fixes, read aloud with a stand-in Malayalam voice, timer end card, reminder card, backup download and restore, Goals page with sample data, phone layout. `npm run typecheck`, `npm run build`. Not checked: cloud mode against the real database (migration not applied from here), Drive upload, the desktop app, the phone app.

## 2026-11-08: Manglish engine accuracy (web, desktop, phone, MCP)

- Shared engine now types like writers do: നാട്, നമ്മുടെ, കടൽ, ഉണ്ട്, മനസ്സ്, ചന്ദ്രൻ, plus fixed
  spellings for common words (ആണ്, ഞാൻ, അവൾ, കഥ, പറയാം). Offline suggestion lists on web and
  phone. The MCP `transliterate` fallback gets it through `_shared`.
- Desktop needs a Release; phone needs a store build. Rules can't settle every word (ര/റ, ല/ള,
  ന/ണ, short/long e and o are lexical); those rely on the suggestion list or Google when online.
  A word list ranking candidates would be the next step.

## 2026-11-08: Help chips spacing, phone welcome spellings

- Web/desktop: margin above the help topic chips on phones (`HelpCenter.tsx`). Desktop needs a Release.
- Phone: welcome screen demo shows correct Malayalam (`welcome_screen.dart`). Needs a store build.
- The offline Dart Manglish engine still gives നാദു / പരയാം for naadu / parayaam; editor
  suggestions may show the same until it learns ട്/റ for those spellings.

## 2026-11-08: Admin link; phone taps on the page; desk header

- **Admin dashboard in the avatar menu (website only):** `AppHeader` shows it to admins
  (`admin.checkCached`, once per account per tab). `ADMIN_ON_THIS_APP` in `lib/admin.ts` is false in
  the desktop build, which now hides the Settings admin card too. The phone app has no admin link.
- **Phone editor:** a tap on empty paper (below the last line, between lines, margins) puts the
  cursor on the nearest line on screen (`tapPaper` in `editor/editor_screen.dart`), like the web's
  `caretNear`. Before, only a tap on a line's own text focused it.
- **Phone desk header:** the logo no longer jumps left after the title cross-fade
  (`AnimatedSwitcher.layoutBuilder` aligned left in `desk_screen.dart`).
- Needs: website deploy (push), desktop Release (Settings admin card hidden), phone build.

## 2026-11-08: Manglish in search (web, desktop, phone)

- New shared matcher `packages/shared/src/search.ts` (`romanise`, `soundKey`, `matchesSearch`,
  `manglishMatches`; synced to `supabase/functions/_shared`) and its Dart port
  `apps/mobile/lib/core/search.dart` with the same test cases (`test/search_test.dart`).
  Malayalam is romanised and both sides folded to a sound key (aspirates, long vowels, doubles,
  t/d merged; ന്റ = nt, റ്റ = tt), so `puthiya`, `pudiya` and `puth` all find പുതിയ.
- Used in: desk search (works), saved words, the നാട്ടറിവ് filter, and Find in a work, which
  lists the work's Malayalam words that sound like the typed Manglish as chips (`search.inMalayalam`).
  The dictionary lookup already handled Manglish.
- Needs: website deploy (push), desktop Release, phone build.

## 2026-11-08: Phone dictionary back arrow

- Phone only: the ← beside a word in the Dictionary now steps back through every word looked up,
  instead of toggling between the last two. The website and desktop use the browser's own back
  (`/dictionary/?w=`), which already worked. Needs a phone build.

## 2026-11-07 (evening): Publisher line on covers; help site

- **Publisher line readable and independent (web, desktop, phone):** the front cover's publisher name
  ("Litma Publishing House") is now its own cover part `publisher` (`COVER_PARTS.front`, Dart
  `coverPartsFront`), dragged and sized apart from the author (offsets `cover.offsets.publisher`).
  Over artwork it sits on a pill of the cover colour (82 %) in the full text colour, in Inter /
  Anek Malayalam, so it reads on dark corners (romance preset was the report). Web `pub()` in
  `CoverFront` (`components/book/Cover.tsx`), phone `pubPart()` in `_front` (`cover.dart`). All
  ten presets checked by eye in the print view. Old covers: the author keeps its place; the
  publisher line now sits under it as before (same spacing).
- **Help site (web):** `/help/` (+ `?c=<topic>`, `?a=<guide>`) in the home page's landing style:
  search, topic cards, guides with screenshots. Content is Markdown in `apps/web/content/help/`
  (README there explains how to add guides); 11 topics, 56 guides, 46 pictures in
  `public/help/shots/`. Linked from the home nav and footer, Settings → Help and guide, the
  account menu, the desktop Help menu (Help → Litma Help, F1 on Windows/Linux) and the phone's
  Settings → Help and guide. Desktop and phone open it in the browser.
- **Needs:** website deploy (push to main) for the help site and the web cover; a desktop Release
  for the desktop cover fix and Help menu; a phone build for the phone cover and Settings link.


## 2026-11-07: Print view, whole-book PDF on the phone, no changelog links

- **Web/desktop:** the print view (book and work PDFs) printed every sheet 32 px low: a white strip
  above the cover and extra pages. Fixed in the print CSS. Desktop gets it with a Release.
- **Phone:** the book export sheet has **Whole book (PDF)** (cover, pages, back cover in one file)
  beside the pages and cover files. Its pages are pictures (240 dpi); see `mobile.md`.
- **Web/desktop:** the update card's and the Help menu's "What's new" links to `CHANGELOG.md` are
  gone (owner's rule). Help → Report a problem writes to support@getlitma.in.
- **Emails:** the owner switched on the Send Email hook; Gmail no longer reports a missing
  Message-ID. Branded emails are done.
- Owner's own book had the old jayageetham.com/litma address in its back-cover Website field;
  changed to getlitma.in. The other jayageetham references in the repo are deliberate (old-address
  redirect, accepting the old address, the GitHub account name, the desktop app id).

## 2026-11-07: Email links work in any browser

- Reset link showed "PKCE code verifier not found": Supabase's verify link becomes a PKCE code
  that only the browser which asked can redeem (another browser, the Gmail app, cleared storage
  all fail). The send-email hook now links website and desktop requests straight to
  `getlitma.in/auth/callback/?token_hash=…&type=…` (plus `next`), and the callback page verifies
  with `verifyOtp`, which works anywhere. The phone app's own scheme keeps Supabase's verify link.
  Raw Supabase errors on that page became plain messages.
- Needs the Send Email hook switched on; with the hook off the dashboard templates still use
  Supabase's verify link (same-browser only). Desktop gets the forgot-password change with a Release.
- Checked: hook links per case (Deno + local SMTP); callback page with a mock Supabase in a fresh
  browser (good link → Choose a new password, expired → plain message).

## 2026-11-07: Sign-in emails from Litma's own mailbox

- Owner set up `no-reply@getlitma.in` (sending) and `support@getlitma.in` (help, forwarded) in
  cPanel and custom SMTP in Supabase. Mail arrived with SPF, DKIM and DMARC passing but went to
  Gmail spam: Supabase's mailer sent no Message-ID (`SMTPIN_ADDED_MISSING`) and the host's shared
  server (lin31.plreseller.com, 43.254.29.98) has a mixed reputation. The owner doesn't want a
  third-party sender.
- New Edge Function `litma-send-email` (Supabase Send Email hook) sends the same templates through
  the cPanel mailbox with a Message-ID on getlitma.in, Reply-To support, a plain-text part and
  automated-mail headers. Tested in the sandbox with Deno against a local SMTP server (all six
  actions, email change to both addresses, forged signature refused, mail-server failure answers
  in under Supabase's hook timeout).
- Every email's footer names support@getlitma.in.
- **Owner steps:** hook secret and `SMTP_PASSWORD` secret, then switch the hook on (see the
  setup page / CLAUDE.md "Auth emails"). Unverified until then: delivery from Supabase's servers
  to mail.getlitma.in:465 through the host's firewall, and Gmail's verdict.

## 2026-11-07: Phone app catches up with the web's book tools and statistics (PR #6)

- **Phone app:** cover designer (front and back, same presets, layouts, fonts, backgrounds,
  effects, dragging and sizing as the web), the real cover on the desk and book screen, Book
  details with the മലയാളം / As typed switch, Publisher, Year, Edition, ISBN and Page & type,
  sample values for new books, editing and adding book pages, book PDFs (pages + cover), usage
  statistics with the Settings switch.
- **Phone PDFs** (works and books) now carry the app's own fonts, keep empty lines as section
  breaks and number footnotes with a notes list.
- **Web/desktop:** Book details and cover designer labels come from the shared strings (they were
  hard-coded English), so they show in Malayalam too.
- **Server:** `litma-track` labels phone visits (iOS/Android, phone/tablet, "Litma app").
- **CI:** phone screenshots on every pull request, pushed to the `ci/phone-screens` branch
  (one commit, replaced each run) and uploaded as the `phone-screens` artifact.

## 2026-11-07: Phone editor tools; Linux desktop; in-app confirm dialogs (PRs #4, #5)

- **Phone app (#5):** format sheet (font size, text colour, highlight, lists, alignment,
  super/subscript), contents, find and replace, saved words, page setup and Pages preview,
  Insert page, footnotes, diary New entry, play cast list, screenplay scene tools, metre marks.
- **Desktop (#4):** Linux AppImage built and published with the others; the updater swaps it in
  place. Download page and home card offer Linux.
- **Web/desktop (#4):** Story World card delete and version restore use the app's own confirm
  dialog (no native `confirm()` left).

## 2026-11-07: Empty line is a section break (novel, story)

- Owner's choice (option 3, with option 2): an empty line sits at the margin and so does the
  paragraph after it, like after a chapter heading. Other paragraphs keep the 1.6em book indent.
  Applies to the editor, reader, PDF/book output and Word export on web and desktop, and to the
  phone app's editor and reader.

## 2026-11-07: Keyboard on the phone app's desk

- Phone app only: the keyboard no longer opens on the desk after leaving the editor, and tapping
  outside a form or search field closes it (see `mobile.md`). The website and desktop use the
  browser's own focus handling, which already behaves this way.

## 2026-11-07: Assistant inbox, keyboard strip, Manglish suggestions

Reported by the owner from the iPhone app. Same behaviour on web (phone layout), desktop and
the phone app.

- **Copy no longer removes an inbox suggestion.** Only Apply or Dismiss clears it. The button
  shows "Copied" for a moment.
- **Inbox text is selectable**, so one idea from a list can be copied.
- **Assistant inbox button in the keyboard strip** (hides the keyboard, opens the inbox).
- **Keyboard strip remembers its scroll position** across keyboard open/close.
- **Manglish suggestion strip shows every spelling** (up to 18) in a row that scrolls sideways,
  instead of 3. The phone app now fetches 18 like the web.
- **A Manglish word typed in the middle of a line converts when the cursor leaves it** (or the
  line/editor loses focus). Before, only typing a space or punctuation converted it, and mid-line
  the space was already there. Text typed in English mode, or kept with "Keep English", is never
  converted later.
- **Picking a suggestion mid-line** steps over the existing space instead of adding a second one
  (phone app).
- New strings: `mobile.inbox`, `app.inbox.copy`, `app.inbox.copied` (en, ml).
