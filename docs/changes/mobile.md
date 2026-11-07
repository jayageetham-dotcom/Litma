# Phone app changes (apps/mobile, Flutter)

Reaches writers only through store builds. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- The 2026-11-07 changes were written in a session without the Flutter SDK; `flutter analyze`
  and `flutter test` ran in CI (`mobile.yml`) only. Try them on a real iPhone: inbox Copy and
  selection, the inbox tool in the keyboard bar, the scrolling suggestion row, and a Manglish
  word typed mid-line converting when you tap elsewhere.

## 2026-11-07: empty line is a section break

- `lib/editor/block_style.dart` `lookFor`: no indent for an empty paragraph or the paragraph
  after one (`afterBreak`). Used by the editor and the reader (`computeLooks`).
- Test: `test/indent_test.dart`.

## 2026-11-07: keyboard on the desk

- The keyboard opened on the desk for no reason after coming back from the editor: Flutter gave
  focus back to the desk's search field. `lib/core/keyboard.dart` `KeyboardRouteObserver`
  (registered in `app/app.dart`) unfocuses when a full screen is pushed or popped (sheets and
  dialogs are left alone).
- Tapping outside a text field now closes the keyboard (`onTapOutside: dismissKeyboard`) on the
  desk search, dictionary, sign-in, profile, book details and Story World card fields. Not on
  the editor's lines (its toolbar must keep the keyboard). The desk search's key is "Search"
  and closes the keyboard; scrolling the desk closes it too.
- Unverified on a device: check that leaving the editor no longer opens the keyboard on the
  desk, and that a field that should autofocus (new Story World card) still does.

## 2026-11-07: inbox, keyboard strip, Manglish

- `lib/editor/tools.dart` `_Inbox`: `_copy` copies without removing (Copied state for 1.6 s);
  Apply only for insert/replace; card text wrapped in `SelectionArea`, buttons in
  `SelectionContainer.disabled`.
- `lib/editor/editor_screen.dart` `_KeyboardBar`: now stateful; the tool row's `ScrollController`
  starts from the remembered `_barOffset`; new inbox tool (unfocuses, opens `showInboxSheet`).
  `_Suggestions`: keep-English chip, then every candidate in a horizontal `ListView` keyed by
  the word (new word starts at the beginning).
- `lib/core/config.dart`: `Transliterator.maxCandidates` 3 → 18 (same as the web's
  `MAX_CANDIDATES`).
- `lib/editor/block_controller.dart`: `_typedLatin` marks a Manglish word typed just now;
  `_finishWord` converts it when a selection-only change moves the cursor off it;
  `finishPendingWord()` (called from `session.dart` when the line loses focus).
  `replaceWordAtCursor` steps over an existing space instead of adding one.
- Tests: `test/editor_test.dart` (mid-line conversion, staying inside the word, leaving the
  line, English-mode text untouched, picking mid-line), `test/phases_test.dart` (18 candidates).
