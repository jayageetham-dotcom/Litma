# Web changes (apps/web)

The website, and the shared code the desktop app bundles. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- The 2026-11-07 Manglish "finish on leaving the word" rule passes in Chromium with iPhone 13 and
  Pixel 7 emulation (touch, phone layout); still try it in real iOS Safari, where the system
  keyboard may compose words differently.


## 2026-11-26: Rhymes from the words people write (branch `better-rhymes`)

- Rhyme files gain the common forms (`scripts/build-rhymes.mjs`, deploy order in `deploy.yml`, `build-dictionary.mjs` keeps the word list). `lib/dictionary.ts` exports `headFor`; the Dictionary's പ്രാസം tab opens a form's base word. See cross-platform.md.

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

## 2026-11-24: Desk download card on phones offers the phone app

- `DesktopDownload` `variant="card"` (bottom of the desk): on iPhone/iPad it shows one row "Litma for iPhone & iPad · On the App Store" (same row style as Mac/Windows, opens the App Store in a new tab), on Android "Litma for Android · On Google Play" with the Soon badge until `STORE_LINKS.android`; phone body `download.deskBodyPhone`, hints `download.iosRowHint` / `androidRowHint` (en + ml); "All downloads" names the other platforms. Computers unchanged.
- Checked with Playwright: iPhone light/dark, 320 px, Android, Mac (no overflow).

## 2026-11-24: "Suggest" for words not in the dictionary

- `SpellSuggest.tsx` (card and phone strip): a mark of kind `unknown` with no fixes gets **Suggest** (`check.suggest`, `check.suggestHint`) before Ignore/Keep; it asks `similarWords()` (`lib/manglish-words.ts` → `ranker.similar`, sound-alike known words from `/dict/manglish-words.txt`) and shows them as ordinary fixes; none found shows `check.noSimilar`. Keyboard order: fixes, Suggest, Ignore, Keep.
- `packages/shared/src/manglish-rank.ts`: `similar(word, max)` (same outline, skeleton distance ≤ 1.5, edit distance ≤ 2, rank by fit and use).
- Playwright (local mode with a tiny fake `dict/words`): കര്യം marked, Suggest → കാര്യം first, picked → text fixed; desktop card and phone strip at 320/375/390 px (no sideways page scroll; on 320 the "Not in the dictionary" label ends in an ellipsis so Suggest/Ignore/Keep fit). Desk page checked at 320/390 px: no overflow.

## 2026-11-24: No "on its way" for apps that are out (iPhone/iPad, Windows, Mac)

- `/download/`: on iPhone/Android the hero says "made for your phone" (`download.heroBodyMobile`); a store that lists Litma shows `download.mobileLive` instead of `mobileSoon` (iPhone live; Android keeps "on its way" until `STORE_LINKS.android`); `download.iosReq` now "on the App Store".
- `DesktopDownload` (home and desk cards): Windows falls back to the Microsoft Store listing when latest.json has no `.exe`.
- `lib/release.ts` `downloadsFor`: Mac and Windows fall back to the public releases page (signed installers) when latest.json names no file, so they never show "The first release is on its way".
- Help `10-apps.md` note: iPhone/iPad on the App Store, Android still coming.
- Checked with Playwright (iPhone, Android, Mac, Windows user agents; also with a latest.json naming no files): only the Android card says "Coming soon".

## 2026-11-24: Ranked offline Manglish suggestions

- `packages/shared/src/manglish-rank.ts` (new, synced to `supabase/functions/_shared`): `createManglishRanker` / `buildManglishRanker` (idle slices), `suggest(word, max)`, `lookup`, `scriptKey`, `latinKeys`, `outline`. Weights in `RANK_WEIGHTS`.
- `apps/web/src/lib/manglish-words.ts` (new): fetches `/dict/manglish-words.txt` on the first Manglish word (kept by the service worker's runtime cache and the desktop's `kept()`), `offlineCandidates(word, OFFLINE_MAX=8)`; falls back to `manglishCandidates` until ready or on error.
- `extensions/manglish.ts` uses `offlineCandidates` for the instant list; `lib/functions.ts` offline fallback too; `ManglishPopup.tsx` appends offline spellings after Google's.
- Data: `scripts/build-manglish-words.mjs` (deploy job step + cache `.manglish-cache`); `apps/web/public/dict` stays uncommitted.
- Tested: typecheck, build (local mode), i18n:check, sync:shared; Playwright in local mode: "ente enthaanu vellam kerala chakkappazhakkuzhi sheri officer" → എന്റെ എന്താണ് വെള്ളം കേരള ചക്കപ്പഴക്കുഴി ശരി ഓഫിസർ. Not tried: iOS Safari, real slow phones (index build ~0.6 s on a laptop, in idle slices).

