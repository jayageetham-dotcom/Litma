# Cross-platform changes

Work that touches more than one Litma app (web, desktop, phone). Per-app details live in
`web.md`, `desktop.md` and `mobile.md` next to this file.

**Every session:** read these four files before starting, then add what you changed (newest
first) and update **Open items** before you finish. Keep entries short: what changed, where in
the code, and what is still unverified.

## Open items

### Still open (after the 2026-11-07 work)

Only the owner can do these (accounts, secrets, dashboards):
- **Phone app in the stores:** App Store Connect and Google Play Console accounts, then the store
  secrets listed at the top of `.github/workflows/mobile-release.yml`; until then the web's store
  buttons say "Coming soon".
- **Desktop signing:** `CSC_LINK`/`CSC_KEY_PASSWORD` and Apple notarisation (`APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) for macOS, `WIN_CSC_LINK` for Windows. Unsigned
  installers show security warnings.
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
