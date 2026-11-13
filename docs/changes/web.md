# Web changes (apps/web)

The website, and the shared code the desktop app bundles. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- The 2026-11-07 Manglish "finish on leaving the word" rule passes in Chromium with iPhone 13 and
  Pixel 7 emulation (touch, phone layout); still try it in real iOS Safari, where the system
  keyboard may compose words differently.

## 2026-11-13: Sign-in messages and help for blocks and the check

- `lib/auth.tsx` `authMessage`: banned, leaked password, captcha; `app/auth/callback` runs `error_description` through it. Help guides `security-check`, `blocked`.

## 2026-11-13: Delete account, admin block/delete, CAPTCHA, CSP

- `components/settings/DeleteAccount.tsx` (Settings), `lib/offline.ts` `forgetAccount`, login notice `?deleted=1`.
- `components/admin/AccountActions.tsx` in `UserDetail.tsx`; `lib/admin.ts` `block`/`unblock`/`remove`, `BLOCK_FOREVER`; Blocked badge in `WriterName`.
- `app/captcha/` page + `components/auth/Captcha.tsx` (`useCaptcha`) used by login (password and email link), signup, forgot-password.
- `public/.htaccess`: HSTS, CSP, frame rules, Permissions-Policy. Add any new outside host to the CSP.
- Help `11-account.md`: Delete your account; credits: dictionary files share-alike.

## 2026-11-13: Credits in one place only (owner)

- Removed source names from everywhere but the help section Credits and licences and `THIRD_PARTY_NOTICES.md`: the "Data: … from Olam. Opposites via Datamuse." line under dictionary entries (`DictionaryView.tsx`), the Olam link on the home page (`app/page.tsx`) and in `HowItWorks.tsx`, "Google Input Tools" in the home features and the Manglish panel (now "Online suggestions"), the mlmorph note in `03-editor.md`, Olam in `06-dictionary.md`, `rhyme.source` (en, ml; phone uses the same string). Terms → Dictionary, spelling and fonts now links to the credits section. README trimmed the same way. Privacy still names Google Input Tools as a service that sees data (a disclosure, not a credit).

## 2026-11-13: Credits and licences

- `components/UpdateNotice.tsx` `AboutLitma`: "Credits and licences" link beside Privacy and Terms → `/help/?a=credits` (new tab; getlitma.in on desktop). String `legal.credits` (en, ml).
- `content/help/11-account.md`: new `## Credits and licences {#credits}` (words and spelling, fonts, software); `03-editor.md` spelling note credits mlmorph. `THIRD_PARTY_NOTICES.md` at the repo root. README updated.

## 2026-11-09: Malayalam spelling engine (mlmorph) on the server