## 2026-11-22: Manglish list for screen readers; shortcuts list in Malayalam

- `src/components/editor/ManglishPopup.tsx`: option ids, `tabIndex=-1`, `lang="ml"`, number badges `aria-hidden`; the editor gets `aria-controls` (the listbox) and `aria-activedescendant` (the highlighted spelling) while a word is composed; `ManglishAnnounce` (always mounted, polite) says "അവൻ, 1 of 6" 400 ms after typing or arrowing stops (`manglish.announce`, en + ml). Phone strip: the keep-English button is no longer inside the listbox.
- New `src/components/editor/aria-owner.ts` (`ownAttr`, `domId`): the Manglish list (`mg-…`) and the spelling card (`spell-…`) only remove editor attributes that carry their own prefix, so one never clears the other (`SpellSuggest.tsx` uses it too).
- `src/components/editor/ShortcutsDialog.tsx`: every string in i18n (`shortcuts.*`, en + ml), "1 – 6" for Manglish, Page Up/Down row, new Spelling group (↓ ↑ or Alt + ↓, Enter, Esc). Dialog: `aria-labelledby` its title, focus moves to Close on open, Tab and Shift+Tab stay inside, Esc closes, focus goes back to the editor.
- Checked: typecheck, i18n:check, local-mode build; Playwright: Manglish "avan" → activedescendant on അവൻ (lang ml) and the announcement, ↓ moves both, Space commits and clears them; spelling card still sets and clears its own; shortcuts dialog in en and ml (title, groups, focus on Close, Tab trap, Esc returns focus to the editor); the earlier spelling-card cases again.
- Still English inline nearby: the editor's Focus mode button (`Workspace.tsx` title/aria-label).

## 2026-11-22: Spelling suggestions from the keyboard; accessibility

The owner found the spelling card couldn't be used from the keyboard (arrows moved the cursor, the first row only looked selected).

