# Interaction and keyboard audit, every app (branch `claude/interaction-audit`)

Owner's ask (26 Nov 17:33, on phone 0.7.33): "I selected a word and clicked outside which doesnt deselect the word. I need the tester agent to test all these events, interactions, keyboard accessibility and all across app in different features."
Lead: Claude session (claude.ai/code) · Started: 2026-11-26

## Decisions
- 2026-11-26 Lead fixed the reported bug first: `tapPaper` (apps/mobile/lib/editor/editor_screen.dart) now calls `session.clearSpan()`; before, `clearSpan` was never called anywhere, so a tap below the text on the already-focused line kept the highlight, handles and bar.
- 2026-11-26 The owner asked the lead to merge its own branches once tested.

## Questions
- → designer (tester, 26 Nov): phone selection bar placement (phone bug 3). Above the selection it covers the line above, which the owner wants to see. Options: keep one full line clear above (bar top = start line top minus one line height minus the bar), or dock it above the keyboard / tab bar like the web's MobileSelectionBar. Docked also fixes phone bug 6.
- → designer / owner (tester, 26 Nov): web Manglish, should Enter after ↓ only pick the suggestion (combobox behaviour, like Google Input Tools) rather than pick and start a new paragraph? (web item 6)


## Design spec (designer)
Where it lives on desktop and phone, every state, exact strings (en + ml), components and tokens.

## Build (web-dev)
Shared engine, web/desktop, MCP, Edge Functions. Files changed, checks run, what the phone must mirror.

## Build (flutter-dev)
Phone port, vector tests, CI run id.

## Build (keyboard-dev)
Only when the keyboard is involved.

## Design review (designer)
Screenshots (paths), concrete fixes, status of each.

