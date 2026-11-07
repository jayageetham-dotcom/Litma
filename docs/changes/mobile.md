# Phone app changes (apps/mobile, Flutter)

Reaches writers only through store builds. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- Sessions without the Flutter SDK (the cloud sandbox can't download it) rely on CI: `flutter
  analyze` (infos fail it too), `flutter test`, and the screenshots job, whose pictures are on the
  `ci/phone-screens` branch (`git fetch origin ci/phone-screens`).
- Try on a real iPhone and Android phone: everything from 2026-11-07 (inbox, keyboard strip,
  suggestion row, mid-line Manglish, desk keyboard, editor tools from #5, cover designer, book
  PDFs, Book details, statistics reaching /admin/).
- The phone can't edit book pages that carry formatting (shown read-only with a note), and
  can't upload pictures (uploads are off everywhere for now).

## 2026-11-07: cover designer, book details, book PDFs, statistics (PR #6)

- `lib/features/books/cover.dart`: covers drawn like the web's CoverFront/CoverBack in the same
  210 × 297 mm space (layouts, presets, backgrounds, frame, effects, divider, badge, publisher
  mark, back cover with author picture, imprint strip and EAN-13 barcode), `bookSamples`,
  `isbn13`. `forPrint` decodes the background at full size.
- `lib/features/books/cover_designer.dart`: the designer screen (cover stays in view; tap a text
  to size it, drag to move; tools scroll below), `pickCoverColour`.
- `lib/features/books/book_screen.dart`: real cover on the desk card and book screen, Contents /
  Book details tabs, page editing sheet (plain text only; formatted pages read-only), Add page,
  export sheet, sample values on open, a cleared field stays empty.
- `lib/features/books/book_export.dart`: `bookInteriorHtml` (pages like `lib/book-sections.ts`),
  `buildCoverPdf` (draws both covers at 1748 px wide and writes a two-page PDF with the `pdf`
  package), `bookPageFormat`, `showBookPdf`.
- `lib/editor/export.dart`: `docBodyHtml` and `exportCss` shared by works and books; empty line =
  section break (`p.gap`), footnotes numbered and listed, lists, super/subscript.
  `lib/editor/pdf_fonts.dart` embeds the bundled fonts in PDFs.
- `lib/widgets/script_field.dart` (മലയാളം / As typed); `toMalayalam` moved to `core/manglish.dart`.
- `lib/data/analytics.dart`: statistics like the web (`Analytics.screen/track/tap/input`), started
  in `main.dart`, Settings switch, events from `store.dart`, `dictionary.dart`, `auth.dart`,
  exports and the editor's tools sheet.
- `assets/covers/*.jpg` re-rendered at 1500 × 2220 (`scripts/render-mobile-covers.py`);
  `assets/fonts/covers/` holds the SMC and other title fonts (OFL).
- Tests: `test/books_test.dart`; screenshots for the designer, presets sheet and Book details.

## 2026-11-07: editor tools (PR #5)

- `lib/editor/work_tools.dart` (format, contents, find, saved words, page setup, Pages preview,
  footnote dialog, cast list, scene tools), `lib/core/metre.dart`, session tools in
  `session.dart`; tests in `test/tools_test.dart`.

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
