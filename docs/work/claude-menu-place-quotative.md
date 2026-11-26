# Menu placement, quotative endings, Manglish capitals (branch `claude/menu-place-quotative`)

Owner's ask (26 Nov 16:10): why are words with എന്നാണ് / എന്നുള്ള still flagged; check with the MCP whether capitals in Manglish work the same online in the phone app; fix the tall right-click menu covering the clicked line ("use auto align if needed without compromising performance"). Owner asked earlier that the lead merges its own branches after testing.
Lead: Claude session (claude.ai/code) · Started: 2026-11-26

## Decisions
- 2026-11-26 Exact spelling with capitals only for meaningful capitals inside a word (`exactReading`); name-style capitals (Kerala), words in capitals (TV) and meaningless capitals (iPhone) keep Google's reading. This also corrects PR #19, where any capital led with the letter reading (Kerala → Kഎരല).

## Questions

## Build (web-dev + flutter-dev, done by the lead)
- Why flagged: `quoted()` only matched എന്ന്/എന്നു/എന്ന/എന്നും/എന്നോ; mlmorph can't chain longer endings after a long negative (കാണാനില്ലെന്നാണ്), though it knows them after ഇല്ലെന്ന. Now any tail mlmorph accepts after ഇല്ലെന്ന is allowed, still only after a negative. `quoted-check.ts` covers the long endings (prose 21 of 345 flagged, was 22; false passes 73 of 1,628, all with a base mlmorph itself accepts; MUST_OK/MUST_FLAG extended).
- MCP check (Litma MCP `transliterate`, Google behind it): `pani paNi kalam kaLam vattam vaTTam kodi koDi` → `പണി പണി കാലം കാലം വട്ടം വട്ടം കോടി കോടി`: Google ignores case. Phone `Transliterator.candidates` put Google first, so kaLam gave കാലം online. Fixed in `_shared/google.ts` (litma-transliterate and MCP), web `ManglishPopup`, phone `config.dart`, offline rankers (TS + Dart) via `exactReading`.
- Menu: placed by the clicked line's rect (`coordsAtPos`): below if it fits, else above, else the roomier side with `maxHeight` and its own scroll; one layout read per opening. Playwright at 1440×900, 1024×600, 1024×420, five heights each: never overlaps the line, always inside the window.
- Checks: typecheck, build, i18n:check, sync:shared, mobile:assets (vectors regenerated). Dart not compiled here: Mobile app checks.

## Tests (tester)

## Verification (verifier)
