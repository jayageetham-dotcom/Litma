# Cross-platform changes

Work that touches more than one Litma app (web, desktop, phone). Per-app details live in
`web.md`, `desktop.md` and `mobile.md` next to this file.

**Every session:** read these four files before starting, then add what you changed (newest
first) and update **Open items** before you finish. Keep entries short: what changed, where in
the code, and what is still unverified.

## Open items

### Feature gaps (audit 2026-11-07)

Phone app (Flutter) is behind the web editor and book tools. Missing:
- **Cover designer** (front and back): layouts, Frame, presets, genre backgrounds, title fonts
  and effects, dragging parts, back-cover blurb, author note, imprint strip, EAN-13 barcode.
  The app only draws a small cover in the book's colours (`MiniCover` in `book_screen.dart`).
  Spec: README "Cover designer", "Cover presets and sample values".
- **Book details extras:** മലയാളം / As typed switch (`ScriptField`), sample values for
  never-set fields (`book-samples.ts`).
- **Editor formatting:** font size, text colour and highlight, bulleted and numbered lists
  (shown but can't be made), page setup (font, page size, line spacing), the വൃത്തം metre
  marks, find in the work.
- **Writing-type tools:** insert a footnote (shown but can't be added), play cast list from
  Story World, screenplay scene tools (Int./Ext., time, fill cast), diary "New entry", layout
  settings (chapter numbers, heading labels, verse alignment).
- **Pages:** the "Pages" switch to see printed pages, and Insert page.
- **Outline / contents panel** for a work, and the Saved words panel inside the editor.
- **Usage statistics** (`litma-track` events and the Settings switch).
- **Store release:** the App Store / Google Play secrets aren't set, so the app isn't in the
  stores yet and the web's store buttons say "Coming soon".

Desktop (Electron):
- Installers are **unsigned** until signing secrets exist (`CSC_LINK`, Apple notarisation,
  `WIN_CSC_LINK`): macOS and Windows show security warnings.
- No Linux build.
- Not yet driven end to end with Playwright's Electron runner in a session.

Web:
- Branded auth emails (owner pastes templates, sets up SMTP), optional branded MCP URL, and two
  old native `confirm()` calls (Story World card delete, version restore). See CLAUDE.md.
- Manglish "finish when leaving the word" not yet tried on a real phone browser.

- Desktop app gets the 2026-11-07 changes only after Actions → **Release**.

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
