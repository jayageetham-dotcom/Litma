# Journals (branch `journals`)

Owner's ask: build claude/journals-plan.md (agreed with the owner) on the website, desktop and phone app, with MCP, help guide, en + ml strings and docs/changes. A Journals tab on the desk with journal cards, ‹ › between journals in the editor, Export of one or all journals, and no share link for journals.
Lead: Claude session 2026-11-28 · Started: 2026-11-28

Note: the plan file lives in the claude.ai project, which this session can't read. The decisions below are the owner's own words from the session brief (28 Nov). Anything the brief doesn't settle goes under Questions and to the owner with the mockups; nothing is guessed silently.

Builds on branch `notes-first` (Part 1): diary is called ജേണൽ · Journal in names, internal kind stays `diary`; the keep rule `keepOnClose` (shared `forms.ts`, phone `lib/data/forms.dart`).

## Decisions
- 2026-11-28 Internal kind stays `diary`; the UI says ജേണൽ · Journal (owner).
- 2026-11-28 Desk tabs: **Works · Books · Journals · Trash**; `?view=journals`. The Works view no longer lists kind `diary` (owner).
- 2026-11-28 Journal cards: the started date as a small calendar block, top left; last-edited date bottom right, only when it differs from the started date; an untitled journal shows its first line in bold as its title; month lines divide the list; empty state "Start your journal" (owner).
- 2026-11-28 A journal's title defaults to its started date (owner). "Started" = the work's `created_at`.
- 2026-11-28 Editor title bar for journals: ‹ title ›, with a "started · edited" line; ‹ and › open the journal started before / after (owner).
- 2026-11-28 Export dialog: This journal / All journals, a date range, a format (PDF, Word). All journals = one file, oldest first, with a contents page (owner).
- 2026-11-28 No share link for journals: hidden in every app, a database rule refusing shares for kind `diary`, and a migration revoking existing diary shares (owner approved).
- 2026-11-28 Journals can't be added to Books (owner).
- 2026-11-28 MCP: `create_document` makes journals, `list_documents` marks them, no share (owner).
- 2026-11-28 Owner OK on the mockups (09:56), with one change: **the page title "ജേണലുകൾ" is too big on phones.** Phones (< 768 px, web and Flutter): the Journals heading is 24 px (Anek Malayalam semibold, line-height 1.25), the description 14 px; desktop keeps the mocked size. Designer re-checks it in the review.
- 2026-11-28 Owner accepted the mocked answers: untitled = title empty, an old default (പുതിയ ജേണൽ / പുതിയ ഡയറി) or still its started date; export range by started date; journals export as PDF and Word only; Malayalam month and weekday names in both UI languages; phone tabs scroll sideways; no Pin, no Duplicate on journal cards; no keyboard shortcut and no swipe for ‹ ›; phone bar `[←] [‹] title [›]` as mocked; "New entry" stays, Malayalam പുതിയ എൻട്രി.
- 2026-11-28 Shared contract (lead), web `packages/shared/src/forms.ts`, phone `lib/data/forms.dart`, same names and answers, hand-written cases in both test suites (web: a tsx check or vitest-free script the tester can run; phone `test/journal_test.dart`):
  - Fixed Malayalam tables, never `Intl`/`toLocaleDateString` (ICU adds ZWNJ: ഞായറാഴ്‌ച). Full months ജനുവരി…ഡിസംബർ, full weekdays ഞായറാഴ്ച…ശനിയാഴ്ച (as the phone's `_months`/`_weekdays`), short months ജനു ഫെബ്രു മാർ ഏപ്രി മേയ് ജൂൺ ജൂലൈ ഓഗ സെപ്റ്റം ഒക്ടോ നവം ഡിസം, short weekdays ഞായർ തിങ്കൾ ചൊവ്വ ബുധൻ വ്യാഴം വെള്ളി ശനി.
  - `todayLine(d)` → "2026 നവംബർ 28, ശനിയാഴ്ച" (web switches to the fixed tables, so web and phone write the same dateline).
  - `journalDay(d)` → { day: 28, month: "നവം", weekday: "ശനി" }; `shortDate(d, now)` → "28 നവം", or "28 നവം 2025" when not this year; `monthLine(d)` → "2026 നവംബർ".
  - `journalTitle(d)` = `todayLine(d)`: the title a new journal gets (store `createDoc`, both apps, and MCP `create_document` when no title is given). Dates are the writer's local day.
  - `isUntitledJournal(title, createdAt)`: true for an empty title, പുതിയ ജേണൽ, പുതിയ ഡയറി, or a title equal to `journalTitle` / `shortDate` of its created day (trimmed).
  - `keepOnClose` gets an optional `createdAt`; for kind `diary` the title counts as not named when `isUntitledJournal` says so. So a new journal with only its date title and no text is still discarded.
  - Journal order and ‹ ›: by `created_at` (ties by id), trashed journals excluded.
- 2026-11-28 Sharing (owner approved): migration adds a trigger on `public.documents` that refuses `is_public = true` or a non-null `share_id` when `kind = 'diary'`, and revokes existing diary shares (`is_public = false, share_id = null`; touch trigger paused). The apps hide every share entry for journals; MCP refuses sharing a journal if any tool can share.
- 2026-11-28 Books: journals can't be added (web and phone pickers leave them out; MCP `add_to_book` refuses a diary with a plain message). Old books that already hold a journal keep it.
- 2026-11-28 Old journals keep their stored titles; nothing is renamed. The Works tab no longer lists kind `diary` (Works counts change accordingly).
- 2026-11-28 Order: designer mockups (phone 320/375/390, desktop 1440, light and dark) → owner's OK → web-dev and flutter-dev in parallel → designer review + tester → fixes → verifier with every CI check green → PR → merge (owner).

## Questions
- → owner: untitled, export range, "New entry" (answered 28 Nov: see Decisions).
- → owner (designer): dates show Malayalam months in the English UI too ("Edited 27 നവം"), like `todayLine`. OK, or English months ("Edited 27 Nov") when the app is in English? (answered 28 Nov: as mocked, see Decisions)
- → owner (designer): phone tabs. In Malayalam the four tabs don't fit any phone width, so the mockups make the tab row scroll sideways (`desk-journals-320-dark.png`). The alternative is a shorter Trash: an icon-only segment on phones. Which do you prefer? (answered 28 Nov: as mocked, see Decisions)
- → owner (designer): the export formats for a journal are PDF and Word only (as decided). The Export menu used to offer Markdown, plain text and web page for every work. Is dropping those for journals intended? (answered 28 Nov: as mocked, see Decisions)
- → owner (designer): Pin for journals. My proposal: no pin on the Journals tab (the newest is already first). Duplicate is also left out. (answered 28 Nov: as mocked, see Decisions)
- → owner (designer): a keyboard shortcut for ‹ ›? Alt+←/→ is the browser's Back, so I suggest none for now, or Ctrl+Alt+[ and ]. (answered 28 Nov: as mocked, see Decisions)
- → owner (designer): on phones, swipe left/right on the page to move between journals? I suggest no (it fights with text selection and the page scroll). (answered 28 Nov: as mocked, see Decisions)
- → web-dev (designer): `isDefaultTitle` for `diary` must also treat the date title as default once titles default to the started date, or every new journal is kept by the keep rule and the "untitled" card rule never applies. Please export one helper (`isUntitledJournal(title, createdAt)`) that the card, the keep rule and the phone share.

## Design spec (designer)
Mockups (static HTML built with the real tokens from `theme.css`, fonts from `apps/mobile/assets/fonts`): `/home/claude/mockups/` (outside the repo). Contact sheets: `sheet-desk.png`, `sheet-desk-empty.png`, `sheet-editor.png`, `sheet-export.png`, `sheet-states.png` (phone states), `sheet-states-desktop.png`. Each sheet's light row uses the English UI and its dark row the Malayalam UI, so every size is checked in both languages. The source is `/home/claude/mockups/src/build.mjs` (run with `cd /tmp/pw && node /home/claude/mockups/src/build.mjs`). Phone pictures follow the Flutter app's look (wordmark app bar, segmented tabs, FAB, Desk · Dictionary · Me bar). The web on phones uses the same layout in its own parts (pill tabs, `MobileNav`).

### Dates (both apps, one helper)
- All journal dates use Malayalam months and weekdays, as `todayLine` does, in both UI languages. Add a shared helper next to `todayLine` in `packages/shared/src/forms.ts` and `apps/mobile/lib/data/forms.dart`: `journalDay(d)` → `{ day: 28, month: "നവം", weekday: "ശനി" }`, `shortDate(d)` → `"28 നവം"` (add the year, `"28 നവം 2025"`, when it isn't this year), `monthLine(d)` → `"2026 നവംബർ"`.
- Use **fixed tables**, not `Intl`/`toLocaleDateString`: ICU returns ZWNJ forms (ഞായറാഴ്‌ച, ഒക്‌ടോബർ) and Dart's list doesn't, so web and phone would differ. Short months: ജനു ഫെബ്രു മാർ ഏപ്രി മേയ് ജൂൺ ജൂലൈ ഓഗ സെപ്റ്റം ഒക്ടോ നവം ഡിസം. Short weekdays: ഞായർ തിങ്കൾ ചൊവ്വ ബുധൻ വ്യാഴം വെള്ളി ശനി. Put vector cases in a test on both sides.
- "Started" = `created_at`, "edited" = `updated_at`, both in the writer's local day. The edited date shows only when its **day** is different from the started day.

### 1. Desk: Journals tab (`?view=journals`)
Where: web `app/desk/page.tsx` (a 4th entry in the tab list, between Books and Trash); phone `desk_screen.dart` (`DeskTab.journals`, between books and trash). `MobileNav` keeps Desk lit for `view=journals`.
- **Header**: h1 `journals.title` "ജേണലുകൾ" (Malayalam in both languages, like the other desk titles), the description `journals.description`, and a stats line `journals.count` · `common.words` (web: the same `<p>` style as Works; phone: one `_Stat` pill with the calendar icon). No today/streak chips here.
- **Actions**: desktop `btn btn-outline` Export (Download icon, opens the export dialog with All journals) + `btn btn-primary` New journal (Plus). Phones: the floating button reads New journal (web: same fixed `btn-primary` FAB; Flutter: `FloatingActionButton.extended`). Export on phones: an outline button in the row under the tabs (like Trash's Empty trash button) when there is at least one journal. New journal creates kind `diary` and opens it straight away, with no type picker.
- **Tabs**: web pills fit at 1440. On phones the four tabs don't fit in Malayalam at any width (measured at 14px: രചനകൾ 63, പുസ്തകങ്ങൾ 99, ജേണലുകൾ 87, ചവറ്റുകുട്ട 67 px plus padding, against 272–342 px of track). So on phones the segments size to their own label (10px padding each side, 13px text below 360px, 14px above), the track scrolls sideways with no scrollbar, and the selected tab is always scrolled fully into view (Flutter: `SingleChildScrollView` + `Scrollable.ensureVisible`; web: the `scrollbar-none overflow-x-auto` row the type filter already uses, plus `scrollIntoView({inline:"nearest"})`). English fits at every width without scrolling. See `desk-journals-320-dark.png`.
- **Search**: `journals.search` (uses `matchesSearch`, so Manglish works). Shown when there are more than 3 journals. No sort select: journals are always listed newest started first.
- **Month lines**: `monthLine` of the started date, before the first card of each month, newest first. Web: a `col-span-full` row, Anek Malayalam 15px semibold `text-muted` and a `border-line` hairline filling the rest. Flutter: the same as a `SliverToBoxAdapter` between grid sections. While searching, month lines stay (only the months with matches).
- **Card** (`bg-surface border border-line rounded-2xl p-4`, phone radius `LitmaRadius.lg`):
  - Top left: the **calendar block**, 48 px wide, `border-line` 1px, radius 10px, `bg-surface`. Top band `bg-accent-soft text-accent` 11px semibold short month (5.3:1 light, 7.4:1 dark), the day number in Inter 22px bold `text-ink`, the short weekday 10.5px `text-muted`. Small surface, so the accent-soft band is allowed (like the Pinned badge).
  - Right of the block: the title, bold 16px, 2 lines at most. **Untitled** (title empty, still the started date in any form the app writes, or an old default such as "പുതിയ ജേണൽ"/"പുതിയ ഡയറി"): show the writer's **first line of text** in the same bold style, skipping the title block and the dateline (the `AUTO_FILLED` blocks). The text under it then continues after that line, so it never repeats. A journal with no text at all (old data only, since the keep rule removes such ones) shows `journals.nothingYet` in `text-muted` instead.
  - Text: Noto Serif Malayalam 13.5px `text-muted`, 3 lines.
  - Bottom right: `journals.edited` "തിരുത്തിയത് 27 നവം", only when edited on another day. Phones: word count bottom left in the same row. Desktop: word count under the card (like Works), and the hover actions there: Move to trash only (no Duplicate; Pin: see Questions). Phones: long-press sheet and swipe to trash, as on Works.
  - Grid: desktop 4 columns (`minmax(250px,1fr)`, gap 24px), cards a fixed 208px tall so rows line up. Phones: **one column** (not the 2-column Works grid): the block plus a title needs the width, and the list reads like a diary.
- **Loading**: skeleton shaped like the cards: a month-line bar (110 × 14) and 4 (phone) / 8 (desktop) cards with a 48 × 66 block bone, two title bones and two text bones. Web: a `JournalsSkeleton` in `components/ui/Skeleton.tsx`; Flutter: a `SkeletonCard` variant with the block. Stats line: the existing `skeleton h-4 w-48` bar.
- **Empty**: today's calendar block drawn with a dashed `--line-strong` edge (shows the date the first journal will get), `journals.empty.title` "Start your journal", `journals.empty.body`, and the New journal button (phone: centred like `_Empty`, the block in place of the feather tile; desktop: left-aligned section like "Start your first work"). No FAB, no search, no Export while empty.
- **No matches** for a search: `journals.noMatch` in `text-muted`, like Works.
- **Offline**: nothing new. The list comes from the device copy; New journal works offline (`uuid()`); the existing `OfflinePill`/`OfflineStatus` covers it.

### 2. Editor title bar for a journal
Where: web `Workspace.tsx` header (only when `initial.kind === "diary"`); Flutter `editor_screen.dart` app bar.
- Layout: `[←] [‹] [title + line] [›] …`. ‹ opens the journal started just before this one, › the one started just after (by `created_at`, not in trash). They sit right next to the title: on desktop the title block takes only its own width (`field-sizing: content` on the input, capped at `max-w-xl`), so › is beside the title, not pushed to the far side (`editor-journal-1440-light.png`).
- Buttons: desktop `btn btn-ghost` 32 × 32 with ChevronLeft/Right 18; phones 44 × 44 with 22px chevrons. Tooltip and `aria-label`: `journals.prev` / `journals.next` with that journal's short date ("Previous journal, 24 നവം"). Before leaving, flush the saver (as Back does) so nothing is lost; the pristine rule still applies to the one being left.
- **At the ends**: the button stays in place (nothing jumps), `disabled` + `aria-disabled`, `--disabled-ink` at 55% (disabled controls are exempt from contrast), tooltip `journals.first` / `journals.latest` (`editor-journal-latest-*.png`). With only one journal both are disabled. Disabled until the neighbours are known (no spinner).
- Line under the title: desktop `ജേണൽ` (`text-highlight` semibold, as now) · `journals.started` "Started 26 നവം · Edited 27 നവം" · the save text. Phones (space is short): `"26 നവം · " + journals.edited` (the started date without its label, because the ‹ › around it make it read as the journal's date), 12px, 11.5px below 360px; while saving or offline the save text takes this line's place, as the phone save line already does.
- Phones below 360px: the AI header button is left out for journals (AI is still in More); otherwise the title gets only 136px at 320 (checked in `editor-journal-320-dark.png`).
- Share is hidden for journals in every place: the desktop Share menu button, the phone More sheet's Share section and Reader tile, Flutter's share tile. The Export button opens the export dialog/sheet instead of the menu.

### 3. Export (one dialog, two entry points)
Where: web a new `components/editor/JournalExport.tsx` (dialog on tablet and up, `Sheet` on phones), opened from the editor's Export button / phone More → Export (journal), and from the desk's Export button. Flutter: `showJournalExportSheet` in `lib/editor/export.dart` (or a new `journal_export.dart`), from the tools sheet's Export tile and the desk.
- Shell: `.scrim` + `.dialog`, 480px wide, `rounded-xl p-6`, Sheet-style header (brand-mark dot + 15px semibold title + 44px close), focus trapped (`useModalFocus`), Esc closes. Phones: bottom sheet (`Sheet`, grabber), the content scrolls and **the Export button sticks to the bottom** above a hairline, so it is always reachable at 320.
- Sections with tint dots (as in `AIPanel`): **Which journals** (violet) · **Started between** (sky) · **Format** (coral).
  - Which: desktop radio cards (`border-line-strong`, chosen one `border-accent bg-accent-soft`), hint lines under each: This journal shows `shortDate · title`; All journals shows `export.allHint`. Phones: a segmented switcher (This journal | All journals) with the hint under it, so it fits at 320. Opened from the desk: no Which section (All journals only); the hint goes beside the Dates heading.
  - Dates (only for All journals): From / To fields, defaulting to the first journal's start date and today. Desktop: two columns with a calendar icon; phones ≥ 360: two columns, no icon, 16px text; below 360: label beside the field, one under the other. Web: `<input type="date">` inside `.field` (the browser's own picker; no new dependency). Flutter: `showDatePicker`. Under them `export.inRange` (live count); with none, `export.none` in `text-danger` semibold and Export disabled.
  - Format: desktop two radio cards: PDF ("Print-ready pages") and Word (.docx) ("Edit in Word or Google Docs"). Phones: a PDF | Word switcher with the chosen hint under it. Default PDF; remember the last choice per device (`litma:journal-export`).
  - Under them: a Lock icon line `export.private`, which also explains why there's no Share.
  - Buttons: desktop Cancel (`btn-ghost`) + Export (`btn-primary`, Download icon); phones one full-width 50px `btn-primary`.
- **Working**: Export disabled with a small `ink-spinner` in it, a 6px progress bar (`bg-subtle` track, `bg-accent` fill) and `export.working` "Making your file… 5 of 8" in a polite live region. The dialog stays open; Close/Esc cancels.
- **Error**: `bg-danger-soft text-danger` box with AlertCircle and `export.error`; the button becomes `export.retry`.
- **Offline**: This journal works from the device copy. All journals: if some journals in the range aren't on the device, an amber box (`bg-highlight-soft text-highlight`) `export.notOnDevice` and Export still makes a file of the ones that are here.
- **Dark-mode fix needed**: the switcher track `--subtle` (#1f1f23) disappears on the dark dialog (#202027, 1.14:1). Add a token to `theme.css`: `--dialog-well` (light `#edecf3`, dark `#141417`) and use it for switcher tracks on dialogs and sheets (mockups use it). Then `npm run tokens && npm run mobile:assets`.
- Output: one file, oldest first, a contents page listing each journal's date line and title; each journal starts on a new page.

### Strings (new keys; en / ml)
- `desk.tabs.journals`: Journals / ജേണലുകൾ
- `journals.title`: ജേണലുകൾ / ജേണലുകൾ
- `journals.description`: Your days, in your own words. The newest is first. / നിങ്ങളുടെ ദിവസങ്ങൾ, നിങ്ങളുടെ വാക്കുകളിൽ. പുതിയത് ആദ്യം.
- `journals.count_one` / `_other`: {count} journal / {count} journals · {count} ജേണൽ / {count} ജേണലുകൾ
- `journals.new`: New journal / പുതിയ ജേണൽ
- `journals.export`: Export / എക്സ്പോർട്ട്
- `journals.search`: Search journals / ജേണലുകളിൽ തിരയുക
- `journals.noMatch`: No journals match “{q}”. / “{q}” എന്നതിനോടു ചേരുന്ന ജേണലുകളില്ല.
- `journals.empty.title`: Start your journal / ജേണൽ എഴുതിത്തുടങ്ങാം
- `journals.empty.body`: Write a few lines about today. Each journal keeps the date you started it. / ഇന്നത്തെ ദിവസത്തെക്കുറിച്ച് കുറച്ചു വരികൾ എഴുതൂ. തുടങ്ങിയ തീയതി ഓരോ ജേണലിലും ഉണ്ടാകും.
- `journals.nothingYet`: Nothing written yet / ഒന്നും എഴുതിയിട്ടില്ല
- `journals.started`: Started {date} / തുടങ്ങിയത് {date}
- `journals.edited`: Edited {date} / തിരുത്തിയത് {date}
- `journals.prev`: Previous journal, {date} / മുമ്പത്തെ ജേണൽ, {date}
- `journals.next`: Next journal, {date} / അടുത്ത ജേണൽ, {date}
- `journals.first`: This is your first journal / ഇതാണ് ആദ്യത്തെ ജേണൽ
- `journals.latest`: This is your latest journal / ഇതാണ് ഏറ്റവും പുതിയ ജേണൽ
- `journals.exportDialog.title`: Export journals / ജേണൽ എക്സ്പോർട്ട്
- `…which`: Which journals / ഏതു ജേണൽ · `…this`: This journal / ഈ ജേണൽ · `…all`: All journals / എല്ലാ ജേണലുകളും
- `…allHint`: One file, oldest first, with a contents page / ഒറ്റ ഫയൽ, പഴയത് ആദ്യം, ഉള്ളടക്കപ്പേജോടെ
- `…dates`: Started between / തുടങ്ങിയ തീയതി · `…from`: From / മുതൽ · `…to`: To / വരെ
- `…inRange_one/_other`: {count} journal in these dates / {count} journals in these dates · ഈ ദിവസങ്ങളിൽ {count} ജേണൽ / ഈ ദിവസങ്ങളിൽ {count} ജേണലുകൾ
- `…none`: No journals were started between these dates. / ഈ ദിവസങ്ങൾക്കിടയിൽ തുടങ്ങിയ ജേണലുകളില്ല.
- `…format`: Format / ഫോർമാറ്റ് · `…pdfHint`: Print-ready pages / അച്ചടിക്കാൻ പാകത്തിലുള്ള പേജുകൾ · `…word`: Word (.docx) · `…wordHint`: Edit in Word or Google Docs / Word-ലോ Google Docs-ലോ തിരുത്താം
- `…button`: Export / എക്സ്പോർട്ട് ചെയ്യുക
- `…working`: Making your file… {n} of {total} / ഫയൽ തയ്യാറാക്കുന്നു… {total}-ൽ {n}
- `…error`: Couldn't make the file. Check your connection and try again. / ഫയൽ തയ്യാറാക്കാനായില്ല. ഇന്റർനെറ്റ് കണക്ഷൻ നോക്കി വീണ്ടും ശ്രമിക്കുക. (button: `common.retry`)
- `…notOnDevice`: {count} journals aren't on this device yet. Connect to the internet to include them. / {count} ജേണലുകൾ ഇനിയും ഈ ഉപകരണത്തിലില്ല. അവയും ചേർക്കാൻ ഇന്റർനെറ്റിൽ കണക്റ്റ് ചെയ്യുക.
- `…private`: Journals stay private to you. They can't be shared by link. / ജേണലുകൾ നിങ്ങൾക്കു മാത്രമുള്ളതാണ്. ലിങ്ക് വഴി പങ്കിടാനാവില്ല.
- Note: the editor header's own strings ("All changes saved", "Export", "Back to desk") are still English inline in `Workspace.tsx`; the new journal strings go through i18n anyway.

### Checks for the build (I'll test these in the review)
- 44px targets on phones (‹ ›, close, tabs, FAB, switchers); Malayalam never cut at 320 (tabs scroll, title and the line under it end in an ellipsis, never a half letter); dark dialogs don't disappear (`.dialog`, `--dialog-well`); nothing jumps when ‹ › go disabled or when the export count updates (fixed-height line).
- Fairness: the sample journals in the mockups (and any for help pictures) take everyday life from different families side by side: ഉമ്മ's പത്തിരി, അമ്മച്ചി's അപ്പം, അച്ഛൻ in the paddy field, ഇക്ക's wedding, അപ്പാപ്പൻ at the beach, a bus stop with ഫാത്തിമ ടീച്ചർ and ജോസഫ് ചേട്ടൻ. Use the same mix in help pictures.

## Build (web-dev)
- 2026-11-28 Foundation pushed: `b609818` (shared `forms.ts` journal dates + `isUntitledJournal` + `keepOnClose({ createdAt })`, en/ml strings under `journals.*` and `desk.tabs.journals`, `--dialog-well` token, phone assets regenerated). Cases: `scripts/journal-lab/journal-check.ts` (`TZ=Asia/Kolkata node --experimental-transform-types scripts/journal-lab/journal-check.ts`); `isUntitledJournal` strips ZWNJ/ZWJ and collapses spaces before comparing, and without `createdAt` only empty and old defaults count.

## Build (flutter-dev)

## Design review (designer)

## Tests (tester)

## Verification (verifier)
