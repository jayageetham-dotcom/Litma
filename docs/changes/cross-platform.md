# Cross-platform changes

Work that touches more than one Litma app (web, desktop, phone). Per-app details live in
`web.md`, `desktop.md` and `mobile.md` next to this file.

**Every session:** read these four files before starting, then add what you changed (newest
first) and update **Open items** before you finish. Keep entries short: what changed, where in
the code, and what is still unverified.

## Open items

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
