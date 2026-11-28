# Cross-platform changes

Work that touches more than one Litma app (web, desktop, phone). Per-app details live in
`web.md`, `desktop.md` and `mobile.md` next to this file.

**Every session:** read these four files before starting, then add what you changed (newest
first) and update **Open items** before you finish. Keep entries short: what changed, where in
the code, and what is still unverified.

## 2026-11-28: Note first, keep rule, Journal name (branch `notes-first`)

- Writing type ശൂന്യം is now **കുറിപ്പ് · Note** (kind id stays `blank`) and comes first in the pickers (`PICKER_KINDS` / `PICKER_TEMPLATES` in shared `forms.ts` and `lib/templates.ts`, web desk `Chooser`; phone `pickerKinds` in `lib/data/forms.dart`, `type_picker.dart`). New ones are titled പുതിയ കുറിപ്പ് (`defaultTitle`, used by web `store.createDoc`, phone `Store.createDoc`, MCP `create_document`). Diary is **ജേണൽ · Journal** in names only (kind stays `diary`; help anchor `#diary` kept). Old notes titled പുതിയ ശൂന്യം: migration `20261128090000_note_titles.sql` renames them (touch trigger paused so desks keep their order); the editors also show the new title (`currentTitle`).
- Keep rule, every writing type (shared `keepOnClose` = `!isDefaultTitle(title) || hasWriting(content)`; phone port with the same name, `test/keep_rule_test.dart`): a new work is kept when the writer changed its title or wrote body text (the author line, a journal's date and template labels don't count); otherwise closing deletes it. Before, the phone app deleted a new work that was only renamed (`EditorSession.rename` never cleared `pristine`), MCP works created with a title but no text were deleted on first close, and on the web an Enter alone kept an empty work. Web `Workspace.tsx` (`recheckPristine`, only with a live editor so closing never drops unsaved text), phone `session.dart` (`_recheckPristine`), the saved `settings.pristine` follows the rule; desk cleanup (`discardPristine`, web and phone) also needs a default title; MCP `update_document` with a real title clears the flag.
- Strings `types.blank.blurb`, `types.diary.blurb` (en + ml), ml `editor.diary.newEntry` പുതിയ കുറിപ്പ് → പുതിയ എൻട്രി (it now clashed with the Note title; owner to confirm the word). Help `01-getting-started.md`, `04-writing-types.md` (+ `shots/chooser.webp` retaken), `05-story-world.md`; home Marquee.
- Checked here: typecheck, local build, i18n check, keep-rule cases for all ten types (tsx), Playwright on the local build (Note first; untouched note discarded; title only kept; journal with text kept; novel with only Enter discarded). Phone code not compiled here (CI). Needs a desktop Release and a phone store build; the website and MCP get it with the deploy (migration with `db push`).

## 2026-11-26 (evening): Metre panel no longer overflows (branch `fix-metre-overflow`)

- Owner's photos (16-inch MacBook, docked panel): in free verse the panel's lines ran off its edge and the whole editor scrolled sideways (page 1886 px in a 1728 px window). Causes: with no gana groups every syllable fell into one unbreakable row; and each chip's screen-reader text (`sr-only`, absolutely positioned) had no positioned parent, so it stretched the page.
- Web `components/editor/MetrePanel.tsx`: free-verse syllables stand alone (narrow gaps), groups wrap, chips are `relative`, the panel and its lines are `min-w-0` with `overflow-x-clip`. Phone `lib/editor/metre_view.dart`: same grouping, groups are `Wrap`s.
- Checked: page width = window at 1280, 1512 and 1728 px with the panel open; 15 public and app pages at 1728, 1512, 390 and 320 px have no sideways scroll; metre panel tests (tap selects the syllable, 390/320 px) pass. The toolbar still scrolls sideways under ~1600 px by design.

## 2026-11-26: Ignore kept with the work (branch `claude/keep-ignores`)

