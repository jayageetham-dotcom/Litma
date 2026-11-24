# Phone app changes (apps/mobile, Flutter)

Reaches writers only through store builds. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## 2026-11-25: Story World names and remembered picks in Manglish (branch `manglish-names`)

- Shared: `manglish-rank.ts` `setOwnWords` (own index, commonness above every listed word) and `ownWordsFrom` (Malayalam words in names); phone port in `lib/core/manglish_rank.dart`, checked by `__own__` vectors in `test/manglish_rank_test.dart`.
- Web/desktop: `Workspace.tsx` loads the work's Story World names on open and when Story World closes → `setStoryNames` (`lib/manglish-words.ts`) and `setStoryWords` (`lib/spell.ts`, never marked). Picks: `CommitInfo.chosen` (a spelling other than the first, by click or arrows) → `rememberPick` (`litma:manglish-picks`, 1,000 newest, this device only); `withPick` puts it first in offline and Google lists.
- Phone: `Transliterator.setStoryNames/storyWords/rememberPick/withPick` (same key in SharedPreferences), `editor_screen.dart` `_loadStoryNames` (on open and `session.storyClosed` from `openStoryWorld`), `_chose` from the strip; `setupSpellMarks` adds Story World names to "mine". Fix: offline, a space now takes the ranked first spelling (`_firstOffline`), not the letter reading. **Not compiled here.**
- Help `02-typing.md`. Playwright (local): with a character കുഞ്ഞാറ്റ, "kunjaatta" → കുഞ്ഞാറ്റ first and the name isn't marked; a chosen spelling (വല്ലം for vellam) comes first next time.

## 2026-11-24: Spelling "Suggest" and "Deselect all" (on a branch until CI passes)

