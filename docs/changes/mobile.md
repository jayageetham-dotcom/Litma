# Phone app changes (apps/mobile, Flutter)

Reaches writers only through store builds. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- Sessions without the Flutter SDK (the cloud sandbox can't download it) rely on CI: `flutter
  analyze` (infos fail it too), `flutter test`, and the screenshots job, whose pictures are on the
  `ci/phone-screens` branch (`git fetch origin ci/phone-screens`).
- Try on a real iPhone and Android phone: everything from 2026-11-07 (inbox, keyboard strip,
  suggestion row, mid-line Manglish, desk keyboard, editor tools from #5, cover designer, book
  PDFs including the whole-book PDF, Book details, statistics reaching /admin/).
- Writing aids (2026-11-08) need a CI run and a device check (see that entry). Still to do on the phone: spelling marks inside the text, restore from a backup, Drive backup without the share sheet.
- The phone can't edit book pages that carry formatting (shown read-only with a note), and
  can't upload pictures (uploads are off everywhere for now).

## 2026-11-08: Listen: voice picker, pitch, volume, word underline, save as audio

- `lib/core/speech.dart`: `voices()`, `speak(voice:, rate:, pitch:, volume:)`, `words` stream (`SpokenWord` UTF-16 offsets), `synthesizeToFile()`, `stop()`, `dispose()` (only the newest `Speech` owns the channel). Native: iOS `LitmaSpeech` in `ios/Runner/AppDelegate.swift` (voices by quality, `pitchMultiplier`, `volume`, `willSpeakRangeOfSpeechString` → `word`, `AVSpeechSynthesizer.write` into a WAV through `AVAudioFile`); Android `LitmaSpeech.kt` (voices without `notInstalled`, offline first, `setVoice`/`setPitch`, `KEY_PARAM_VOLUME`, `onRangeStart` (Android 8+) → `word`, `synthesizeToFile`).
- `lib/core/wav.dart` + `test/wav_test.dart`: joins the per-piece WAV files (engines take ~4,000 characters) into one; refuses parts of different formats.
- `lib/editor/writing_aids.dart` `_ReadAloud`: voice chips (with two or more voices; Android's coded names shown as "Voice n", online ones marked), Speed, Pitch, Volume sliders (prefs `litma:read-*`, same keys as the web), the spoken word underlined in the sentence box, **Save as an audio file** (whole work in pieces of ≤ 3,000 characters, progress and Stop, then the share sheet; temp parts deleted).
- Unverified: built only by reasoning here. Needs `flutter analyze`, `flutter test`, the iPhone build (`scripts/ios-personal.sh`) and an Android phone with Google's Malayalam voice: word underline, voice switch, pitch/volume, saved WAV plays and has the whole work. iPhones have no Malayalam voice yet, so iOS shows the "no voice" help.

## 2026-11-08: Tools sheet in groups

- `lib/editor/tools.dart` `showToolsSheet`: groups (`app.tools.groupWords/Plan/Page/Share/Work`), 4 columns, smaller tiles (38px icon box, labelSmall), empty groups dropped. Analytics keys unchanged.
- Find: new search `IconButton` before the tools button in `editor_screen.dart`. Inbox: `IconButton` in the AI sheet header (`_AiSheetState`), tile removed.
- Unverified: `flutter analyze` and how the top bar fits with the timer chip on small phones; `phone-tools.webp` in help and the CI screenshots show the old grid.

## 2026-11-08: Read aloud without flutter_tts (no CocoaPods on iOS)

- flutter_tts (newest 4.2.5) has no Swift Package Manager support, so Flutter warned and pulled CocoaPods into the iOS project. Replaced by Litma's own channel `in.getlitma/speech`: `lib/core/speech.dart` (`hasVoice`, `speak` that completes when the sentence is read, `stop`; rate 1.0 is normal speed on both platforms), iOS `LitmaSpeech` in `ios/Runner/AppDelegate.swift` (AVSpeechSynthesizer, `.playback`/`.spokenAudio` audio session so it reads with the silent switch on), Android `android/app/src/main/kotlin/in/getlitma/litma/LitmaSpeech.kt` (TextToSpeech, registered in `MainActivity.kt`; the manifest's `TTS_SERVICE` query stays). `lib/editor/writing_aids.dart` `_ReadAloud` uses it; speed changes now apply from the next sentence.
- flutter_tts removed from `pubspec.yaml`/`pubspec.lock`; `ios/Podfile`, `Podfile.lock` and the Pods lines in `Flutter/*.xcconfig`, `project.pbxproj` and the workspace removed (back to the pre-CocoaPods files).
- Unverified: built only by reasoning (no Flutter/Xcode here). Check on the iPhone (`scripts/ios-personal.sh`: no Swift Package Manager warning, Listen speaks, pause/stop/speed) and an Android phone or CI.

## 2026-11-08: timezone constraint for notifications

- `apps/mobile/pubspec.yaml`: `timezone` ^0.10.1 → ^0.11.2, because flutter_local_notifications ^22 needs timezone ^0.11 (pub get failed in `scripts/ios-personal.sh`). `lib/data/notifications.dart` only uses `tz.TZDateTime.from` and `tz.UTC`, unchanged in 0.11. `pubspec.lock` now lists flutter_local_notifications 22.3.3, timezone 0.11.2 and flutter_tts 4.2.5. flutter_tts brought CocoaPods into the iOS project; removed again by the entry above. Built on the owner's Mac with `scripts/ios-personal.sh`; CI unverified.

## 2026-11-08: Pinned work on the desk

- `lib/features/desk/desk_screen.dart`: `pinnedWork(profile)`, pinned work first in Works, accent border and Pinned badge on `WorkCard(pinned:)`, Pin to the top / Unpin in the long-press sheet (saves `preferences.pinnedWork` through `updateProfile`, works offline through the outbox). Unverified: CI only.

## 2026-11-08: Rhymes, spelling, read aloud, goals and timer, reminders, statistics, backup

- New: `lib/data/rhyme.dart`, `spell.dart`, `goals.dart`, `notifications.dart`, `backup.dart`; `lib/core/zip.dart`; `lib/editor/writing_aids.dart` (Rhymes, Check, Listen, Goals sheets), `writing_timer.dart` (chip in the editor bar, snack bar at the end); `lib/features/goals/goals_screen.dart` (from Settings and the profile). Tests `test/goals_test.dart`, `test/spell_test.dart`.
- Changed: tools sheet tiles, `Dictionary.file/text/mlShardName`, `Store.logWriting` (+ `writingChanged`, `wordsByDay` as `WritingDay`, `workDays`), offline outbox merging and `log_writing` fallback, session minutes and `replaceInLine`, AI sheet `start:` and the `grammar` action, desk streak with rest days and reminder scheduling, profile heatmap 13 weeks, Settings Goals + Backup.
- pubspec: flutter_local_notifications ^22, timezone ^0.10.1, flutter_tts ^4.2.3. Android: core library desugaring, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, the plugin's receivers, the TTS `queries` entry.
- Unverified: written without the Flutter SDK. CI must pass `flutter pub get`, `flutter analyze` and `flutter test`; if the plugin versions need a newer Flutter or compileSdk, pin them lower. On devices: notification permission (Android 13+, iOS), reminders after a reboot, Google's Malayalam voice, the share sheet with a zip.

## 2026-11-08: Manglish engine port

- `lib/core/manglish.dart`: same natural rules, `manglishCommon`, `manglishCandidates()` as the
  web. Offline suggestions use the list (`core/config.dart` `offline()` and fallbacks,
  `editor/editor_screen.dart` first list).
- `test/manglish_candidates.json` (new, from `npm run mobile:assets`) + `editor_test.dart` check the
  Dart lists match the web's. Not run locally (no Flutter SDK); relies on CI.

## 2026-11-08: Welcome demo spellings

- `lib/features/auth/welcome_screen.dart` `_TypingDemo`: each Manglish word now carries its
  Malayalam spelling (like the web's `TryManglish`), instead of going through the offline engine,
  which showed നാദു for naadu and പരയാം for parayaam. Now എന്റെ നാട്, മഴ പെയ്യുന്നു, ഒരു കഥ പറയാം.
  Unverified: no Flutter SDK in the sandbox, relies on CI (`flutter analyze`, tests, screenshots).

## 2026-11-08: tap on empty paper; desk header

- `lib/editor/editor_screen.dart`: `GestureDetector(onTapUp)` around the page's list; `tapPaper()`
  finds the line nearest the tap among lines on screen (focus node contexts) and calls
  `session.focusLine` (cursor at its end). A tap inside a line's box does nothing extra.
- `lib/features/desk/desk_screen.dart`: the title/logo `AnimatedSwitcher` lays both out at the
  left (`Stack(alignment: centerLeft)`), so the logo no longer slides back after scrolling up.
- Unverified on a device (CI only).

## 2026-11-08: Manglish in search

- `lib/core/search.dart` (port of `shared/search.ts`, keep in step) + `test/search_test.dart`.
  Desk search (`desk_screen.dart`), നാട്ടറിവ് filter (`dictionary_screen.dart`) use
  `matchesSearch`; Find (`editor/work_tools.dart`) shows **In Malayalam** chips. Unverified on a
  device (CI only).

## 2026-11-08: dictionary back arrow walks back word by word

- `lib/features/dictionary/dictionary_screen.dart`: the ← beside a looked-up word called `search()`
  with the previous word, and `search()` pushed the word on screen onto `_history` again, so the
  arrow toggled between the last two words. `search(word, back: true)` now skips the push; a lookup
  of the word already shown (or the same word twice) adds nothing. Unverified on a device (CI only).

## 2026-11-07 (evening): publisher line; Help and guide

- `lib/features/books/cover.dart`: `pubPart()` draws the publisher as its own part `publisher`
  (in `coverPartsFront`, so the designer can pick, size and drag it) in the art, solid, type,
  minimal and kasavu layouts, on a pill of the cover colour over artwork, like the web.
- `lib/features/settings/settings_screen.dart`: About has **Help and guide** (opens
  getlitma.in/help/ in the browser, `url_launcher`) and the website row now opens the site.
  Strings `settings.help`, `settings.helpHint` (assets regenerated).
- Unverified: no Flutter SDK in the sandbox; relies on CI (`flutter analyze`, tests, screenshots).


## 2026-11-07: whole book in one PDF

- `lib/features/books/book_screen.dart` export sheet: **Whole book (PDF)** first (front cover,
  pages, back cover, each cover only if the book has it, like the web's print view), then the two
  printer files. Strings `app.books.exportWhole`, `exportWholeHint`, new `exportHint`.
- `lib/features/books/book_export.dart`: `captureCovers` (returns the two covers as pictures),
  `buildCoverPdf` built on it, `buildWholeBookPdf`: the pages PDF from `Printing.convertHtml`,
  rasterised at 240 dpi with `Printing.raster` and placed between the covers (the `pdf` package
  can't join PDFs), so its text isn't selectable; the separate pages PDF keeps real text.
- Unverified: written without the Flutter SDK; relies on CI's analyze/test and a real phone
  (speed and file size for long books, memory on older phones).
- No top white strip in the phone's PDFs (the pages HTML has `body { margin: 0 }` and the covers
  are drawn edge to edge); checked by reading the code only.

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