- New Edge Function `supabase/functions/litma-spell/index.ts` with `packages/shared/src/mlmorph.ts` (TypeScript port of SMC's mlmorph: SFST transducer lookup, analysis weights, normaliser, foreign-word detector, the twelve suggestion strategies, common-mistakes list). Data built by `scripts/build-mlmorph.mjs` (pinned mlmorph 1.4.3 wheel, sha256; SFST `malayalam.a` → `mlmorph.bin.gz` 7.6 MB + `mistakes.json`; gitignored). Checked: identical accept/reject to Python mlmorph on 2,149 words, analyses identical on 932/934; ~17 µs a word; under Deno cold start 0.14 s (data load), then ~12 ms a request; 1,000 misspelled words in 0.16 s; ~140 MB RSS.
- `packages/shared/src/spell.ts`: kinds `suspect` and `punct`; `check()` takes `engine` (one request per block, a word the dictionary or the writer knows is never a suspect) and `punctuation` (`packages/shared/src/punctuation.ts`: space before a mark, none after, two spaces, two commas). Synced to `_shared`.
- Web: `lib/spell-engine.ts` (batching, cache, 12 s timeout, 60 s pause after a failure, returns null so the editor falls back), `lib/spell.ts` (`punct` pref, default on; spelling marks default on), `extensions/writing-aids.ts` + `styles/editor.scss` (`.spell-suspect` amber wavy, `.spell-punct` soft background), `CheckPanel.tsx` (labels, spacing switch, Fix all covers spacing). MCP `check_spelling` calls the engine with the service key and falls back.
- Deploy: `.github/workflows/deploy.yml` builds the data and deploys `litma-spell --use-docker` as the last step with `continue-on-error`; `supabase/config.toml` (`verify_jwt`, `static_files`). Help `03-editor.md#spelling`, Privacy (Supabase line), Terms (credits).
- Playwright against a mocked Supabase forwarding to the real engine under Deno: suspects (പോയീ, ഇരുന്നൂ, അവൻറെ, ഹ്രുദയം, സംസ്താനം), spacing and a listed mistake marked, a name (ജഗത്ത്) not; fix from the list and Fix all work; a typo typed later is checked; with the engine returning 503 the editor shows its own marks and no errors; local mode makes no engine requests. Unverified: the real deploy (Docker bundling with static files on CLI 3.0.0), behaviour on Supabase's runtime limits, and false alarms on large real texts (Olam's word lists weren't available in the sandbox).

## 2026-11-09: Grammar check works inside the Spelling and grammar panel

- Before: "Check grammar with AI" switched to the AI companion; without a key it only prepared a Claude hand-over (one more click, so it looked like nothing happened), and with a key the answer was plain text that couldn't be applied.
- Now `components/editor/GrammarCheck.tsx` (in `CheckPanel.tsx`): "Check the whole work" / "Check the selected text"; the text goes to the AI in parts of 3,500 characters (progress, Stop) with the new hidden action `grammarCheck` (`packages/shared/src/ai-prompts.ts`, synced to `supabase/functions/_shared`; JSON `[{wrong, right, why}]`, same rules: no style rewrites, dialect, names and dialogue left alone). Results are cards: mistake → correction, reason, Fix / Show / Ignore, Fix all. Each finding keeps the document position it was found at, and Fix replaces the occurrence nearest to it (`locate`), so a repeated word is fixed in the right place even after other edits; a finding whose text isn't in the work is set aside. Without a key (cloud) or with a key that has no credit: "Check with Claude" opens claude.ai with a request to send each fix with `suggest_edit` (kind replace + note), then points to the Assistant inbox. Local mode without a key: a note to add one. The AI panel skips hidden actions.
- `lib/spell.ts`: marking spelling in the text is now on by default (broken letters and common misspellings only; "not in the dictionary" stays off).
- Strings `check.ai.*` (en, ml). Help `content/help/03-editor.md#spelling` rewritten. Playwright against a mocked Supabase + AI: 3 cards and 1 set aside, Fix on the second "പോയീ" changed the second paragraph, Fix all fixed the rest, no-key shows the hand-over, the AI panel shows no "Grammar check" button. Unverified with a real provider (prompt quality in Malayalam). The litma-ai function needs the push (new action). Phone: still the old flow, noted in `apps/mobile/README.md`. Desktop: next Release.

## 2026-11-09: Editor rail grouped like the phone

- `components/editor/Workspace.tsx`: the desktop/tablet tool rail is grouped like the phone's More sheet: Write (Outline, Story World, Dictionary; tabs on the phone), Words (Saved, Rhymes, Spelling, Keyboard), Plan and assist (AI, Inbox, Goals), Page (Page & type, Typewriter), Review and share (Read aloud, History, Reader view). Closed: a line between groups; open: the group's name. The rail scrolls (`overflow-y-auto`) on short windows, where the last tools used to be cut off. New string `app.tools.groupWrite` (en, ml). Playwright at 1440×1100 and ×720 (dark). Desktop gets it with the next Release.

## 2026-11-09: Shared link shows every page, with the writer's name

- `app/read/page.tsx`: the shared reader lays the work out on its printed pages (`paginate(documentPrint(doc))`, like the PDF), removes pages whose flow has no text (an inserted page left empty), renumbers the folios 1, 2, 3 and shows "n pages"; pages shrink to the screen width with `zoom` (ResizeObserver). Before, it was one continuous sheet, so text after a page break read as if it weren't a page of its own (the owner thought only the first page showed). Title and byline (avatar + pen name) above the pages.
- Byline: new migration `supabase/migrations/20261109140000_shared_author.sql`, `shared_author(p_share)` (security definer, `anon` + `authenticated`): pen name or display name and avatar, only for a work that is shared and not in the trash. `store.getSharedAuthor()`; until the migration runs, the reader uses the work's own author block. Checked in PGlite: shared → name, unshared/unknown → null, visitors still can't read `profiles`.
- Help guide `content/help/08-share-export.md` updated. Playwright with a mocked Supabase (the owner's poem plus an empty inserted page): desktop and iPhone 13 show pages 1–3 with the empty page dropped, byline shown, no sideways scroll. On phones the A4 pages are scaled down, so the text is small (pinch to zoom).

## 2026-11-09: Share switch in the editor showed "off" after turning it on

- `components/editor/Workspace.tsx` (`shareBody`): the checkbox handler read `e.target.checked` after `await store.setPublic(...)`, when React had already put the controlled box back, so it saved "public" but set the state to off (no tick, no link). The owner's work was saved public three times (Supabase logs: three PATCH 200 at 13:58 UTC; the row has `is_public = true` and a share link). Now the choice is read first and shown at once, the box is disabled while saving, and a failed save puts it back with a message. Unverified in a browser: sharing needs a signed-in cloud session.

## 2026-11-09: Editor Export/Share menus; Settings width

- `components/editor/Workspace.tsx`: the editor header is `relative z-50`, so the Export and Share menus sit above the toolbar and the tool rail (only the first item showed before). `Menu` keeps `onClose` in a ref and adds its outside-click listener once (cleared timer): it used to re-add it through `setTimeout` on every editor render, leaving stray listeners that closed the next menu as soon as it opened ("Export doesn't open after clicking outside"). The menu buttons carry `data-menu-button`. Playwright (dark, 1440 px): all six export items on top; reopen works three times after typing and outside clicks.
- `app/settings/page.tsx`: same width as the header (`max-w-6xl`), a section list on the left on wide screens (`SettingsNav`, follows the scroll; strings `settings.nav.*`), the settings column stays `max-w-3xl`. Section ids `language, help, goals, backup, ai, mcp, usage, about`, so `/settings/#mcp` (linked from the AI panel) now scrolls to MCP. Phones unchanged (one column, no list).
- Desktop gets both with the next Release.

## 2026-11-09: Same top spacing on every app page

- `app/profile/page.tsx`, `app/settings/page.tsx`, `app/goals/page.tsx`, `components/admin/AdminDashboard.tsx` (and the Profile/Goals loading screens): `pt-8 sm:pt-12` like the desk and dictionary. Measured header-to-heading gap: 48 px desktop, 32 px iPhone 13 on desk, dictionary, goals, settings, admin (Profile needs sign-in; same classes).

## 2026-11-09: Page width matches the header

- `app/goals/page.tsx`, `app/profile/page.tsx` (`max-w-5xl` → `max-w-6xl`) and `components/admin/AdminDashboard.tsx` (`max-w-7xl md:px-8` → `max-w-6xl px-5`): the content now lines up with `AppHeader` (logo to avatar), like the desk and dictionary. Goals measured in Playwright at 1332 px (heading and content edges equal the header's); Profile needs sign-in, so it was not seen in the local build. Settings keeps its narrower reading column. Desktop gets it with the next Release.

## 2026-11-09: Spacing pass (heroes, Goals on phones, Profile loading)

- `components/landing/LandingChrome.tsx`: `ColourField fade` masks the colour field towards the bottom, for heroes whose content continues on the same background. Used by the community hero (`components/community/Community.tsx`, also `pt-6 md:pt-8` above the categories and search) and the help topic/guide hero (`components/help/HelpCenter.tsx`, replacing the gradient overlay from earlier today). The home, download and auth heroes keep the approved look (they end where a new band starts).
- `app/goals/page.tsx`: the two card grids are `grid-cols-[minmax(0,1fr)]` on phones; before, a card's content widened the page to 656 px on a 390 px phone (sideways scrolling).
- `app/profile/page.tsx`: the loading cards get the page's side margins (they touched the screen edges on phones).
- Checked with Playwright at 1440 px and iPhone 13: every public page, desk, books, trash, dictionary, profile, settings, goals, admin, editor, book editor; no page wider than the screen. Desktop app gets the Goals/Profile/community fixes with the next Release.

## 2026-11-09: Help pages: space under the hero

- `src/components/help/HelpCenter.tsx`: topic and guide pages start their content 2-3rem below the hero (`pt-8 md:pt-12`), and the hero's colour field fades into the page (a short gradient to `--mist`) instead of ending in a hard line. The "Still need help?" card has equal space above and below (`py-16 md:py-24`; the grids above it lost their `pb-20`), so it no longer touches the white section on the help home. Looked at in Playwright at 1600-1670 px (home, topic and guide pages). Desktop opens help in the browser, so no Release needed for this.

## 2026-11-09: Litma Community

- Pages: `src/app/community/page.tsx` (+ `layout.tsx`, public metadata) and `src/app/community/guidelines/` (LegalPage). Components in `src/components/community/`: `Community.tsx` (hero like the home page, sign-in card for visitors, category rail/chips, list, new thread, reports queue, legal strip), `ThreadView.tsx` (post, replies, likes, edit/delete, report, moderation menu, closed/removed banners, banned note), `Dialogs.tsx` (agree, report, moderate, ban), `bits.tsx` (`PostField` Manglish switch shared across the boxes via `litma:fieldMode:community`, `PostBody` with `nofollow ugc` links, `Dialog`).
- Data: `src/lib/community.ts` (Supabase tables/RPCs; localStorage `litma:community` in local mode, local writer is a moderator, ban is a no-op there).
- Links: `LandingChrome.tsx` nav (Community) and footer (Community, Guidelines); `AppHeader.tsx` avatar menu; Settings `CommunityCard` (`HelpLink.tsx`); `lib/seo.ts` sitemap; help guide `content/help/13-community.md` (`users` icon added to `HelpCenter.tsx`).
- Legal text: `app/terms/page.tsx` (#community, "The service"), `app/privacy/page.tsx` (#community, "How long we keep it").
- Checked: typecheck, local-mode build, Playwright (desktop 1360 px and iPhone 13): list, category filter, Manglish search, new thread with Manglish typing, agreement dialog (button disabled until ticked), reply, like, report, close with reason (reply box hidden, reports resolved), queue, delete own thread, guidelines anchor, no horizontal overflow on the phone (fixed a grid overflow). Unverified: the Supabase path in the browser (no reachable project from the sandbox), dark-mode writers (page is always light by design), real Malayalam fonts (Google Fonts blocked in the sandbox).

## 2026-11-09: getlitma.in upload says why it can't sign in

- `.github/workflows/deploy.yml`: before signing in, checks that ftp.getlitma.in answers on port 21 from GitHub (else: firewall/cPHulk, not the password). When sign-in fails, runs lftp once with `-d` and prints the server's replies (password masked), then says which it is: 530 refused login (password or full username like litma@getlitma.in), FTPS/TLS failure, or a session cut off (cPHulk/firewall). Unverified until the next deploy run; the sandbox can't reach getlitma.in.

## 2026-11-08: Read aloud: pitch, volume, word underline

- `src/lib/speech.ts`: `readAloud` takes `settings()` (voice, rate, pitch, volume) read before each sentence, so changes while reading apply from the next one; `onboundary` word events underline the spoken word (`wordLength` when the voice sends no length). Inline leaves now stay in the spoken text as a space, so sentence and word positions line up after a footnote or line break (they were shifted by one per leaf before).
- `src/extensions/writing-aids.ts`: `setReading` takes `ReadingRange` with an optional `word`; decoration `.reading-word` (underline in `--highlight`, `styles/editor.scss`).
- `components/editor/ReadAloudPanel.tsx`: Pitch (0.5–1.5) and Volume (10–100%) sliders beside Speed, kept per device (`litma:read-pitch`, `litma:read-volume`); stored values out of range fall back to the default. The voice picker was already there (shown with two or more voices).
- Strings `read.pitch`, `read.volume` (+ phone-only `read.voiceN`, `read.needsInternet`, `read.save*`), new `read.hint`; help guide `content/help/03-editor.md#read-aloud`.
- Checked: typecheck, local-mode build, Playwright with a stand-in Malayalam voice (word underline with and without boundary lengths, sentence-only voice, pitch/volume/speed reach the utterance, speed change mid-read, pause, go on, stop clears marks, no page errors). Unverified with real voices (Edge's Microsoft Malayalam voices, Android Chrome).

## 2026-11-08: Phone More sheet in groups

- `src/components/editor/Workspace.tsx` More sheet: tiles split under Words (Saved, Rhymes, Check, Keyboard), Plan and assist (AI, Inbox with badge, Goals), Page (Page, Pages, Find, Typewriter, Focus), Review and share (Listen, History, Reader), then Export and Share as before. `tsc` passes; not looked at in a browser.

## 2026-11-08: Pinned work on the desk

- `lib/pin.ts` (`getPinned`, `setPinned`, `usePinned`, `PIN_EVENT`; profile `preferences.pinnedWork`, local `litma:pinned`). Desk: pinned first in Works, Pinned badge, accent border, Pin/Unpin button in each card's actions (`desk.pin.*` strings). Playwright: pin, move the pin, reload, unpin, phone layout.

## 2026-11-08: Rhymes, spelling, read aloud, goals and timer, reminders, statistics, backup

- Shared (synced to `_shared`): `rhyme.ts`, `spell.ts`, `goals.ts`; `dict.ts` exports `mlShardName`; `forms.ts` `DocSettings.deadline`; `ai-prompts.ts` `grammar` action.
- Build: `scripts/build-rhymes.mjs` (called by `build-dictionary.mjs`) writes `dict/rhyme/*` and `dict/words/*`.
- Editor (`Workspace.tsx`): panels Rhymes (`RhymePanel`), Spelling and grammar (`CheckPanel`, starts the AI panel with `grammar` via `AIPanel start`), Read aloud (`ReadAloudPanel`, `lib/speech.ts`), Goal and timer (`GoalPanel`, `TimerChip`); `extensions/writing-aids.ts` (spell decorations per block, read-aloud highlight); minutes per work logged on save (`activeMinutes`, `store.logWriting`). The work's word goal moved from Page & type to Goal and timer.
- Pages: `/goals/` (new, noindex, robots), Dictionary `?view=rhyme`, Settings Goals card + Backup (`components/settings/BackupSettings.tsx`), profile heatmap 13 weeks (local days), desk streak uses rest days and links to Goals; avatar menu "Goals and statistics".
- Root layout: `Reminders` (reminder card + notification, timer end chime), `BackupNudge` (daily Drive card; desktop folder backup).
- Data: `store.logWriting`, `wordsByDay` (minutes, hours), `workDays`; local mode keeps days in localStorage; outbox merges `log_writing` per day/work/hour and falls back to `add_words_today` before the migration.
- Backup: `lib/backup.ts` (dynamic import, keeps docx out of the first load), `lib/backup-state.ts`, `lib/zip.ts`, `lib/drive.ts` (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, deploy.yml passes `vars.GOOGLE_CLIENT_ID`).
- Admin: ranges 7/30/90 (`AdminDashboard.tsx`, `litma-admin` clamps to 90).
- Unverified: cloud mode against the migrated database; Drive upload (needs the client id); notification permission flows in real browsers; Edge's Malayalam voices.

## 2026-11-08: Manglish engine follows how writers type

- `packages/shared/src/manglish.ts` (synced to `supabase/functions/_shared`): lowercase words now
  use natural rules on top of the Mozhi scheme. d between vowels → ട (`_d` keeps ദ), nd before r
  → ന്ദ, final u after ട / ണ്ട / സ്സ → ്, `dd` → ദ്ദ, and `COMMON` (about 45 everyday words:
  ആണ്, ഞാൻ, അവൾ, കഥ, പറയാം…). Capitals still spell strictly. `manglishWord(w, { natural, halfU })`.
- New `manglishCandidates(word)`: offline suggestion list (റ, ള, ണ, ഏ/ഓ, ദ, ു, strict). Used as
  the editor's first list (`extensions/manglish.ts`) and the offline answer in `lib/functions.ts`.
- Checked: typecheck, local-mode build, Playwright typing `ente naadu nammude kadha veedu undu
  manassu kadal` gives എന്റെ നാട് നമ്മുടെ കഥ വീട് ഉണ്ട് മനസ്സ് കടൽ; offline list for `parayu`.
- Trade-off: Sanskrit words with ദ between vowels (udayam, vedana, hridayam) now come second in
  the list; names typed in ScriptField follow the same rules.
- Help guide `02-typing.md` and README updated (new "Manglish typing" section).

## 2026-11-08: Space above the help topic chips

- `components/help/HelpCenter.tsx` `TopicNav`: the phone/tablet chip row (`lg:hidden`) gets
  `mt-6` so it no longer sits on the bottom edge of the gradient header. The wide-screen side
  list is unchanged. Unverified on a device; desktop app gets it with the next Release.

## 2026-11-08: Admin link in the avatar menu

- `components/AppHeader.tsx`: **Admin dashboard** item for admins; `lib/admin.ts` `checkCached()`
  (sessionStorage `litma:admin:<user id>`) and `ADMIN_ON_THIS_APP` (false in the desktop build);
  `components/UsageSettings.tsx` uses it too. String `nav.admin`. Unverified with a real admin
  account (cloud only).

## 2026-11-08: Manglish in search

- `packages/shared/src/search.ts` (see cross-platform). `app/desk/page.tsx` filter,
  `components/SavedWords.tsx`, `components/Nattarivu.tsx` filter use `matchesSearch`;
  `FindBar` in `components/editor/Workspace.tsx` shows **In Malayalam** chips from
  `manglishMatches` (click puts the word in the box). Checked in local mode: `mazha` on the desk,
  `kada` → കടൽ chips and 3 matches. Help guides mention it.

## 2026-11-07 (evening): publisher line on covers; help site

- `components/book/Cover.tsx`: `pub()` renders the publisher as its own `Movable id="publisher"` in
  the art, solid, type, minimal and kasavu layouts (photo layout still has none, as before). Over
  artwork (`c.image || c.art`) it gets a pill of `c.bg` at 82 % with `c.fg` text. Author moves up by
  the publisher's height only when a publisher is set. The type layout's subtitle is its own line.
  Strings `cover.move.publisher`, `cover.part.publisher` (en, ml). Checked: all ten presets in the
  print view; dragging the publisher leaves the author in place.
- Help site: `app/help/page.tsx` (server component reads `content/help/*.md` at build through
  `lib/help.ts`, markdown-it), `components/help/HelpCenter.tsx` (home, topic and guide views,
  search with `/`, topic chips on phones), `app/help/help.css` (`.help-prose`: lime step circles,
  framed pictures, phone frames for `phone-*`, callouts), `app/help/layout.tsx` metadata,
  `PUBLIC_PAGES` in `lib/seo.ts`, Help link in `LandingNav` and `LandingFooter`.
  `components/HelpLink.tsx`: `useHelpHref()` (site link on the desktop app) and `HelpCard` in
  Settings; account menu item in `AppHeader`. New dependency `markdown-it` (+ types).
- Screenshots were made in local mode with Playwright and the app's own fonts; phone pictures come
  from the `ci/phone-screens` branch. Unverified: sharing, sign-in and offline screens (cloud-only)
  are described in words without pictures; the dictionary lookup picture is the phone's (no dict
  data in the sandbox).


## 2026-11-07: print view starts at the top of the page; no changelog links

- `styles/editor.scss` `@media print`: the print view's wrapper kept its on-screen `py-8`, so
  every sheet printed 32 px low (white strip above the cover, each sheet spilling: 7 sheets made 9
  PDF pages). Print now zeroes the wrapper's padding and margins and drops the page break after the
  last sheet (`.pp-doc`, added in `app/print/page.tsx`). Checked with Playwright's PDF in local
  mode: cover at 0 px, 7 sheets = 7 pages.
- `components/UpdateNotice.tsx`: removed the "What's new" link to `CHANGELOG.md` (owner's rule: no
  change lists for writers); `update.whatsNew` string removed.
- Owner's book നായകൻ had `www.jayageetham.com/litma` saved in its back-cover Website field (from an
  old sample); changed to `getlitma.in` with SQL on his own row. Samples already use getlitma.in.

## 2026-11-07: email links verified on the site

- `app/auth/callback/page.tsx`: `token_hash` + `type` → `verifyOtp` (any browser); `code` still
  exchanged for Google sign-in and older emails. `lib/auth.tsx` `authMessage`: plain text for
  code-verifier and expired-link errors. `app/forgot-password/page.tsx` uses `authRedirect`.

## 2026-11-07: shared strings in the book screen (PR #6)

- `app/book/page.tsx`: Book details (Publisher, Year, Edition, ISBN, Page & type, page sizes,
  body font, size, line spacing, margins, the two checkboxes) and the cover designer (Front/Back
  cover, colour labels, Title font, Blurb, About the author, Price, the Book details note) use
  `bookDetails.*` and `cover.*` strings from `packages/i18n` instead of English text.
- `supabase/functions/litma-track`: platform `ios`/`android` sets os, device (from `ctx.device`)
  and browser "Litma app".
- Checked: typecheck, local-mode build, Playwright in the desktop app (book page labels).

## 2026-11-07: in-app confirm dialogs (PR #4)

- `components/story/StoryWorld.tsx` card delete and `components/editor/Panels.tsx` version
  restore use `useConfirm()`.

## 2026-11-07: empty line is a section break

- `styles/editor.scss` `.tpl-novel, .tpl-story`: `p.is-empty` (Placeholder marks every empty
  line in the editor) and `p:empty` (reader, print, books) and the paragraph after either get
  `text-indent: 0`.
- `lib/export.ts` (Word): first-line indent only for a non-empty paragraph that follows a
  non-empty paragraph (was every prose paragraph, even after headings).
- Checked with Playwright: one 0, two 1.6em, empty 0, three 0, four 1.6em, empty lines 0.

## 2026-11-07: inbox, keyboard strip, Manglish

- `components/editor/Panels.tsx` `InboxPanel`: Copy button (keeps the suggestion), "Copied" state,
  `select-text` on the content, strings from i18n.
- `components/editor/Toolbar.tsx` `MobileFormatStrip`: optional `onInbox` / `inboxCount` (inbox
  button with the waiting count); the scroll row's position is kept in the module variable
  `stripScroll` and restored on mount. `Workspace.tsx` passes them (cloud mode only).
- `components/editor/ManglishPopup.tsx` (docked, phones): every candidate in a sideways-scrolling
  row; a new word starts the row at the start, the chosen spelling is kept in view.
  `STRIP_SIZE` removed from `extensions/manglish.ts`.
- `extensions/manglish.ts`: `ComposeState.typed` (word typed just now); `appendTransaction`
  converts that word when a selection-only change moves the cursor off it; `blur` commits it.
- Checked: `npm run typecheck`, local-mode `npm run build`, Playwright (word typed mid-line
  converts after pressing End).