- `lib/editor/suggestion_rows.dart` `SpellRow` is now stateful: optional `onSuggest`; for an `unknown` mark with no fixes it shows **Suggest**, then the sound-alike words (or `check.noSimilar`). Wired through `_KeyboardBar.onSuggestWord` → `Transliterator.similar` (waits for the word list) → `ManglishRanker.similar` (port of the web's, checked by `test/manglish_rank_test.dart` `__similar__` vectors). Two new widget tests in `test/suggestion_rows_test.dart`.
- Selection bar (`lib/editor/selection_layer.dart`): when the whole work is selected (`EditorSession.allSelected`) the last button is **Deselect all** (`app.selection.deselectAll`), which calls `deselectAll()` (clears the span, collapses the field's own selection).
- **Not compiled here.**

## 2026-11-24: Ranked offline Manglish suggestions (on a branch until CI passes)

- `lib/core/manglish_rank.dart` (new): port of `packages/shared/src/manglish-rank.ts` (`ManglishRanker.of/build`, `suggest`, `lookup`, `scriptKey`, `latinKeys`). Ties keep list order like the web's stable sort.
- `lib/core/config.dart` `Transliterator`: `wordList` loader, `offline(word)` gives ranked spellings once the list is loaded (else `manglishCandidates`); Google's answers first, then offline ones; an Edge Function "offline" answer keeps the ranked list. `lib/app/providers.dart` wires `wordList` to `Dictionary.text('manglish-words', timeout: 90 s)` (kept on the phone). `lib/editor/editor_screen.dart` uses `transliterator.offline` for the instant strip, so a space offline now takes the best real word.
- Test: `test/manglish_rank_test.dart` against `test/manglish_rank_vectors.json` (written by `npm run mobile:assets` from `test/manglish_rank_words.txt` + `test/manglish_rank_inputs.txt`).
- **Not compiled here.** Merge only after "Mobile app checks" is green.

## 2026-11-22: Suggestion rows for screen readers (on a branch until CI passes)

- New `lib/editor/suggestion_rows.dart`: `SpellRow` and `ManglishRow`, moved out of `editor_screen.dart` (`_SpellRow` and `_Suggestions` now only wire the session to them; look and behaviour unchanged). Each chip is one `Semantics(container, button, onTap, excludeSemantics)`: spellings get a Malayalam `attributedLabel` (`LocaleStringAttribute` ml) so TalkBack/VoiceOver use a Malayalam voice; Ignore and Keep are named by their word with the long text as the hint (before: the hint was the name); the Manglish spelling a space takes is `selected`. The spelling row is a `liveRegion` container labelled `check.announceTouch` (en + ml), so it is announced when it appears.
- Test: `test/suggestion_rows_test.dart` (5 widget tests on the semantics tree: labels, Malayalam locale, hints, live region, no Keep for a broken letter, Malayalam UI, taps reach the callbacks).
- **Not compiled here** (no Flutter in Claude's sandboxes or the Mac's shell). Pushed to a branch so "Mobile app checks" (flutter analyze + test) runs; merge to `main` only when it is green.
- Not done: hardware keyboard (iPad with a keyboard). The keyboard bar, and so the row, only shows while the on-screen keyboard is up (`writing = keyboard && …` in `editor_screen.dart`), so with a hardware keyboard the row never appears. Showing it needs a layout change and a real device; owner's call. No live announcement for Manglish spellings on the phone yet (would need a pause like the web's, to avoid speaking at every letter).

## 2026-11-22: Fix the phone build (spelling colours)

Release #41 (0.7.32) failed on Android: `lib/editor/editor_screen.dart` `..footnoteNumber = (atom) => numbers[atom] ..spellColors = …`: the arrow body swallowed the next cascade (`numbers[atom]..spellColors`). The closure is now in brackets. The 19 Nov commit was never checked by CI (Mobile app checks #98 failed in 4 s on Actions billing), so the rest of its phone code is checked only by reading; the next CI run is the real check.

## 2026-11-19: Spelling marks in the text, suggestions above the keyboard

`lib/editor/session.dart` (`spellCheck`, `recheckSpelling`, `ignoreSpelling`, `_runSpelling`), `lib/editor/block_controller.dart` (`spellIssues`, `spellAtCursor`, `fixSpelling`, wavy spans in `buildTextSpan`, marks moved in `_replace`), `lib/editor/editor_screen.dart` (`_SpellRow`, colours), `lib/editor/writing_aids.dart` (`setupSpellMarks`, `keepSpellingWord`, Mark spelling switch), `lib/data/spell.dart` (`SpellKind.suspect`, `EngineVerdict`, `engine:`), new `lib/data/spell_engine.dart`, `Services.speller` / `spellEngine`. Tests: `test/editor_test.dart` group "spelling marks". **Not checked with flutter analyze/test here** (no Flutter in the cloud sandbox); CI and the next Release build it. Still web-only: spacing (punctuation) marks.

## 2026-11-18: Five new നാട്ടറിവ് categories

See `cross-platform.md`. `assets/data/nattarivu.json` regenerated; `lib/features/dictionary/dictionary_screen.dart` `nattarivuIcons` gets footprints, messageCircle, repeat, wind, utensilsCrossed. Not checked with `flutter analyze` (no Flutter here); icon names assumed from lucide_icons_flutter 4.

## 2026-11-17: Phone build fix (duplicate autocorrect)

`lib/editor/page_view.dart`: the 16 Nov Manglish change added `autocorrect:` while the field already had `autocorrect: false`, so Release v0.7.30's iOS and Android builds failed ("Duplicated named argument"). Kept the existing `autocorrect: false` (off in every mode, as before). Not checked with `flutter analyze` here (no Flutter in the cloud sandbox); the next Release builds it.

## Open items

- Sessions without the Flutter SDK (the cloud sandbox can't download it) rely on CI: `flutter
  analyze` (infos fail it too), `flutter test`, and the screenshots job, whose pictures are on the
  `ci/phone-screens` branch (`git fetch origin ci/phone-screens`).
- Try on a real iPhone and Android phone: everything from 2026-11-07 (inbox, keyboard strip,
  suggestion row, mid-line Manglish, desk keyboard, editor tools from #5, cover designer, book
  PDFs including the whole-book PDF, Book details, statistics reaching /admin/).
- Writing aids (2026-11-08) need a CI run and a device check (see that entry). Still to do on the phone: spelling marks inside the text, restore from a backup, Drive backup without the share sheet.
- **Move to material_ui / cupertino_ui (2026-11-14):** Flutter 3.47+ deprecates `package:flutter/material.dart` and `cupertino.dart`; CI's `flutter analyze` failed on it (46 infos). For now `analysis_options.yaml` ignores `deprecated_member_use`, and `editor_screen.dart` keeps its `rendering.dart` import with an ignore (unneeded on 3.50, needed on older SDKs). After the first store release: `flutter pub add material_ui cupertino_ui`, `dart fix --apply --code=migrate_design_widgets`, wrap the app in `MaterialUiCompatibilityBridge` while `animations`/`printing` still use the old library, check every screen, then remove the ignore.
- The phone can't edit book pages that carry formatting (shown read-only with a note), and
  can't upload pictures (uploads are off everywhere for now).

## 2026-11-16: Rhymes "Next set"; no keyboard capitals or smart quotes in Manglish

- `lib/editor/writing_aids.dart` (`RhymeFinderView`): up to 1,000 rhymes, 40 at a time, **Next set** (`LucideIcons.refreshCw`) with the range, wraps to the first set; `rhyme_next` tracked. Rhyme box: no autocorrect or suggestions.
- `lib/editor/page_view.dart`: line fields used `TextCapitalization.sentences`, so the keyboard made "amma" into "Amma" → ആമ്മ. In Manglish mode now no capitalisation, no autocorrect, smart quotes and dashes off (the owner saw ‘അമ്മ at the start of a short story; the curly quote's source isn't confirmed, smart punctuation is the likely one). Dictionary search box: autocorrect off.
- Unverified: `flutter analyze`, `flutter test` (no SDK; CI blocked by GitHub billing), a real phone.

## 2026-11-16: പ്രാസം tab in the Dictionary

The web and desktop Dictionary has Look up · നാട്ടറിവ് · പ്രാസം · Saved; the phone had no പ്രാസം tab (rhymes only in the editor's tools sheet). The rhyme sheet is now a reusable `RhymeFinderView` in `lib/editor/writing_aids.dart` (`inSheet: true` keeps the editor behaviour: title, pick inserts at the cursor and closes; `false` drops the title, uses `rhyme.openHint`, and doesn't pop). `lib/features/dictionary/dictionary_screen.dart` shows it as the third tab, same order as the web; a picked word opens in Look up; `rhyme_lookup` is tracked when the tab opens. No new strings. Unverified: `flutter analyze`, `flutter test` and the screenshots job (no Flutter SDK here), and the four tab labels fitting on a narrow phone. Needs a phone store build.

## 2026-11-16: Google sign-in left the sign-up screen on top (Android testers)

Play closed-test testers: Google sign-in went to Supabase and came back to the same sign-up screen. Auth logs show every attempt succeeded (`/callback` 302, `/token` pkce 200), so the phone was signed in. `signInWithGoogle` returns as soon as the browser opens; the session arrives later through `in.getlitma.app://auth-callback`, `AuthGate` switched to the desk underneath, but nothing popped the pushed `AuthScreen` (only the password path pops, in `_submit`). Fix: `AuthScreen` listens to `auth.changes` and `popUntil(isFirst)` when a writer arrives (covers Google and email links); also disposes its controllers. File: `lib/features/auth/auth_screen.dart`. Unverified: `flutter analyze && flutter test` (no SDK in this session) and a real Android phone. Reaches testers with the next Play build.

## 2026-11-15: Undo messages close by themselves

- Owner on the iPhone: "Moved to the trash · Undo" stayed until Undo was tapped. Flutter now keeps a snack bar with an action until it is tapped unless `persist: false`. Set on the desk toast (`desk_screen.dart` `_toast`, 4 s), the book's "removed" toast (`book_screen.dart`, now 4 s) and the writing timer's "again" (`editor_screen.dart`, 8 s). Unverified here (no Flutter): `flutter analyze` must accept `persist` (Flutter ≥ 3.47 in pubspec.lock).

## 2026-11-15: Desk listed other writers' shared works

- `lib/data/store.dart`: `_me`; `listDocs`, `getDoc` and `_prefetch` filter `user_id` (see cross-platform). `lib/data/fake.dart`: rows without `user_id` belong to the test writer. Test in `test/offline_test.dart`.
- `features/desk/desk_screen.dart`: trash/restore show `app.desk.failed` and refresh when the server refuses; only `OfflineException` is treated as queued.
- Not run here (no Flutter): `flutter analyze && flutter test`. Reaches phones with the next store build; the server migration already stops 0.7.24 listing others' works.

## 2026-11-15: Community blocking (website)

Nothing in the app: Settings → Litma Community opens the website, which now has Block and Blocked writers (see `web.md`). Only `assets/i18n` changed (new `community.*` strings from `npm run mobile:assets`). If Community ever gets native screens, they must offer Block and Blocked writers too.

## 2026-11-15: Store badge files copied in

`npm run mobile:assets` now also copies `app-store-badge.svg`, `google-play-badge.png` and `microsoft-store-badge.svg` into `assets/brands/` (it copies every file in `apps/web/public/brands`). The phone app doesn't use them; nothing else changed for the phone.

## 2026-11-14: Dictionary: words typed with a stray joiner

- `lib/data/dictionary.dart`: `spellings()` (port of `shared/dict.ts`), `lookup` → `_lookupExact` per spelling, `suggest` → `_suggestExact` per spelling. Fixes "No entry for കാട്" when the iPhone keyboard adds U+200C after ് (owner, TestFlight build 6), and the empty suggestion list while typing such words.
- Test in `test/phases_test.dart` ("a stray joiner after ്…"). **Unverified:** `flutter analyze`, `flutter test` (no Flutter here; CI). Ships with the next phone build (after 0.7.24 (6), which is in review).

## 2026-11-14: Dictionary suggestions (web caught up with the phone)

No phone change. The phone's dictionary already offers Malayalam for Manglish while typing (`_typed` in `dictionary_screen.dart`: chips from the transliterator + English completions). The web now does more: it keeps only spellings that are dictionary words and adds words starting with them (`typingSuggestions` in `apps/web/src/lib/dictionary.ts`). Optional later: do the same in `_typed` so both apps suggest alike.

## 2026-11-14: iPad screenshots for the App Store

- `test/screenshots/screens_test.dart`: `shoot` takes a `ratio` (default 3); new iPad 13" shots at 1032 x 1376 points x 2 = 2064 x 2752: `ipad-01-desk`, `02-editor-typing` (keyboard 400 pt), `03-editor-novel`, `04-editor-poem`, `05-dictionary`, `06-nattarivu`, `07-story-world`, `08-cover-designer`.
- `scripts/store-ipad-screens.py` (Pillow, Inter Bold from `assets/fonts`): caption + colour per shot like the iPhone set, screen in a dark rounded frame, into `marketing/store/app-store/ipad/litma-ipad-0N-*.png`.
- Unverified: the shots render only in CI (Mobile workflow → Run workflow, screens job). Look at each: the app has few tablet layouts (centred 760 pt editor sheet), so some screens may look wide and empty.

## 2026-11-14: Clear button and Esc in name fields

- `lib/widgets/script_field.dart`: × suffix button (`_clear`, keeps the keyboard up), Esc on a hardware keyboard (iPad) restores the text from focus time (`_before`, `_escape` in a `Focus` wrapper; ignored when nothing changed, so Esc still closes the rename dialog). Used by the rename box and Book details.
- Unverified: `flutter analyze`, `flutter test`, a device check.

## 2026-11-14: Selection across lines; rename in Manglish

- **Selection over many lines and pages** (owner: selecting and deleting more than one line was hard on iPhone and iPad). The selection is kept in the session instead of a line's field: `DocPoint`, `setSpan`, `spanRange`, `spanParts`, `spanText`, `replaceSpan`, `deleteSpan`, `selectAll`, `_deleteRange` (lines and pages wholly inside go, the two end lines join; dialogue and cast entries keep their shape) and bold/italic over the range (`_markSpan`) in `lib/editor/session.dart`; `TextBlock.removeRange` in `document.dart`. New `lib/editor/selection_layer.dart` (over the page list in `editor_screen.dart`): highlight, two handles that drag across lines and pages and scroll at the screen edges, and a bar with Cut, Copy, Paste, Delete, B, I, Select all (`app.selection.*`). A long press or a field's own selection becomes the selection; the line last moved to holds its part as the field's selection, and `BlockController.onSpanEdit` turns typing, Backspace or Enter into one replacement (one undo step). Fields' own highlight is clear and their menu hides while the layer shows (`page_view.dart`, Select all in the field menu selects the whole work). `selectedText` (Look up, AI) covers the whole range. Test in `test/tools_test.dart`.
- **Rename:** the title box is the `ScriptField` (മലയാളം / As typed, remembered as `work.title`), so Manglish turns into Malayalam (owner: only English could be typed in the simulator). `ScriptField` gained `autofocus` and `onSubmitted`.
- **Fix (owner on TestFlight build 5, iPhone):** after dragging a handle over lines, the selection shrank back to the long-pressed word when the finger lifted. `_syncSpanToField` now quietly collapses the previous line's own selection before moving the keyboard to the line the selection ends on, and `_followFieldSelection` ignores a line inside a multi-line selection repeating an old selection of its own. Test in `tools_test.dart`.
- **Fix 2 (owner: the selection vanished during the drag, sometimes grew to everything, and went back to the word after scrolling):** `beginHandleDrag()` (called when a handle is grabbed) lets the focused line drop its long-pressed word quietly and records its cursor as expected, so the field's echo while the finger moves isn't taken for a tap. Owner checked TestFlight build 0.7.24 (6) on an iPhone: selection over lines, Move to trash, empty pages, rename and Sign in with Apple all work.
- **Unverified:** no Flutter in this sandbox. Owner to run `flutter analyze && flutter test` in `apps/mobile` and try it on the simulator (long press, drag the handles over pages, Delete, type over it, Undo; Bold; Paste; rename in Manglish). Not done yet: Cmd+C/X/A on a hardware keyboard act on the one line only; the colour, highlight and size tools still change only the line with the cursor.

## 2026-11-14: Backspace removes an empty page

- `lib/editor/session.dart` `_onMergeBack`: Backspace on an empty line right after a page break, with another break after it or nothing after it, removes the whole page (the line and both breaks) and puts the cursor at the end of the page before, like the web's `PageBreak` Backspace in `extensions/blocks.ts`. Before, only the break before was removed, so the empty line could still spill onto a page of its own. Test in `test/tools_test.dart`. **Unverified** here (no Flutter); CI and the owner's simulator.

## 2026-11-14: Move to trash from the editor

- Owner saw it on the iPad simulator: More → Move to trash left the work open (the editor waited for the last save and the server before closing) and the work was never trashed. Now the editor closes at once with a `TrashedWork(id)` result (`lib/editor/editor_screen.dart`, last save gets 2 s); the desk's `_after` takes it off the list, trashes it and shows the toast with Undo (`_trashId` in `lib/features/desk/desk_screen.dart`, shared with swipe to trash). An untouched new work is just discarded on close, as before.
- **Unverified:** not run through `flutter analyze`/`flutter test` here (no Flutter in this sandbox); owner to hot-restart on the iPad simulator and check, CI on push.

## 2026-11-14: App Store setup

- `ios/Runner/Info.plist`: `ITSAppUsesNonExemptEncryption` = false (Litma uses only HTTPS from iOS), so App Store Connect stops asking the export-compliance question for each build.
- App Store Connect app created (Apple ID 6834719757, name "Litma: Malayalam Writing", version 0.7.24, rated 13+ to match the Terms). Listing text and iPhone screenshots (1206 x 2622, from the Play ones) in `marketing/store/app-store/`; the iOS text leaves out read aloud (no Malayalam voice on iPhones yet).
- Open: the `ASC_*` secrets and the first TestFlight build; iPad screenshots are required while `TARGETED_DEVICE_FAMILY` is "1,2" (owner chose to ship iPad too: see the iPad screenshots entry above).

## 2026-11-14: Android build tools for the current Flutter

- The first signed store build failed: Flutter stable (3.50 on CI) needs Android Gradle Plugin ≥ 9.1.1 and warns below Gradle 9.5.0. `android/settings.gradle.kts` AGP 9.1.0 → 9.1.1, `gradle/wrapper/gradle-wrapper.properties` Gradle 9.3.1 → 9.5.0 (the versions Flutter's error names; the sandbox could not reach Google's Maven to check for newer). **Unverified** until the next Mobile store builds run. CI uses floating `stable`, so a future Flutter may ask again.
- AGP 9.1.1 then refused the namespace: `app/build.gradle.kts` had `namespace` and `applicationId` as the string "`in`.getlitma.litma" with literal backticks (Kotlin-keyword escaping copied into a string). Both are now plain `in.getlitma.litma` (`in` is not a Java keyword); the Kotlin sources keep `package \`in\`.getlitma.litma`.

## 2026-11-14: Store builds, developer accounts bought

- The owner has Apple and Google Play developer accounts. `docs/setup/google-and-supabase.md` Part 10 (with checklist and troubleshooting rows) walks through the App ID, App Store Connect app and API key, Play Console app, upload keystore, service account, store forms and the GitHub secrets.
- `.github/workflows/mobile-release.yml` iOS job: `flutter build ios --no-codesign`, then `xcodebuild archive` and `-exportArchive` both with `-allowProvisioningUpdates` and the API key, and `DEVELOPMENT_TEAM` from `APPLE_TEAM_ID`. The old `flutter build ipa` archived without the key, so on a fresh runner it had no certificate to sign with. **Unverified:** runs only once the secrets exist; the Xcode project still has `DEVELOPMENT_TEAM = D9U998359G` (overridden in CI; check in Xcode whether that is the paid team).

## 2026-11-13: Sign-in messages

- `authMessage` in `lib/data/auth.dart`: banned, leaked password, captcha (same wording as the web).

## 2026-11-13: Delete account and CAPTCHA

- Settings: `_DeleteAccount` + `_DeleteDialog` (type DELETE) → `AccountApi.delete` (`lib/data/account.dart`), `OfflineLayer.forgetAccount` (`LocalDb.forget` in SQLite and memory), sign out.
- Sign-in, sign-up and reset go through `withCaptcha` (`lib/features/auth/captcha.dart`): only when Supabase asks, a sheet with getlitma.in/captcha/ in a web view (`webview_flutter`, SPM-ready) sends the token over the `LitmaCaptcha` channel. `AuthGateway` methods take `captchaToken`.
- Unverified: not analysed or built (no Flutter here). Run `flutter pub get` (pubspec.lock changes), `flutter analyze`, `flutter test`.

## 2026-11-13: Credits and licences link

- `lib/features/settings/settings_screen.dart`: About card ListTile "Credits and licences" (`legal.credits`, award icon) opening `getlitma.in/help/?a=credits` in the browser. `assets/i18n` regenerated. Not analysed here: run `flutter analyze` (check `LucideIcons.award` exists in lucide_icons_flutter 4).

## 2026-11-09: Community links

- `lib/features/settings/settings_screen.dart`: "Litma Community" (opens getlitma.in/community/ in the browser) and "Community guidelines" (in-app browser via `openLegal('community/guidelines')`). Strings `community.*` from `packages/i18n` (assets regenerated). Native community screens are listed in `README.md` → Changes to mirror. Unverified: `flutter analyze` and tests (no Flutter SDK in the sandbox; watch CI).

## 2026-11-08: Test fake understands log_writing

- `lib/data/fake.dart` `FakeBackend.rpc` now handles `log_writing` like the SQL function (words, minutes, hours, work_days); since the goals work the app sends `log_writing`, so `offline_test.dart` "words written offline are added up into one change" failed against the fake. App code unchanged.

## 2026-11-08: Pages in the phone editor

- Owner: a work starts as one page, writing that fills a page carries on to the next (Enter at the end of a page starts a new one), a small + between pages inserts a blank page; the earlier big + on each inserted break (`PageGap`, same day) was too distracting and the inserted page looked like one line.
- `lib/editor/pages.dart`: `phonePageHeight` (a phone page holds about the text of a printed page of the work's paper size and margins: print area ÷ phone text width; text is at print size, 12 pt = 16 px), `flowPages` (pure, `test/pages_test.dart`), `PageEdge` (rest of the page, a 30 pt canvas gap with a 20 pt grey + in a 48 × 30 target, next page's top margin), `MeasureSize`.
- `lib/editor/editor_screen.dart` `_Page` is now stateful: measures each top-level line after layout, estimates lines not built yet (replaced once measured; a page's filler absorbs changes inside it, so scrolling rarely jumps), keeps every line's field in a two-child Column so a page starting above it doesn't drop focus. Paper is drawn per item on the canvas; tablets keep a 760 pt sheet (no shadow now).
- `EditorSession.insertPageAt(index)` for the + where the text ran on; `insertPageAfter` for the + after an inserted break. Tests in `test/tools_test.dart`.
- Unverified: CI only. Check on a phone: typing at a page end moves the line to the next page without losing the keyboard, long works scroll smoothly, dark mode, tablets.

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