- Owner: fixed and ignored spellings came back after a refresh. Fixes were saved (the same word elsewhere in a lyric stays marked); Ignore lived only in memory. Now Ignore is saved in the work's `settings.spellIgnored` (shared `DocSettings`, last 1,000 words): web `lib/spell.ts` `setWorkIgnored` (Workspace loads and saves it), phone `EditorSession.isSpellIgnored` / `ignoreSpelling` (marks and the Check sheet). Strings `check.ignoreHint` (en + ml), help `03-editor.md`. Verifier: MERGE; after it, the web's `persist` sets the new settings before saving (a new work's first save could drop an Ignore) and the phone's ignores are per work (no shared set). Open: MCP `check_spelling` doesn't read a work's ignored words; two devices saving settings at once, last writer wins (as before).

## 2026-11-26: Menu placement, quotative endings, Manglish capitals everywhere (branch `claude/menu-place-quotative`)

- Spelling (every app, server side): `quoted()` now takes any ending mlmorph allows after ഇല്ലെന്ന (എന്നാണ്, എന്നുള്ള, എന്നായിരുന്നു, എന്നല്ലേ…), still only after a negative. `quoted-check.ts`: prose false alarms 22 → 21 of 345; false passes 73 of 1,628 misspellings with the long endings (4.5%, all with a base mlmorph itself accepts). Not covered: എന്നാണല്ലോ (mlmorph rejects it even after ഇല്ല).
- Manglish capitals: `exactReading` (shared + Dart). Checked with the Litma MCP `transliterate`: Google ignores case (kaLam → കാലം, koDi → കോടി), so the phone app online and the MCP put Google's reading first. Now `_shared/google.ts` (litma-transliterate and MCP), web `ManglishPopup`, phone `Transliterator.candidates` and both offline rankers put the exact reading first only for meaningful capitals inside a word. Fixes the merged PR #19 rule, which also led with broken readings for name-cased words (Kerala → Kഎരല). Vectors: `Ammu kaLam paNi NaLLa iPhone` added to `manglish_rank_inputs.txt`.
- Web/desktop menu: never covers the clicked line (below, else above, else the roomier side with its own scroll).
- After the tester: endings need a plain mlmorph reading (`quotativeTail`, slips 29 → 0); `foldCaps` (shared + Dart) before every letter reading, so Kerala, TV, YouTube, iPhone never give Latin-mixed suggestions (Kഎരല) and brand names keep Google's reading. Tester + verifier (agent team): MERGE on `42814cd`. Open: right-click in the gap between pages collapses a selection across the break; foldCaps is not idempotent for rare mixed words (LaPa: online ളപ first, offline no exact reading); brands with a meaningful first capital (TikTok, iOS) lead with the letter reading; mlmorph gaps (കുഴപ്പമില്ലെന്ന്, എന്നായിരിക്കും, എന്നുള്ളത്), ZWNJ after a final ്.

## 2026-11-26: Right-click menu, quotative spelling fix, Manglish picks (branch `claude/context-menu-spelling`, PR #19)

- Web + desktop: Litma's own right-click menu in the editor (`apps/web/src/components/editor/EditorContextMenu.tsx`): spelling fixes, Ignore/Keep, cut, copy, paste, paste without formatting, delete, select all, look up, rhymes, Ask AI, B/I/U, clear formatting, shortcuts; pointer devices only, Shift + right-click keeps the browser's. Desktop: `litma:edit` IPC + `litmaDesktop.edit`, native Cut/Copy/Paste menu outside the editor (`editMenuFor` in `apps/desktop/src/main.ts`). Strings `editorMenu.*`, help `03-editor.md`.
- Spelling engine (every app, server side): `MlSpeller.quoted()` in `shared/mlmorph.ts` accepts known words + quotative എന്ന് (കാണാനില്ലെന്ന്, അറിയില്ലെന്ന്…), which mlmorph alone flagged "Check spelling?".
- Web Manglish: the writer's own pick leads on cached Google lists and the first offline list; capitals put the exact reading first online too (offline already did).
- Tester + verifier (agent team): menu passes at 1440/1024 px light and dark, Electron unpackaged (paste keeps or drops formatting, native menu in inputs); keyboard opening fixed after the tester; `quoted()` limited to negatives (misspellings let through 122 → 34, prose false alarms 33 → 22 of 345). Check: `npx tsx scripts/spell-lab/quoted-check.ts`. Verifier: MERGE.
- Open: chains with എന്നാണ് / എന്നുള്ള still flagged; a tall menu at the top can cover the clicked line; phone's online Manglish with capitals untested; packaged desktop on macOS/Windows untested.

## 2026-11-26: Monorepo for more Litma products (branch `monorepo`, on `metre-checker`)

- The repo was already an npm-workspaces monorepo; added room for products outside Litma's shared version. `apps/keyboard/README.md` (Litma Malayalam Keyboard: owner decisions, layout `android/` Kotlin, `ios/` Swift + XcodeGen, `data/` engine data not committed).
- `.github/workflows/engine-data.yml` (new, reusable): builds `manglish-words.txt` with the deploy's cache key and uploads artifact `engine-data`. `deploy.yml` still builds it inline (unchanged, to avoid an untested change to the live deploy); keep both in step.
- `.github/workflows/keyboard.yml` (new): runs only on keyboard / Manglish engine paths; Android (Gradle) and iOS (XcodeGen, macOS runner) jobs skip until their projects exist.
- `deploy.yml` `paths-ignore`: `apps/keyboard/**`, `keyboard.yml`, `engine-data.yml`, so keyboard work never deploys getlitma.in. `release.mjs` and the root `workspaces` list are explicit, so the keyboard is never bumped by Litma's Release; `desktop.yml`'s tag filter `v[0-9]*` doesn't match `keyboard-v*`.
- `CLAUDE.md`: "Products in this repo" section (rules for adding a product).
- `.claude/agents/`: agent team for Claude Code sessions: designer, web-dev, flutter-dev, keyboard-dev, tester, verifier (read-only, merge verdict); order of work in `CLAUDE.md` → Agent team. `deploy.yml` ignores `.claude/**`.

## 2026-11-26: CI green on `metre-checker` (repo public)

- First real CI run of all six engine branches and of `main`'s PR #15 code: `flutter analyze` failed on `main` and every branch (AttributedString, SemanticsNode no longer come with material in the current Flutter) → `import 'package:flutter/semantics.dart'` in `lib/editor/suggestion_rows.dart` and `test/suggestion_rows_test.dart`. Three screen-reader tests read the chips before their fade-in had started (one long pump) → `settle()` steps the clock in frames. `.github/workflows/mobile.yml` also runs on changes to `shared/manglish-rank.ts`, `metre.ts`, `search.ts` (and any `packages/shared` file in PRs).
- Mobile app checks on `metre-checker` (`3d7128d`): analyze clean, all tests pass (metre, Manglish ranking, search, spelling, suggestion rows…). The lower branches don't carry these fixes: merge `metre-checker` (it holds all six), not them one by one.

## 2026-11-26: Metre checker (branch `metre-checker`)

- `packages/shared/src/metre.ts` (new): syllable scan with laghu/guru (`scanLine`: chillus incl. the old ZWJ forms and ൻ്റ, conjuncts across spaces, ം ഃ, a word-final ് optional), `readings` (each optional ് counted or not), `checkStanza` → metre, fit (exact / likely / close / none), every line's syllables with weight, gana group and wrong marks, expected aksharas. 28 Sanskrit sama metres, വിയോഗിനി and പുഷ്പിതാഗ്ര, two ഉപജാതി mixes, അനുഷ്ടുപ്പ്, 11 Malayalam metres. Definitions checked against Vrittamanjari and the MIT `kavyanarthaki` table (its രഥോദ്ധത and മന്ദാക്രാന്ത rows are wrong; കുസുമമഞ്ജരി left out as sources disagree); nothing copied, so no credit line.
- Tested on public-domain verse: വീണപൂവ് → വസന്തതിലകം exact (with യെ for യേ → close, the syllable marked), അദ്ധ്യാത്മരാമായണം → കേക, അയോദ്ധ്യാകാണ്ഡം → കാകളി, കുചേലവൃത്തം → നതോന്നത, Raghuvamsha → അനുഷ്ടുപ്പ്, Kumarasambhava → ഉപജാതി, Meghaduta → മന്ദാക്രാന്ത, ശാർദ്ദൂലവിക്രീഡിതം; prose → none. 2,000 random stanzas from common words: 97.8% none, under 1% named "likely".
- Phone: `lib/core/metre_check.dart` (port), `test/metre_test.dart` + `test/metre_vectors.json` (from `test/metre_inputs.txt` via `scripts/build-mobile-assets.mjs`), `lib/editor/metre_view.dart`, tools sheet tile (poems, lyrics). **Not compiled here.**
- Web/desktop: `components/editor/MetrePanel.tsx`, rail Words group and phone More tile (poems, lyrics; `labelKey`/`shortKey` on `PANELS` so its name comes from i18n). Strings `metre.*` (en + ml). MCP `check_metre` (deno check passes). Help `04-writing-types.md#metre` with `shots/metre.webp`, `03-editor.md` phone tools list.
- `aksharas()` (shared + phone `lib/core/metre.dart`): a word-final ് is laghu, not guru (marks and rhyme metres); rhyme keys unchanged. `tools_test.dart` cases added.
- Offline Manglish: a y before a consonant or at the end reads as യ് or the ai vowel (`latinKeys`, shared + phone): പെയ്തു, നെയ്തു, ചെയ്തു, നായ് now first (were പത്തു, നൈറ്റ്…). Dakshina test 71.4% → 71.9% first (top 6 87.2% same); the 300-word Google check unchanged (224 vs Google 215). Vectors and the small test word list updated.
- Playwright (local): panel at 1440 (light, dark), 390, 375 and 320 px; tapping a marked syllable selects it; the marks switch works; typing in a poem with the panel open; no Metre tool in a novel; Rhymes, desk, dictionary and help pages load without errors.
- Writers get it with the website deploy; the desktop app needs a Release and the phone app a store build.

## 2026-11-26: Rhymes from the words people write (branch `better-rhymes`)

- `scripts/build-rhymes.mjs`: the top 60,000 words of `/dict/manglish-words.txt` join the rhyme files when they start with a dictionary headword (≥ 2 aksharas) and with no left-out headword; scored by use (4 − log10(rank+1)), a known headword that is also common rises, a headword nobody writes (not in the list) drops by 2. Fairness: `FORM_AVOID` (caste, community and religion-group names, caste surnames, abuse) now removes such words from all rhyme files, headwords included; ordinary look-alikes (കുറവ്, പണിക്ക്, അരയന്നം, പിള്ളേർ, കൊല്ലം) checked as kept. Real Olam build here: 24,813 forms added (212,651 words, 2,492 files, 18 → 20 MB). Rhymes for പറഞ്ഞു 14 → 103, കണ്ണീരിൽ 2 → 54, പോകുന്നു 31 → 832; odd fragments (ഉന്നു, കൂന്നു) left the top.
- `deploy.yml`: the Manglish word list is built before the dictionary step; `build-dictionary.mjs` keeps `manglish-words.txt` when it clears `dict/`.
- `shared/dict.ts` `headFor` (+ phone `Dictionary.headFor`, test in `test/phases_test.dart`): a rhyme form opens the word it comes from (കാണുന്നു → കാണുക, മുറിഞ്ഞു → മുറിയുക, മഴയിൽ → മഴ, കോഴിക്കോട്ടെ → കോഴിക്കോട്), null rather than a short wrong prefix. Used by the Dictionary's പ്രാസം tab (web `app/dictionary/page.tsx`, phone `_openRhyme`). 170 of 300 sampled forms open an entry (was 93 of 400 through plain lookup).
- Every app reads the same `/dict/rhyme` files from the website (phone network-first), so writers get the rhymes with the next website deploy; no desktop Release or store build is needed for the rhymes. The phone's tap-to-meaning needs the next store build. Help `06-dictionary.md#rhymes`.
- Playwright (local, real dictionary): പ്രാസം tab and editor Rhymes panel at 390 and 1440 px; clicking നിറഞ്ഞു opens നിറയുക. **Phone code not compiled here.**

## 2026-11-25: Better spelling suggestions (branch `spelling-suggestions`)

- `packages/shared/src/manglish-rank.ts`: `rankOf`, `rankFixes` (engine fixes + sound-alike words, scored by use, closeness and the engine's order), `closeWords` (common words, top 30,000, one letter from a word that isn't listed; empty for names and new words). `spell.ts` `SpellOptions.words`: suspects' fixes ranked; an unknown word with close common words (and not in the dictionary) becomes "Check spelling?", with or without the engine. Phone: `lib/core/manglish_rank.dart` (same), `lib/data/spell.dart` `check(rankFixes:, closeWords:)`, `Transliterator.ranker`/`wordsReady`, `writing_aids.dart` (re-checks once the list has loaded). Vectors `__spell__` in `test/manglish_rank_test.dart`.
- Web: `lib/spell.ts` passes `spellWords()` (`lib/manglish-words.ts`) and starts loading the list, re-checking when it arrives.
- Measured on 387 realistic slips of common words (scripts/manglish-lab style, mlmorph built here): right fix first 66.7% → 94% overall (engine suspects 66.7% → 72.4%; 86 of 102 typos the engine had nothing for are now asked, right first for 84); real words the engine doesn't know asked about: 1.7% (amber question, Ignore/Keep; Story World names excluded).
- Not done: the MCP `check_spelling` (server) has no word list, so its fixes stay in the engine's order.
- Playwright (local, offline, default settings): പുസ്ടകം and ണൽകാൻ marked "Check spelling?", പുസ്തകം offered and applied; ചക്കപ്പഴക്കുഴി unmarked; desktop card and phone strip.

## 2026-11-25: Forgiving search (branch `forgiving-search`)

- `packages/shared/src/search.ts`: `searchRank` (3 as typed, 2 by sound incl. Malayalam queries: കത → കഥ, മലയാലം → മലയാളം, 1 one typo from 5 sound letters / two from 12, swaps count once), `matchesSearch` = rank > 0, `manglishMatches` also for Malayalam queries (other spellings, never the query) and near misses. Phone port `lib/core/search.dart` (same cases in `test/search_test.dart`).
- Desk (web `app/desk/page.tsx`, phone `desk_screen.dart`): while searching, results sorted by rank (stable; title/words sort within rank). Saved words, നാട്ടറിവ്, Community, phone dictionary filter get the forgiving match through `matchesSearch`.
- Find (web `FindBar` in Workspace.tsx, phone `work_tools.dart`): chips for Malayalam searches labelled `search.soundsLike` (+ hint; en + ml). Web Find bar: search and replace fields keep at least 7.5rem on narrow phones (were squeezed to a few letters at 320 px).
- Help `01-getting-started.md`, `03-editor.md#find`. Playwright: desk search (കത, malayalm, dairy, മലയാലം) on phone and desktop; Find at 320/390/1280 px.

## 2026-11-25: Story World names and remembered picks in Manglish (branch `manglish-names`)

- Shared: `manglish-rank.ts` `setOwnWords` (own index, commonness above every listed word) and `ownWordsFrom` (Malayalam words in names); phone port in `lib/core/manglish_rank.dart`, checked by `__own__` vectors in `test/manglish_rank_test.dart`.
- Web/desktop: `Workspace.tsx` loads the work's Story World names on open and when Story World closes → `setStoryNames` (`lib/manglish-words.ts`) and `setStoryWords` (`lib/spell.ts`, never marked). Picks: `CommitInfo.chosen` (a spelling other than the first, by click or arrows) → `rememberPick` (`litma:manglish-picks`, 1,000 newest, this device only); `withPick` puts it first in offline and Google lists.
- Phone: `Transliterator.setStoryNames/storyWords/rememberPick/withPick` (same key in SharedPreferences), `editor_screen.dart` `_loadStoryNames` (on open and `session.storyClosed` from `openStoryWorld`), `_chose` from the strip; `setupSpellMarks` adds Story World names to "mine". Fix: offline, a space now takes the ranked first spelling (`_firstOffline`), not the letter reading. **Not compiled here.**
- Help `02-typing.md`. Playwright (local): with a character കുഞ്ഞാറ്റ, "kunjaatta" → കുഞ്ഞാറ്റ first and the name isn't marked; a chosen spelling (വല്ലം for vellam) comes first next time.

## 2026-11-24: Desk download card on phones

- Website only (the desktop app hides the card; the phone app has none): iPhone visitors get the App Store row, Android the Google Play row (Soon). See `web.md`.

## 2026-11-24: Spelling "Suggest" for unknown words; phone "Deselect all"

- Web, desktop and phone: a word marked "Not in the dictionary" gets **Suggest** next to Ignore and Keep, showing known words that sound like it (from the offline Manglish word list). Only on request. Phone selection bar: **Select all** turns into **Deselect all** once everything is selected (web has no Select all button). Strings `check.suggest`, `check.suggestHint`, `check.noSimilar`, `app.selection.deselectAll` (en + ml). Help `03-editor.md` updated. Needs desktop Release + phone store build; phone part waits for CI.

## 2026-11-24: Download page and cards match the stores

- iPhone/iPad (App Store), Windows (Microsoft Store) and Mac (signed .dmg) never show "on its way" or "Coming soon" any more; Android still does until it leaves the closed test. Web only (`web.md`); the desktop app hides these pages, the phone app has none. Strings `download.mobileLive`, `download.heroBodyMobile` (en + ml, phone copy refreshed).

## 2026-11-24: Ranked offline Manglish suggestions (branch `offline-manglish`)

- Offline suggestions now pick real words: `packages/shared/src/manglish-rank.ts` (sound skeleton indexed by consonant outline, scored by fit, plain reading, typed vowel lengths and word rank) over `/dict/manglish-words.txt` (150k most used words, ~1 MB compressed, built in the deploy job by `scripts/build-manglish-words.mjs` from Kavya Manohar's CC BY 4.0 word frequencies, pinned revision + sha256). Dakshina test: first right 17.8% → 71.7%, top 6 27.1% → 87.6%; on 300 words checked through Litma MCP `transliterate` (Google), ours 225 right vs Google's 216.
- Writers are never forced: no close real word → plain reading first; plain reading always in the first six; capitals/`~`/`_`, COMMON words, word pieces, digits and punctuation keep today's lists. Online, Google's list still comes first (offline spellings fill in after it).
- Web/desktop: `apps/web/src/lib/manglish-words.ts` (loads on first Manglish word, index built in idle slices). Phone: `lib/core/manglish_rank.dart` + `Transliterator.offline` (word list via `Dictionary.text`, kept on the phone). Details in `web.md`, `mobile.md`. Research scripts: `scripts/manglish-lab/`.
- Credits: THIRD_PARTY_NOTICES.md + help `11-account.md#credits`; help `02-typing.md` Offline note rewritten.
- **Needs:** website deploy (builds the word list), desktop Release, phone store build. Phone code **not compiled here**: merge only after "Mobile app checks" is green.

## 2026-11-22: Keyboard and screen readers for the spelling suggestions

- Web and desktop: the card under a marked word (`SpellSuggest.tsx`) now works from the keyboard like the Manglish list: ↓/↑ through the spellings, Ignore and Keep, Enter uses the highlighted row, Esc closes, Alt+↓ always opens it. Screen readers get `aria-activedescendant`/`aria-controls` on the editor, a polite announcement (`check.announce`, en + ml) and `aria-invalid="spelling|grammar"` on every mark. Details in `web.md`. Desktop gets it with the next Release.
- Phone: suggestion rows made screen-reader friendly (`lib/editor/suggestion_rows.dart`, new widget tests); on a branch until CI's flutter analyze/test pass. Details in `mobile.md`.
- Web: Manglish list for screen readers, shortcuts list (?) in i18n with the spelling keys and proper dialog focus (`web.md`).

## 2026-11-22: Release also makes the desktop store builds

- `release.yml` calls `desktop-stores.yml` (Mac App Store to TestFlight, Microsoft Store `.appx`, Snap) with the new tag; build number = Release run number, like the phone. Details in `desktop.md`. Setup guide Part 11, `CLAUDE.md`, `apps/desktop/README.md` updated.

## 2026-11-19: Spelling suggestions at the word; phone marks spelling in the text

- Owner (iPhone screenshots): the phone app showed no spelling marks, and tapping a marked word on the website gave no suggestions. Now on every app a marked word the cursor is in (tapped, clicked, selected, or edited and checked again after the pause) shows its spellings: web/desktop in a small card under the word (`components/editor/SpellSuggest.tsx` `SpellSuggest`), web on phones and the Flutter app in the row above the keyboard where the Manglish spellings go (`SpellStrip` in the docked `ManglishPopup`; Flutter `_SpellRow` in `editor_screen.dart`). Choices: a spelling, **Ignore** (until the app is opened again; web `ignoreWord` in `lib/spell.ts`, phone `EditorSession.spellIgnored`), **Keep** (my words, as before), Esc on computers, or just keep typing (dialect words are a choice).
- `issueAt(state)` in `extensions/writing-aids.ts` only returns a mark whose text is still what was checked, so suggestions are always for the complete word.
- Flutter: the session checks every built line in the background (`_runSpelling`, 700 ms after typing, 24 lines a time), `BlockController` draws wavy lines (`spellIssues`, colours per kind from the theme) and moves them with edits; the phone now asks the `litma-spell` engine too (`lib/data/spell_engine.dart`, batched, cached, pauses a minute on failure) and has the "Check spelling?" kind; Check sheet has **Mark spelling in the text** (`litma:spell-marks`, on by default). Spacing (punctuation) marks are still web-only.
- Wavy lines a little thicker on the web (1.5px) so they read on iPhone Safari.
- New strings `check.suggestions`, `check.ignore`, `check.ignoreHint`, `check.keepHint`. Help `03-editor.md#spelling`.
- Checked: web typecheck, i18n, local build, Playwright (desktop 1280px and iPhone 13 emulation: marks, card/strip, fix, Ignore). **Unverified:** Flutter (no SDK here; new tests in `test/editor_test.dart` "spelling marks"), real iOS Safari/Android Chrome.
- Needs a desktop Release and a phone store build; website with the push.

## 2026-11-18: നാട്ടറിവ് looks like the phone; five new categories for writers

- Web/desktop category page (`apps/web/src/components/Nattarivu.tsx`) now matches the phone: section headings in the category's tint as "ml · en", no divider lines, 15px meanings, slightly bigger words.
- New categories in `packages/shared/src/nattarivu.ts` (synced to `_shared`, phone `assets/data/nattarivu.json` regenerated): `moving` ചലനങ്ങൾ (29), `speaking` സംസാരരീതികൾ (22), `doubles` ഇരട്ടവാക്കുകൾ (19), `smells` ഗന്ധങ്ങൾ (26), `eating` തീറ്റയും കുടിയും (35). Icons on web (`ICONS`) and phone (`nattarivuIcons`): Footprints, MessageCircle, Repeat, Wind, UtensilsCrossed.
- Words checked against the dictionary through Litma MCP `dictionary_lookup` (the cloud sandbox can't build `public/dict`); the most basic verbs and tastes (നടക്കുക, ഓടുക, തിന്നുക, മധുരം…) were not looked up one by one. Missing words left out: കിലുകിലെ, പടപടാ, തുരുതുരാ, തണുതണുത്ത, മിന്നിമിന്നി, ചുവചുവന്ന, തിളതിളാ, കരിഞ്ചൂര്, കൊതിമണം, ഊതിക്കുടിക്കുക, മൊത്തിക്കുടിക്കുക, ഞൊട്ടിനുണയുക.
- Kerala rivers and lakes (origin → mouth) were drafted but dropped on the owner's call: most names (പെരിയാർ, കബനി, വേമ്പനാട്ട് കായൽ) have no dictionary entry.
- Help `06-dictionary.md#nattarivu` mentions the new topics. Needs a desktop Release and a phone store build; website with the push.

## 2026-11-17: Security audit (owner saw a new Apple sign-in from Congo)

- That account was an ordinary new sign-up (Sign in with Apple, private-relay email, one visit, no writing, not an admin). No sign of a break-in: one admin (the owner), RLS on every table, admin and moderation functions check `app_admins`.
- Fixed: visitors could list every shared work (text, user id, trashed ones) from `documents` with the public key. Migration `20261117090000_security_hardening.sql` drops the anon "public documents readable" policy (the reader already uses `shared_document()`), and revokes TRUNCATE/TRIGGER/REFERENCES from the API roles. **Applied to the database only after the owner approves it, or by the next `db push`.**
- Fixed (Edge Functions, deploy with the Supabase job): MCP `get_book` looked up chapter titles without `user_id`; MCP had no rate limit (now per address, per user, and a tight one for wrong tokens; batches capped at 20); `litma-ai` fell back to server-wide `ANTHROPIC/OPENAI/GEMINI_API_KEY` secrets (removed, per the "no server-wide AI keys" rule) and had no rate limit; `_shared/ratelimit.ts` trusted the caller-written first `x-forwarded-for` entry, so limits could be dodged (now edge-set headers first).
- Still open for the owner: turn on leaked-password protection (Auth → Providers → Email; Pro plan). Old website copies that read shared works directly as a visitor will show "not found" until they reload (the service worker updates them).
- No app change: no desktop Release or phone build needed.

## 2026-11-16: Rhymes "Next set" everywhere; keyboard capitals off for Manglish

- Rhyme finder (web, desktop, phone) shows 40 at a time with a **Next set** button and "1–40 of N", cycling through up to 1,000 ranked rhymes. MCP `find_rhymes` takes `offset` and returns `next_offset`. Help `06-dictionary.md#rhymes`.
- Phone keyboards capitalised the first letter, and a capital means something in Manglish (Amma → ആമ്മ, Mazha → ംഅഴ). Off while typing Manglish in the web editor and title, the phone editor, and the rhyme and dictionary search boxes; phone editor also has smart quotes off in Manglish (owner saw ‘അമ്മ; not reproduced here).
- Needs a desktop Release and a phone store build; MCP change deploys with the Supabase job.

## 2026-11-16: Phone Dictionary gets the പ്രാസം tab

The owner noticed പ്രാസം missing outside the website. Web and desktop share `app/dictionary/page.tsx`, which has had the tab since 8 Nov (desktop releases since then include it); the phone's Dictionary didn't. Added it there (details in `mobile.md`), help guide `06-dictionary.md#rhymes` phone note and `apps/mobile/README.md` updated. Needs a phone store build; no desktop Release needed.

## 2026-11-16: Actions artifact storage full

Release #34 failed in "Web app for the desktop" and "Phone app / android" at upload-artifact: "Artifact storage quota has been hit" (installers and web builds kept for GitHub's default 90 days). Every upload-artifact step now keeps files 2 days (`desktop.yml`, `desktop-stores.yml`, `mobile-release.yml`, `mobile.yml`), and the phone's .aab copy is `continue-on-error` so a full quota can't block the Play upload. The owner must delete old artifacts once (the quota is recalculated every 6 to 12 hours). Unverified until the next Release run.

## 2026-11-16: Phone: Google sign-in stayed on the sign-up screen

Phone only (Android testers reported it). Sign-in itself worked (auth logs: every attempt got a session); the pushed sign-up screen just never closed. `AuthScreen` now closes when a sign-in arrives. Details in `mobile.md`. Web and desktop not affected (their callback page navigates). Needs a new phone build (Play closed test, and the App Store with the next update).

## 2026-11-16: Every help guide has its own page

Search Console: /help/?a=open-claude was "Alternative page with proper canonical tag". All 74 guides lived at /help/?a=<id> and carried /help/'s canonical, so Google indexed none of them. Now `app/help/[id]` builds /help/<id>/ for every guide (generateStaticParams, dynamicParams = false): own title ("<guide> · Litma Help"), description and canonical, the guide's text in the static HTML, all listed in sitemap.xml. Old ?a= links forward on the client. CLAUDE.md's "no dynamic route segments" rule now allows exactly this kind (owner agreed). Links updated in the phone app (credits), terms, README, notices, setup guide and dictionary build. Checked: full `next build` in a scratch copy (75 folders under out/help: 74 guides + shots; canonical, title, description, sitemap). Live with the push; the desktop app opens help on the website, so no Release needed for it; the phone's credits link changes with the next store build (the old address still forwards).

## 2026-11-16: iPhone app live on the App Store

iOS 0.7.24 approved (Ready for Distribution) after the 2.1 information request (recordings, demo account, Community blocking). `STORE_LINKS.ios` in `apps/web/src/lib/release.ts` and the `mobile.ios` link written to `latest.json` by `.github/workflows/desktop.yml` are now https://apps.apple.com/app/id6834719757 (country-neutral form of apps.apple.com/in/app/litma-malayalam-writing/id6834719757), so the App Store badge on the website opens the listing instead of "Coming soon". The phone's update prompt reads `mobile.ios` from latest.json after the next desktop Release. Mac 0.7.26 still waiting for review. Next phone build: the 15 Nov phone fixes (desk filter, trash error, Undo toasts) and the dictionary joiner fix.

## 2026-11-15: Desktop sign-up emails linked to the Supabase server

Owner signing up in the Mac app (0.7.26): the confirmation link opened `https://<ref>.supabase.co/auth/v1/auth/callback/?…` and showed "No API key found". `verifyUrl` in `supabase/functions/litma-send-email/index.ts` built desktop (`app://`) links from the hook's `site_url`, which is Supabase's auth address, not the Site URL. Now only a non-Supabase `site_url` is used, else https://getlitma.in. Website (https redirect) and phone (own scheme) links were not affected. Checked the address logic with node; deploys with the push (deploy job). No app build needed.

## 2026-11-15: Desks showed other writers' shared works

Owner on the iPhone (App Review account): a work "moved to trash" never reached Trash. Logs: the phone PATCHed the owner's shared poem as the reviewer account (406, no row), and the desk hid the error. Cause: policy "public documents readable" let any signed-in writer read every shared work, and the desk listing (`listDocs`), opening by id (`getDoc`) and prefetch had no `user_id = me` filter, in the web/desktop store (`apps/web/src/lib/store.ts`, `myId()`) and the phone store (`apps/mobile/lib/data/store.dart`, `_me`). So every desk listed every shared work. Fixed in both stores; MCP already filtered. Server: migration `20261115130000_shared_document.sql` keeps the direct read for visitors only (`anon`) and adds `shared_document(share)`, which the reader (`getShared`) now uses, so builds already in the stores (iPhone 0.7.24 in review, Mac 0.7.26) stop listing others' works as soon as it runs. Phone: trashing/restoring shows "That didn't work" and refreshes when the server refuses (`desk_screen.dart`), instead of a false "Moved to the trash". Checked: migration in a rolled-back transaction (reviewer reads 3 rows before, 1 after; function opens the link; owner keeps 14; visitors read the link), web typecheck, i18n. Unverified: `next build`, `flutter analyze && flutter test` (new test in `test/offline_test.dart`). Release: desktop needs one for the store filter (the server change already protects it); phone gets the error toast with the next store build.

## 2026-11-15: Block a writer in Litma Community

For App Review (guideline 1.2: apps with user-generated content need a way to block abusive users; the iPhone and Mac apps open Community from Settings). Migration `20261115120000_community_blocks.sql`: table `community_blocks` (own rows only, name/picture copied from the profile by a trigger, max 1000, not yourself), and the `read threads` / `read replies` policies now hide posts by writers the reader blocked. Website: **Block** beside Report on every post that isn't yours, **Blocked writers** page (`/community/?view=blocked`) with Unblock. Help `13-community.md#community-block`, Community Guidelines and Privacy Policy updated (15 Nov). Phone/desktop: nothing to build: both open the website's Community. Checked: migration run against the live database inside a rolled-back transaction (block hides the thread and replies, unblock brings them back, self-block refused); `typecheck`, `i18n:check`, `mobile:assets`. Unverified: `next build` (couldn't run in the Linux sandbox; run it on the Mac) and the screens in a browser. Live after push (deploy job runs `db push`).

## 2026-11-15: Store badges on the website, Linux off the website

Website only (no Release: the download page and the home download card are hidden inside the desktop app; the phone app opens the website). The stores' own badges (App Store, Google Play, Microsoft Store) from `public/brands/`; Windows visitors get the Microsoft Store first with the direct `.exe` under it; the home page's download card covers phones too. Linux removed from the website, help, privacy intro, README and store texts; the AppImage and Snap builds and workflows stay (owner). Details in `web.md`. Push after the Microsoft Store listing is published, or the Windows badge opens "not available" meanwhile.

## 2026-11-14: Mac app submitted to the App Store

macOS App 0.7.26 (build 4, from **Desktop store builds**) submitted for review at 22:50 IST, manual release, same listing as the iPhone app (Apple ID 6834719757). Checked by the owner in TestFlight for Mac: installs, dictionary suggestions. iPhone 0.7.24 (6) still waiting for review. After approval: release both by hand; then the next iPhone build should be 0.7.26 (dictionary joiner fix, Manglish suggestions are web-only). Open: `STORE_LINKS` in `apps/web/src/lib/release.ts` has only `ios`/`android`; the download page could add a Mac App Store link (https://apps.apple.com/app/id6834719757 opens the Mac listing on a Mac) once the Mac app is live.

## 2026-11-14: Dictionary finds words typed with a stray joiner

Owner on the iPhone (build 6): കാട് gave "No entry", and no suggestions while typing. The keyboard had put an invisible U+200C after ്. `spellings()` in `packages/shared/src/dict.ts` (synced to `supabase/functions/_shared`, so MCP `dictionary_lookup` too) and in the phone's `lib/data/dictionary.dart`: `lookup` and `suggest` try the word as typed, then with old-style chillu (consonant + ് + U+200D) made atomic and joiners removed. As typed first, because 756 dictionary words keep a joiner. Checked on the web side against the built data (കാട് + U+200C / U+200D → കാട്); phone test in `test/phases_test.dart` not run here (no Flutter). **Reaches the iPhone only with the next store build** (0.7.24 build 6 is in review without it); website with the push; desktop with a Release / store build.

## 2026-11-14: Dictionary suggestions for Manglish

Website and desktop: the dictionary box now suggests Malayalam words for Manglish as you type (like Olam), next to English completions, with ↑ ↓ Enter. The phone already suggested Manglish spellings. Details in `web.md`; desktop gets it with the next Release (and Mac App Store build). Help `06-dictionary.md#look-up`.

## 2026-11-14: Mac App Store signing

The five Mac App Store secrets are set (Apple Distribution and Mac Installer certificates, Mac App Store profile for `in.getlitma.litma`). The first store build failed in electron-builder's own keychain step; `apps/desktop/scripts/build-mas.sh` now signs with a keychain of its own; run #2 passed. Next: TestFlight for Mac, then attach the build to the macOS version (manual release). Details in `desktop.md`.

## 2026-11-14: iPad screenshots for the App Store

Phone app screenshot test renders eight iPad 13" shots (`ipad-0N-*`, 2064 x 2752); `scripts/store-ipad-screens.py` adds the iPhone set's captions and colours into `marketing/store/app-store/ipad/`. Needs a manual run of the Mobile workflow (the screens job), then the script. Details in `mobile.md`.

## 2026-11-14: Clear button and Esc in name fields

The work title (editor top bar, phone rename box) and the Book details Title, Subtitle and Author fields get a × that empties them, and Esc puts back the text from before the writer clicked in (web, desktop, phone with a hardware keyboard). A work title left empty gets its old name back. New string `field.clear` (en + ml). Help: `01-getting-started.md` (Rename a work), `02-typing.md#manglish-fields`. Unverified: `npm run build` (couldn't run in the sandbox), phone `flutter analyze`/`flutter test`; desktop needs a Release.

## 2026-11-14: Desktop app for the stores

Mac App Store (sharing the iPhone app's listing), Microsoft Store and Snap Store packages of the desktop app: `electron-builder.stores.yml`, `src/store.ts` (store copies don't self-update), workflow **Desktop store builds** (`.github/workflows/desktop-stores.yml`). Setup guide Part 11. Details and what is unverified in `desktop.md`.

## 2026-11-14: Phone editing fixes, title in Manglish

Phone app: a selection can run over many lines and pages (handles, bar, typing replaces it), Backspace removes an empty page, Move to trash closes the editor at once, rename takes Manglish. Web and desktop: the title box turns Manglish into Malayalam. Details in `mobile.md` and `web.md`. Phone changes pass CI and were checked by the owner on TestFlight build 0.7.24 (6) on an iPhone; desktop needs a Release. App Store: build 6 is the one to submit (Apple ID 6834719757, manual release); after it is live, fill `STORE_LINKS` and the `mobile.ios` link in `latest.json`.

## 2026-11-14: Store setup

Apple and Google Play developer accounts bought. Setup guide Part 10 (phone stores, Mac signing); iOS store build now signs with the App Store Connect key (`mobile-release.yml`). Details in `mobile.md` and `desktop.md`.

App Store Connect app made (Apple ID 6834719757, 13+); listing and iPhone screenshots in `marketing/store/app-store/`; `Info.plist` declares no non-exempt encryption. Open: `ASC_*` secrets, first TestFlight build, iPad or iPhone-only (see `mobile.md`).

## Open items

- Keyboard: Android and iOS projects in `apps/keyboard` (Swift/Kotlin Manglish ranker ports with the shared vector tests), handwriting prototype (ML Kit Malayalam model: availability, quality, iOS keyboard memory), `keyboard-release.yml` for store builds, bundle ids.
- Make `deploy.yml` call `engine-data.yml` instead of building the word list inline (needs a watched deploy).

- Engine branches (24–26 Nov, stacked: `offline-manglish` → `manglish-names` → `forgiving-search` → `spelling-suggestions` → `better-rhymes` → `metre-checker`): CI green on `metre-checker` (26 Nov, holds all six and fixes `main`'s phone build); merge that one PR; owner to compare Manglish with Google on real writing.
- Metre checker: try it on real poems by writers from different traditions; Malayalam metres are sung and loose, so collect stanzas the checker gets wrong and add them to `apps/mobile/test/metre_inputs.txt` (with the right answer in `metre.ts`). Not covered yet: ഓമനക്കുട്ടൻ, മാവേലി and other metres whose definition sources disagree on; മിശ്രകാകളി-style lines where some ganas have four matras.

### Still open (after the 2026-11-07 work)

Accessibility (2026-11-22): spelling card keyboard/screen-reader support needs a desktop Release and a real screen-reader try (VoiceOver, NVDA). Phone suggestion rows: merge their branch only after CI is green. Still to do: hardware-keyboard use of the phone row (it is hidden without the on-screen keyboard; owner's call), phone Manglish announcement, Focus mode button text into i18n.

Microsoft Store (2026-11-14): product Litma reserved (Store ID 9NKP5NXGX0J2, details in `desktop.md`). Variables set, packages built and submitted for certification on 15 Nov (publish held until "Publish now"); after approval publish; the website already links to it (`STORE_LINKS.windows`, 15 Nov). When the App Store and Play listings are live, fill `STORE_LINKS.ios` / `.android` and the badges become links.

Security (2026-11-13): owner to create the Turnstile widget, set `TURNSTILE_SITE_KEY`, then switch on Supabase Captcha protection and leaked-password protection (setup guide 3.5). Deleting an account also deletes its community posts, including removed ones kept for the IT Rules' 180 days; if that record must survive deletion, copy removed posts to a separate table first.

Reels (2026-11-09): reel 3 (launch ad) can be re-voiced with Despina (Gemini) when the TTS quota allows; post the reels with a track from Instagram's music picker; on the Mac, run the one-time setup in `docs/marketing/reels.md` (Whisper and yt-dlp could not reach their downloads from the cloud sandbox).


Spelling engine (2026-11-09): Edge Function `litma-spell` (mlmorph) is deployed by the push as the last Supabase step (`--use-docker`, allowed to fail). Check the Actions log for "Deploy the spelling engine" and that litma-spell appears in the Supabase dashboard; if it fails, writers simply get the old spelling checks. Phone app: uses it since 2026-11-19 (marks in the text). Desktop: next Release.

Grammar check (2026-11-09): the web/desktop Spelling and grammar panel checks grammar itself with fix cards; the push deploys the `litma-ai` function with the new `grammarCheck` action (until then the check answers "Unknown action"). The phone app still uses the old flow (see `apps/mobile/README.md`).

Litma Community (2026-11-09):
- **Push** also runs migration `20261109140000_shared_author` (writer's name on shared links); until then the shared page shows the author line from the work itself.
- **Push**, then check migration `20261109120000_community` ran and the cron job `litma-prune-community` exists. Until then /community/ shows "Something went wrong" to signed-in writers.
- Run the Supabase security and performance advisors after the migration (the sandbox could not reach the project).
- **Legal:** have a lawyer read `/community/guidelines/` (#responsibility, #contact), Terms #community and Privacy #community. India's IT Rules 2021 expect a named **Grievance Officer** (name and contact) on the site; the pages give only support@getlitma.in and promise 24-hour acknowledgement and 15-day resolution. Add the name when decided.
- Moderators are `app_admins` rows; there are no email notifications for new reports yet (check **Reports** on /community/).
- Desktop gets the community only after a **Release**; the phone app links to the website until native screens exist.

Only the owner can do these (accounts, secrets, dashboards):
- **Phone app in the stores (accounts bought 2026-11-14):** follow `docs/setup/google-and-supabase.md`
  Part 10: App ID with Sign in with Apple, App Store Connect app + Admin API key, Play Console app,
  upload keystore (first `.aab` uploaded by hand), service account, store forms, demo account for
  reviewers. Then fill `STORE_LINKS` and the `mobile` block of `latest.json`; until then the web's
  store buttons say "Coming soon". The iOS CI signing change (mobile.md 2026-11-14) is untested.
- **Desktop signing:** macOS done (signed and notarised download, 14 Nov). Windows: `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` (a paid code-signing certificate); until then the Windows installer shows SmartScreen's warning.
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

## 2026-11-13: i18n gaps filled, and the every-change checklist

- `ml.json`: 98 writer-facing strings that existed only in English (Litma Community moderation, reasons, agreement, errors; AI grammar check; Settings admin link) now have Malayalam. Only `admin.*` (owner's dashboard) stays English.
- New `scripts/check-i18n.mjs` (`npm run i18n:check`): every en key in every other language except `admin.*`, no extra keys, same `{placeholders}`. Runs in the deploy job (fails the build).
- `CLAUDE.md` **Every change: the checklist**: strings in both languages, help guide, Privacy/Terms, credits, CSP and rate limits, setup guide, project docs and change logs, checks, Release. Pointers from `README.md` (Changing Litma) and `apps/web/content/help/README.md`.

## 2026-11-13: Help guides and sign-in messages for the security work

- Help: `01-getting-started.md` new guides **The quick security check** (`?a=security-check`) and **If your account is blocked** (`?a=blocked`), leaked-password note; `11-account.md` Get help links; `13-community.md` account blocks. Privacy: Cloudflare Turnstile listed, hashed-address rate limits. Sign-in messages for blocked accounts, leaked passwords and an unfinished check (web `lib/auth.tsx`, phone `authMessage`); the auth callback page explains Google's error too. README and phone README updated.

## 2026-11-13: Account deletion, admin blocking, rate limits, CAPTCHA, security headers

- **Delete account in every app** (App Store and Google Play rule): Edge Function `litma-account` (`{op:"delete",confirm:"DELETE"}`; removes storage files via `_shared/accounts.ts`, then `auth.admin.deleteUser`; every table cascades). Web/desktop `components/settings/DeleteAccount.tsx` (Settings, last section; then `forgetAccount` in `lib/offline.ts`, sign out, `/login/?deleted=1`). Phone `_DeleteAccount` in `settings_screen.dart`, `lib/data/account.dart`, `LocalDb.forget`. Help `/help/?a=delete-account` (public link for Google Play). Privacy and Terms updated (13 Nov).
- **Admin: block or delete an account** (/admin/ → Writers → a writer → Account, `components/admin/AccountActions.tsx`): block for 1/3/7/30/90/365/any days or for good (Supabase `ban_duration`; 36500 days), unblock, delete (type the email). `litma-admin` ops `block`/`unblock`/`delete`; refuses self and admins; every action in `admin_actions` (migration `20261113120000_admin_moderation.sql`, which also adds `banned_until` to `admin_users`). Blocked badge in the list. Terms and Privacy say so.
- **Rate limits:** `_shared/ratelimit.ts` (in-memory per instance, hashed IP or user id): `litma-transliterate` 600/min per address, `litma-track` 60 batches/min (extra dropped silently), `litma-spell` 120/min per writer, `litma-account` 5 per 10 min.
- **CAPTCHA (Cloudflare Turnstile), off until the owner turns it on:** page `/captcha/` (needs repo variable `TURNSTILE_SITE_KEY` → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`), framed by web/desktop (`components/auth/Captcha.tsx`, `useCaptcha`) and shown in a web view on the phone (`lib/features/auth/captcha.dart`, new dependency `webview_flutter`). Every sign-in, sign-up, email-link and reset call runs first without a token; only when Supabase answers `captcha_failed` does the check appear and the call repeat with the token. Setup: `docs/setup/google-and-supabase.md` 3.5 (also leaked-password protection).
- **Security headers** in `apps/web/public/.htaccess`: HSTS (1 year, no subdomains), Content-Security-Policy (self + Supabase, Google sign-in/Drive/Fonts, Datamuse, GitHub, Turnstile; `'unsafe-inline'` scripts for Next's static export), `frame-ancestors 'self'` + `X-Frame-Options SAMEORIGIN` (the `/captcha/` page also allows `app:` for the desktop app), Permissions-Policy.
- **Dictionary share-alike:** credits section and `THIRD_PARTY_NOTICES.md` say the files at `/dict/` are under ODbL 1.0 / CC BY-SA 4.0; `build-dictionary.mjs` writes `dict/LICENSE.txt`.
- Checked: web typecheck; a cloud-mode build with a mocked Supabase and Turnstile in Playwright (CSP headers served like .htaccess): no CSP violations on home, help, dictionary, legal, download, community, login, desk, settings, admin; sign-in shows the check and retries with the token; Delete account calls the function and lands on the notice; admin block/unblock/delete. Not checked: real Turnstile, the Edge Functions on Supabase (deploy), the phone (no Flutter here: run `flutter pub get && flutter analyze && flutter test`), the desktop iframe.

## 2026-11-13: Credits in one place only (owner)

- Removed source names from everywhere but the help section Credits and licences and `THIRD_PARTY_NOTICES.md`: the "Data: … from Olam. Opposites via Datamuse." line under dictionary entries (`DictionaryView.tsx`), the Olam link on the home page (`app/page.tsx`) and in `HowItWorks.tsx`, "Google Input Tools" in the home features and the Manglish panel (now "Online suggestions"), the mlmorph note in `03-editor.md`, Olam in `06-dictionary.md`, `rhyme.source` (en, ml; phone uses the same string). Terms → Dictionary, spelling and fonts now links to the credits section. README trimmed the same way. Privacy still names Google Input Tools as a service that sees data (a disclosure, not a credit).

## 2026-11-13: Credits for mlmorph and the other open work

- New `THIRD_PARTY_NOTICES.md` (repo root): mlmorph (full MIT text, Santhosh Thottingal and contributors, SMC; what was ported; sources of its mistakes list), Olam datasets (ODbL, CC BY-SA 4.0), Datamuse, SMC / Noto / Google fonts (SIL OFL), the `logos` collection (CC0). Header notes in `packages/shared/src/mlmorph.ts` and `litma-spell/index.ts` point to it.
- Help: new guide section **Credits and licences** (`content/help/11-account.md#credits`, `/help/?a=credits`); the editor guide's spelling note credits mlmorph and links there.
- Settings → About links to it on web and desktop (`AboutLitma`, opens in the browser on desktop via `useHelpHref`) and on the phone (Settings ListTile). New string `legal.credits`.
- README: spelling and grammar feature text, a **Spelling engine** and a **Credits** section, `litma-spell` in the table and layout. CLAUDE.md: credits rule under the spelling engine.
- Unverified: not built or clicked here (typecheck only); `flutter analyze` not run (no SDK in the cloud). Desktop gets the About link with the next Release.

## 2026-11-09: Litma Community (forum), guidelines and user-content notices

- New public-styled page `/community/` (web and desktop share it): categories, search (Manglish-aware), threads, replies, likes, edit/delete own posts, report, guideline agreement before the first post, and moderation for `app_admins` (close, reopen, remove, restore, pin, remove reply, stop a writer posting, reports queue). Details in `web.md`.
- Database: `supabase/migrations/20261109120000_community.sql` (tables `community_threads`, `community_replies`, `community_likes`, `community_reports`, `community_members`, `community_mod_log`; RLS, triggers, functions, 180-day purge by cron `litma-prune-community`). Checked in PGlite (Postgres 16 in WASM) with stand-in `auth.uid()`, roles and `app_admins`: 40+ cases incl. posting before agreeing, forged author/status fields, closed threads, bans, removed posts' visibility, admin-only functions, rate limit. Not yet run on Supabase.
- Legal: new `/community/guidelines/` (what is never allowed, moderation, "Who is responsible for posts", grievances); Terms of Use get a "Community and other people's content" section (user content is the writer's responsibility, intermediary status, indemnity) and a line in "The service"; Privacy Policy gets a "Litma Community" section. All dated 9 November 2026. The notice is not shown inside the writing app, only on the community, guidelines, Terms and Privacy pages.
- Desktop: no desktop-only code; it gets the pages with the next **Release**. Phone: Settings links to the community and the guidelines in the browser (`apps/mobile/lib/features/settings/settings_screen.dart`); native screens noted in `apps/mobile/README.md`. Strings `community.*` in `packages/i18n` (en + ml), copied by `npm run mobile:assets`.

## 2026-11-09: Instagram posters folder (marketing only, no app change)

- `marketing/posters/`: finished posters (`*_1080.png` to post, `*_master@3x.png` 3240 wide). `marketing/posters/.gitignore` allows only those two kinds of file plus the README.
- `.github/workflows/deploy.yml`: `marketing/**` added to `paths-ignore`, so poster and reel commits don't redeploy getlitma.in.

## 2026-11-09: Reel 3, 30 s launch ad with Malayalam voiceover (marketing only, no app change)

- `marketing/reels/reel-launch/` (HyperFrames, `SPEC.md`): the app in dark mode inside a plain phone frame on a
  soft colour-field backdrop, writer questions in bubbles, a monitor for the desktop beat, end card with
  getlitma.in. Owner's choices for this reel (override `docs/marketing/reels.md`): dark screens, phone frame,
  Malayalam voiceover, no subtitles. Reference: Sleeko Studio's HowDo launch ad.
- Footage: `marketing/reels/capture/rec-launch.cjs` (dark mode, 1170 x 2394 phone, 1920 x 1200 desktop).
- Voice: TTSForFree "Sobhana (Natural)" ml-IN; the Gemini voice did not fit the free daily quota. Cut into
  `assets/vo1..8.wav` at the pauses; the sentence-to-pause mapping was matched by timing, not heard.
- No music (HeyGen catalog needs a sign-in). No Release needed: nothing in the apps changed.

## 2026-11-09: Clearer FTP sign-in errors in the website deploy

- CI only (`deploy.yml`): port-21 check and the server's own replies when the getlitma.in sign-in fails. A deploy failed with "max-retries exceeded"; cause not yet known (password, username or the host blocking GitHub). Details in `web.md`.

## 2026-11-09: Desktop build retries and caches Electron

- CI only (`.github/workflows/desktop.yml`): Electron download cached, electron-builder retried 3 times after a GitHub 504 failed a Mac build. `npm ci` no longer downloads the Electron binary in CI (`ELECTRON_SKIP_BINARY_DOWNLOAD=1` in `desktop.yml` and `deploy.yml`). Details in `desktop.md`.

## 2026-11-09: Instagram reels (marketing only, no app change)

- Two 9:16 reels made from real footage of the app: `marketing/reels/reel-manglish` (HyperFrames: a short story typed in Manglish becomes Malayalam) and `marketing/reels/reel-types` (Remotion: the nine writing types land on the desk). Footage comes from `marketing/reels/capture` (Playwright screen recording of a local-mode build at 1080 x 1920, Google Fonts served from Fontsource). Workflow, rules and prompts: `docs/marketing/reels.md`; Claude skill `litma-reels`.
- No change to web, desktop or phone code: no Release or store build needed.
- Unverified: the reels are silent (music is meant to be added in Instagram); captures were made in a cloud sandbox, so check them once on the Mac with `npm run all` before re-rendering.

## 2026-11-08: Pages in the phone app's editor (phone only)

- The phone app's editor now shows pages as you write (about a printed page each, the next page when one fills, a small + between pages). The website on phones keeps its continuous sheet with the Pages switch; web and desktop unchanged. Details in `mobile.md`.

## 2026-11-08: Read aloud: voice, pitch, volume, word underline (all apps); save as audio (phone)

- Web and desktop: Pitch and Volume beside Speed, spoken word underlined when the voice reports words, settings apply from the next sentence. Phone: the same plus a voice picker, and **Save as an audio file** (WAV, made on the phone). Browsers can't record speech, so saving audio stays phone-only. Details in `web.md`, `desktop.md`, `mobile.md`. Desktop needs a Release; the phone needs a store build.

## 2026-11-08: Phone read aloud without a plugin (phone only)

- The phone app reads aloud through its own small channel instead of flutter_tts, so iOS builds use Swift Package Manager only and no CocoaPods. Details and what to check on devices: `mobile.md`. Web and desktop unchanged.

## 2026-11-08: Editor tools grouped (phone app, website on phones)

- The phone app's tools sheet was one flat 3-column grid of 17 tiles. It now has labelled groups in 4 columns: **Words** (Dictionary, Rhymes, Check, Saved words), **Plan and assist** (AI companion, Story World, Goals), **Page** (Format, Page setup, Contents, Pages, Insert page), **Review and share** (Listen, Version history, Share & export), then **For this work** (footnote, fill cast, scene tools, diary entry, only for their writing types).
- Phone app: Find moved to its own top-bar button; the Assistant inbox tile left the sheet and opens from an inbox icon in the AI companion's header (the keyboard strip's Inbox stays). Insert page stays a tile because Pages is a PDF preview and can't insert.
- Website on phones: the More sheet's tiles use the same group names (Inbox keeps its tile there for its count badge). Desktop and wide screens unchanged (the More sheet is phone-only).
- Strings `app.tools.group*` in `packages/i18n` (en, ml), `npm run mobile:assets` run. Help: `03-editor.md`, `09-ai.md`.
- Web typecheck passes; the web sheet and the phone code are unchecked in a browser or on a device (no Flutter SDK). Needs a phone store build; no desktop Release needed.

## 2026-11-08: Pin the work in progress (all apps, MCP)

- One work can be pinned to the top of the desk (Pinned badge, accent border, first whatever the sort). Stored as `profiles.preferences.pinnedWork` (one id, so pinning another moves the pin; follows the writer to every device; local mode `litma:pinned`). No migration.
- Web/desktop: `apps/web/src/lib/pin.ts`, pin button on each desk card (`app/desk/page.tsx`). Phone: long-press action and badge (`desk_screen.dart`, `pinnedWork()`). MCP: `pin_document`, `list_documents` lists the pinned work first as PINNED.
- Help `01-getting-started.md#pin`, README, CLAUDE.md. Checked on the web in local mode (pin, move, reload, unpin, phone width). Needs a desktop Release and a phone build; the phone part is unverified (no Flutter SDK).

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