## Tests (tester)
Tester, 26 Nov. Web in local mode (`next dev -p 3130`, Playwright, Chromium) at 1440 px and 390 px with touch, light and dark; axe-core 4 on desk, dictionary (3 views), settings, help, goals, books, trash, profile and the editor. Phone: `apps/mobile/test/selection_test.dart` (pumps the whole EditorScreen at 390 × 844 with the app's fonts), run on CI. Scripts: `/tmp/tester3/scripts/*.py`; screenshots `/tmp/tester3/`.

### Phone app (Flutter): six bugs, each a skipped test in selection_test.dart (`knownBug`)
Remove the `skip:` of a test once its bug is fixed. Confirmed on CI runs 45818896148 / 45819976059.
1. **High. Long press on a line that does not hold the keyboard: the selection is invisible.** CI: field selection 7..13, focused, `hasSpan=false`. The field reports the word, then gets focus; the focus listener in `session.focusFor` ("went to another line") clears `_anchor/_extent`. No highlight, handles or bar (field highlight is transparent), and typing replaces a word the writer can't see. Test: "a long press on a line that does not hold the keyboard shows the selection".
2. **High. Bold / Italic on a one-line selection ends it.** `session.toggleMark` → `BlockController.toggleMark` → `onChanged(textChanged: true)` → `_followFieldSelection` clears the span; the word stays selected invisibly in the field. Same path for the keyboard strip B/I/U and the Format sheet. Test: "Bold or Italic from the bar keeps a one-line selection".
3. **High (owner's screenshot). The bar covers the line above the selection.** CI geometry: bar 153.7–193.7, selected line 209.6–238.6, line above 178.2–207.2. `_bar()` puts it at `anchor.top - 44 - 12`. The bar is wider than the phone (it scrolls), so a tap meant for the line above lands on Cut / Paste / Delete. With no room above it goes below the end handle (fine); with the keyboard up it stays on screen (fine). Test: "bar placement: the line above the selection stays visible and tappable". → designer question below.
4. **Medium. Keyboard hidden, then a tap in the same line: the selection stays.** The field reports the tap's cursor before it has focus, `_followFieldSelection` ignores it ("a field losing focus doesn't"), and the focus listener doesn't clear because `focused` is still that line. Test: "keyboard hidden with a selection, then a tap in the same line".
5. **Medium. Taps beside a selection end do nothing.** `selection_layer.dart _handle()` is an opaque 44 px wide `GestureDetector` (pan only) from the caret top to under the knob; text 22 px each side of each end, and part of the line below, can't be tapped. Test: "a tap right after the selected word (beside the end handle)".
6. **Low. Selection scrolled far away: the bar floats over other text.** Lines stay built 2,400 px off screen (`scrollCacheExtent`), so `_geometry` still has the ends and `_bar()` clamps its top to 8. Test: "a selection scrolled off screen leaves no bar over other text".

Passing on CI (regression guards): owner's case (long press in the focused line, tap on the paper below: span, bar and field selection all cleared; lead's `tapPaper` fix works), tap on another line, tap elsewhere in the same line, Select all ↔ Deselect all (no hidden field selection left), bar Copy / Cut / Paste / Delete / Bold, bar never over the selected line, spelling Ignore in the strip (clears the word in every line, kept in `settings.spellIgnored`).
**Test of mine still failing (harness, not the app), for the lead since I may not edit apps/mobile now:** "Hide keyboard in the strip…" fails in `dragUntilVisible` because `find.ancestor(of: find.byTooltip('Undo'), matching: find.byType(Scrollable))` finds nothing. Use `find.byTooltip('Bold')` (found on CI) as the anchor for the strip's Scrollable, or skip the test.

Read in the code, not tested: Android back with a selection leaves the editor at once (`PopScope` has no handler; Android convention is that back first ends the selection). On tablets (≥ 760 px) taps on the grey canvas beside the sheet reach nothing (the `GestureDetector` is only the 760 px sheet), so they don't end a selection. The footer row (`_Footer`, words · read time · mode chip) has no `Flexible`; with the test font it overflowed by 189 px, so check it at the largest system text size.

### Web and desktop, ranked
1. **High, phone layout (390). The selection bar sits under the page text when the editor isn't focused, and its buttons can't be tapped.** Steps: open a novel, select a word, tap Look up in the selection bar, press Esc (or close the sheet). The bar shows above the tab bar but the text paints over it; `elementFromPoint` at Ask AI's centre is a `<p>` in the editor, and tapping Ask AI puts the cursor in the text instead. Cause: `Workspace.tsx` ~1156, the tab-bar branch wraps the bar in `<div className="relative">` with no z-index. Screenshots: `/tmp/tester3/p-lookup-esc-2s.png` (bad), `/tmp/tester3/p-selbar.png` (fine with the keyboard strip).
2. **High, every screen size. The writing-type picker (New work) is a modal that keyboard users can't use.** `aria-modal="true"` but focus stays on New work behind it, Tab walks Works / Books / Trash / downloads before reaching it, Esc doesn't close it (even with focus inside). `app/desk/page.tsx:436`. Its `aria-label="Choose a writing type"` is inline English (i18n rule). Screenshot `/tmp/tester3/desk-newwork.png`.
3. **Medium. Find bar: Esc or Close drops focus to `<body>` and the match is not selected.** Ctrl+F, type മഴ, Enter, Esc: focus on body, no selection, typing goes nowhere. `FindBar` in `Workspace.tsx` (~1342; `onClose` only unmounts). Expected: focus back in the text with the current match selected.
4. **Medium, phone layout. Bottom sheets don't take focus or give it back.** Format, Contents, Dictionary, More are `role=dialog aria-modal=true` but focus stays on body when they open, and after Esc / close it isn't returned to the editor (Look up → Esc leaves body focused with the kept highlight). `components/ui/Sheet.tsx`. Tap above a sheet closes it and the page behind doesn't scroll (good).
5. **Medium, desktop. A click on blank chrome (outline panel, status bar) sends focus to `<body>`** and the kept-selection highlight stays until the next click in the text; typing then does nothing. The canvas beside the page and the page margins are fine (`caretNear`). Keep-selection is by design; losing focus to body is not.
6. **Low–medium. Manglish: ↓ to a suggestion, then Enter picks it and also starts a new paragraph** (`COMMIT_KEYS` has Enter and `handleKeyDown` returns false after `commit`, `extensions/manglish.ts`). Matches the shortcuts list ("Space · Enter · punctuation"), but a combobox Enter should only pick. → question below.
7. **Low. Rail tool buttons have no `aria-pressed` / `aria-expanded`**, so a screen reader can't tell which panel is open; at 1440 px the Outline toggle drops focus to body.
8. **Low, i18n. Inline English:** `MobileSelectionBar` labels "Bold", "Italic", "Copy" (`Toolbar.tsx` ~621–627) and the picker's aria-label (item 2).
9. **Low, axe (serious only).** `/goals/`: progress bar with no name; reminder field labels 2.31:1 light, 2.84:1 dark. `/help/`: `.text-ink/40` text 2.61:1. `/dictionary/?view=rhyme`: count in the tab chips 3.76:1. `/settings/`: the MCP command `<pre>` scrolls but can't be focused. Every page: logo `aria-label="Litma home"` doesn't contain the visible ലിറ്റ്മ (label-content-name-mismatch). Desk, dictionary, books, trash, profile and editor otherwise clean, light and dark.
10. **Low. Editor tab order starts at the right rail and zoom**, then the top bar, toolbar and text. Ctrl+S shows nothing visible in local mode (unverified in cloud).

Passed (web): select a word then click the page margin, the grey canvas, the gap between pages (caret moves there, selection ends, focus stays in the text), Insert page in the gap, toolbar Bold keeps the selection, arrow keys collapse it; phone: tap margin / another paragraph ends the selection and its bar, the bar's Close works. Right-click menu: opens, ↓ moves `aria-activedescendant` (`ctx-` prefix), Esc, click outside and scroll close it, focus stays in the text. Paragraph style `Select`, Text colour: Esc and click outside close them, focus stays in the text. Export / Share popovers: `aria-expanded`, Esc returns focus to the button, click outside closes. Shortcuts dialog: focus on Close, Tab trapped, Esc returns focus to the ? button, Ctrl+/ opens it. Rail panels at 1440: Esc closes every one. Shortcuts that work: Ctrl+M cycle, Manglish 1–6, ↓↑, PageDown, Esc keeps English, click outside finishes the word, Ctrl+Shift+M, Ctrl+B/I/U, Ctrl+Z / Ctrl+Shift+Z, Ctrl+Shift+L, Ctrl+Shift+F, Ctrl+F. Focus rings visible on every Tab stop checked (desk, dictionary, നാട്ടറിവ്, settings, help, goals, editor).

Not tested: the Electron app; book editor and cover designer; Story World card editor; settings and help by keyboard beyond Tab order; Ctrl+P (headless); desk pin / delete / restore by keyboard (blocked by item 2 in my run); dark mode screenshots on the phone layout; screen readers themselves (only roles, names and axe).

Status: all open, handed to the lead (phone 1–6, web 1–10).

## Verification (verifier)
Checklist result, CI status, verdict: MERGE / DON'T MERGE, blocking issues.
