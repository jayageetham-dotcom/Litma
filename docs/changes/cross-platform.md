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
- **Branded auth emails:** paste `supabase/templates/*` into Supabase and set up custom SMTP.
- **Optional branded MCP URL** (see CLAUDE.md).

Needs a real device (emulators and CI can't fully check these):
- Phone app on an iPhone and an Android phone: cover designer (drag, sizes), book and cover PDFs
  (fonts, margins, page breaks), Book details script switch, usage statistics arriving in /admin/.
- Website on iOS Safari: Manglish words typed mid-line convert when you tap away (checked with
  Chromium's iPhone and Pixel emulation only; WebKit couldn't be installed in the sandbox).

Known differences by design:
- A book PDF made on the phone has no page numbers, running heads or right-hand chapter starts
  (the phone's web engine can't paginate like the web's print view). The phone makes the pages
  and the cover as two PDFs.

- Desktop app gets all 2026-11-07 changes only after Actions → **Release**.

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
