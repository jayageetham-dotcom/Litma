# Phone app changes (apps/mobile, Flutter)

Reaches writers only through store builds. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- The 2026-11-07 changes were written in a session without the Flutter SDK; `flutter analyze`
  and `flutter test` ran in CI (`mobile.yml`) only. Try them on a real iPhone: inbox Copy and
  selection, the inbox tool in the keyboard bar, the scrolling suggestion row, and a Manglish
  word typed mid-line converting when you tap elsewhere.

## 2026-11-07

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