- `src/components/editor/SpellSuggest.tsx`: new `useSpellKeys` (document keydown in capture, focus stays in the editor like the Manglish list). ↓/↑ move through spellings, then Ignore and Keep, wrapping; Enter uses the highlighted row; Esc closes; Alt+↓ always opens. Nothing is highlighted until an arrow is pressed, so Enter still makes a new line. If the cursor reached the word by arrow keys (a nav key within 400 ms), plain ↑/↓ keep moving the cursor and only Alt+↓ opens the list, so the card never traps a writer. Highlighted row: accent outline (the best spelling keeps its soft fill).
- ARIA: `role="dialog"` removed (focus never moved there); one `listbox` labelled by the card's heading, with two `group`s (spellings; Ignore/Keep); options have ids, `tabIndex=-1`, `aria-selected` follows the highlight (was fixed on row 0); the editor gets `aria-controls` and `aria-activedescendant`. Malayalam options carry `lang="ml"`. `SpellAnnounce`: an always-mounted polite live region says the kind, the word and the keys (`check.announce`, en + ml). `SpellStrip` (phone strip) has the same keys, ids and announcement.
- `src/extensions/writing-aids.ts`: marks carry `aria-invalid="spelling"` (`"grammar"` for spacing).
- Help: `content/help/03-editor.md` (#spelling keyboard line, shortcuts table row).
- Checked: typecheck, i18n:check, local-mode build; Playwright (Chromium, 1280 × 800) on a broken-chillu word: arrows, wrap, Enter fix, Enter-before-arrow = new line, Esc, arrival by arrows (↓ moved on to the next line), Alt+↓. Not tried with a real screen reader (VoiceOver/NVDA).
- Found while checking, fixed in the next entry: `ShortcutsDialog.tsx` was inline English and said "1 – 7"; the Manglish list had the same screen-reader gap.

## 2026-11-19: Spelling suggestions at the marked word

`components/editor/SpellSuggest.tsx` (new): `SpellSuggest` card under a marked word on desktop/tablet (Workspace, beside `ManglishPopup`), `SpellStrip` row above the phone keyboard (rendered by the docked `ManglishPopup` when no Manglish word is being typed). `issueAt` in `extensions/writing-aids.ts`; `ignoreWord` + filtered `blockChecker` in `lib/spell.ts`. Wavy lines 1.5px (`styles/editor.scss`). Help `03-editor.md#spelling`. Tested with Playwright in local mode (desktop + iPhone 13 emulation); not on a real iPhone.

## 2026-11-18: നാട്ടറിവ് restyle and new categories

See `cross-platform.md`. Files: `src/components/Nattarivu.tsx` (`HEADING` tint map, section heading, row sizes, five icons), `packages/shared/src/nattarivu.ts`, `content/help/06-dictionary.md`. Typecheck and build in this session; not looked at in a browser.

## 2026-11-17: Security audit fixes (server side)

See `cross-platform.md`. Files: `supabase/migrations/20261117090000_security_hardening.sql`, `supabase/functions/litma-mcp/index.ts`, `litma-ai/index.ts`, `_shared/ratelimit.ts`. Typechecked with `deno check`; not run against the live project.

## 2026-11-16: Rhymes "Next set"; no keyboard capitals in Manglish

- `components/RhymeFinder.tsx`: ranks up to 1,000 rhymes and shows 40 at a time; a **Next set** button (RefreshCw) with "1–40 of N" moves through them and starts again after the last set. Strings `rhyme.next`, `rhyme.range`. Help `06-dictionary.md#rhymes`.
- iPhone Safari capitalised the first word ("amma" → "Amma" → ആമ്മ; "mazha" → "Mazha" → ംഅഴ in the rhyme box). `Workspace.tsx` now sets `autocapitalize="off"` and `autocorrect="off"` on the editor while the mode is Manglish (back to sentences/on otherwise), same for the title box; the rhyme box and the dictionary's search box always have them off. Capitals typed on purpose keep their Manglish meaning (Aana → ആന).
- Unverified: on a real iPhone; the "Next set" button in a browser (no dictionary data in local builds).

## 2026-11-16: Help guides on their own pages

- `app/help/[id]/page.tsx`: one static page per guide (`allGuides`, `forPage(data, id)` sends only that guide's HTML; `describe()` makes the meta description). `components/help/HelpCenter.tsx`: `HelpView` (no query hooks, so guide pages render into the HTML) and `HelpCenter` (home/topics; forwards ?a=). `guideHref()` in `lib/help-types.ts`; `lib/help.ts` turns `(#id)` and `/help/?a=id` links into `/help/id/`. `app/sitemap.ts` lists every guide. `UpdateNotice` credits link → `credits/`.
- Checked with a full build in a scratch copy. Unverified in a browser: the ?a= forward and in-page "On this page" jumps on the new pages.

## 2026-11-15: Community sign-in button readable

- `components/community/Community.tsx` `SignInCard`: the Sign in button on the dark card was white text on `.btn-outline`'s white surface; now transparent with a light border (owner's iPhone screenshot).

## 2026-11-15: Desk listed other writers' shared works

- `lib/store.ts`: `myId()`; `listDocs`, `getDoc` and `prefetchDocs` add `.eq("user_id", me)` (the table's public policy returned every shared work). Kept copies of others' works leave the device cache at the next listing (`refreshKept`).
- `getShared` reads through the `shared_document` RPC (migration `20261115130000_shared_document.sql`): signed-in writers can no longer read others' shared works from the table.
- Unverified: `next build`; open a shared link signed in and signed out after the migration runs.

## 2026-11-15: Block a writer in Litma Community

- `lib/community.ts`: `Blocked` type, `community.blocked()`, `block(author)`, `unblock(id)`; local mode keeps `blocked` in `litma:community` and filters threads and replies. In cloud mode the read policies hide the posts (migration `20261115120000_community_blocks.sql`).
- `components/community/ThreadView.tsx`: **Block** (lucide `Ban`) on the opening post and replies by other writers, with a confirm; blocking the thread's writer goes back to the list, blocking a replier removes their replies and shows a note linking to Blocked writers.
- `components/community/Community.tsx`: `?view=blocked` → `BlockedList` (avatar, name, Unblock); link "Blocked writers" under the categories.
- Strings `community.block`, `unblock`, `blockDialog.*`, `blocked.*` (en + ml). Help `13-community.md#community-block`; guidelines "Reports and moderation"; privacy "Writers you block".
- Moderate menu (`ModMenu` in `ThreadView.tsx`) opens to the left of its button when there is no room on the right; on phones the button wraps to the left edge and the menu ran off the screen (owner's screenshot).
- Unverified: `next build` and a look in the browser (sandbox had no Linux SWC binary).

## 2026-11-15: Store badges, Microsoft Store first on Windows, Linux off the website

- **Badges:** `components/StoreBadges.tsx` is now `StoreBadge` (`store` = ios | android | windows, optional `fallback` link) + `StoreBadges` (phones). It draws the stores' own files, unchanged, from `public/brands/` (`app-store-badge.svg` from Apple's App Store Marketing Tools, `google-play-badge.png` from Google with its clear space (drawn 250/168 taller with negative margins), `microsoft-store-badge.svg` from get.microsoft.com; sources in `public/brands/README.md`). The owner first sent Spotify's CDN copies (`scdn.co`); the stores' own files were used instead. Without a store link a badge shows "Coming soon" under it, or opens `fallback`.
- **`lib/release.ts`:** `STORE_LINKS.windows` = `https://apps.microsoft.com/detail/9NKP5NXGX0J2?referrer=appbadge&mode=direct`; `APP_STORE_BADGE`, `GOOGLE_PLAY_BADGE`, `MS_STORE_BADGE` paths. `ios` and `android` are still null.
- **/download/:** Windows visitors get the Microsoft Store badge first, the hint "installs without a warning and updates itself" and "Or download the .exe directly · size" under it. The Windows card has the badge and an outline `.exe` button. The "not signed" note shows only on the Windows install tab and now says the Store copy doesn't ask. Install step win1 mentions the Store. Linux card, Linux install tab and the Linux hero branch removed; Linux and other visitors see `download.webOnly` and the website button. Grid is 4 cards.
- **Home:** the violet download card (`DesktopDownload variant="pop"`) is "Litma on every device." (`download.popTitle`, `popBody`) with "Also in the app stores": App Store, Google Play, Microsoft Store badges (they open `/download/` until their links exist). Hero link: "Get the app for Mac, Windows, iPhone and Android". Linux button removed from `DesktopDownload`.
- **Linux off the website** (owner, 15 Nov: "I will add it later"; builds and workflows stay): strings `download.linux`, `linuxHint`, `linuxReq`, `steps.linux1-3` deleted, `linuxSoon` renamed `webOnly`; `download.body`/`navTitle` say Mac and Windows; help `10-apps.md` (no Linux step, Store step for Windows, store copies update through their store) and `01-getting-started.md`; Privacy Policy intro (date not changed, nothing about data changed); README; store listing texts in `marketing/store/*` (live App Store / Play / Microsoft listings still say Linux until their next edit). Old keys `appStoreSmall`, `playSmall`, `comingSoon` deleted; new `msStore`, `msStoreHint`, `exeDirect`, `storeSoon`, `appStoreAlt`, `playAlt`, `popTitle`, `popBody`, `inStores` (en + ml).
- Checked: typecheck, `i18n:check`, `mobile:assets`, local-mode build, and Playwright screenshots of /download/ (Windows, Mac, iPhone user agents) and the home page. **Unverified:** the Microsoft Store link opens a "not available" page until the listing is published; push after certification passes, or accept that for a few days. Phone app unchanged (no download page; it opens the website).

## 2026-11-14: Dictionary finds words typed with a stray joiner

`packages/shared/src/dict.ts`: exported `spellings()`; `lookup`/`suggest` retry with joiners removed and old chillu made atomic when the word as typed isn't found. Synced to `supabase/functions/_shared/dict.ts`. Checked with node against `public/dict`; `tsc --noEmit` passes.

## 2026-11-14: Dictionary suggests Malayalam for Manglish while typing

- Owner: the dictionary should suggest like Olam as you type, English and Malayalam from Manglish. Before, the box suggested only English or Malayalam prefixes; Manglish (`maza`) showed nothing until Enter.
- `lib/dictionary.ts` `typingSuggestions(q)`: English/Malayalam prefix completions (`suggest`) plus, for Manglish, the transliterator's spellings that are dictionary words and words starting with them (`kadal` → കടൽ, കടൽക്കര…); unknown spellings are still offered when none is in the dictionary. English completions lead when there are some (`hou` → House…), and the Malayalam group is then 4 long.
- `components/DictionaryView.tsx`: 150 ms pause before asking (the transliterator is a network call), grouped list (English / മലയാളം headings when both), ↑ ↓ Enter, Esc, combobox roles, rows styled like other menus. Used by /dictionary and the editor's Dictionary panel.
- Help `06-dictionary.md#look-up` step 2.
- Checked: `tsc --noEmit`; the logic against the built `public/dict` data with the offline Manglish rules (mazha, veedu, kadal, sneham, amma, hou, മഴ). Owner checked it on getlitma.in and in the Mac App Store copy from TestFlight (0.7.25): Manglish suggestions while typing, ↑ ↓ and Enter.

## 2026-11-14: Clear button and Esc in name fields

- `src/components/ScriptField.tsx`: × inside the field (keeps focus, so Esc still works after it), Esc restores the value from focus time (`before` ref).
- `src/components/editor/Workspace.tsx`: title box shows a × while editing (`group/title`), Esc puts back the title from focus time and leaves the box (stops the focus-mode Esc), an empty title on blur gets its old name back (`titleBefore`).
- `field.clear` in `packages/i18n` (en, ml), help in `01-getting-started.md` and `02-typing.md`.
- Typecheck passes; `npm run build` and a click-through are still to do (the sandbox's Linux VM can't use the Mac's `node_modules`).

## 2026-11-14: Update card off in store copies of the desktop app

- `lib/desktop.ts` (`store` on the bridge), `components/UpdateNotice.tsx`: nothing shown in a desktop copy from an app store; About says the store updates it (`update.storeAuto`, `update.store_mas|msstore|snap`). Website and normal desktop downloads: unchanged. `tsc --noEmit` passes.

## 2026-11-14: Title in Manglish

- `components/editor/Workspace.tsx`: the work's title box follows the typing mode. In Manglish mode a finished word (space or punctuation) turns into Malayalam, and the rest when leaving the title (`titleDirty`, `toMalayalam` from `components/ScriptField.tsx`), like the phone app's rename box. Help: Getting started → Rename a work. `tsc --noEmit` passes; not tried in a browser. Desktop gets it with the next Release.
- Help: new section Writing and formatting → Select text `{#select}` (web and phone), and the phone note under Pages says Backspace removes an empty page.

## 2026-11-14: FTPS upload forced to TLS 1.2

- The Release run's site upload failed listing files: `gnutls_record_recv: Error in parsing` on the FTPS data connection (lftp/GnuTLS with cPanel's FTP server over TLS 1.3). Every lftp login (`deploy.yml`, `desktop.yml` latest.json upload, `clear-getlitma.yml`, `legacy-redirect.yml`) now sets `ssl:priority NORMAL:-VERS-TLS1.3`. **Unverified** until the next push/deploy run.

## 2026-11-14: Delete-account guide says what is kept

- New section `11-account.md#delete-data` (`/help/?a=delete-data`): deleting works, books, saved words, keys, community posts (hidden copy 180 days) and statistics without closing the account; Google Play's "delete some data" link.

- `apps/web/content/help/11-account.md#delete-account`: a "What is kept" line (statistics from before sign-in, no name, removed within 90 days), as Google Play's account-deletion link must say. Live after the push; no app change.

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
