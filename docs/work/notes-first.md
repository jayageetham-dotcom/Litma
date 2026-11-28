# Note first, keep rule, Journal name (branch `notes-first`)

Owner's ask: ശൂന്യം becomes കുറിപ്പ് (Note), first in the writing-type picker; new ones titled "പുതിയ കുറിപ്പ്", old "പുതിയ ശൂന്യം" titles renamed. Keep rule for every writing type: a new work is kept on close if the writer changed its title or wrote any body text. Diary becomes ജേണൽ / Journal in names only.
Lead: Claude session 2026-11-28 · Started: 2026-11-28

## Decisions
- 2026-11-28 Kind ids stay `blank` and `diary` (owner).
- 2026-11-28 Owner approved renaming existing "പുതിയ ശൂന്യം" titles (migration `20261128090000_note_titles.sql`).
- 2026-11-28 Body text = any text except the auto-filled author/byline line, a journal's dateline and the template's own labels (lead). A work typed in and then emptied again is discarded like an untouched one.
- 2026-11-28 Malayalam "New entry" for journals: പുതിയ കുറിപ്പ് → പുതിയ എൻട്രി, since കുറിപ്പ് is now the Note type (lead; owner to confirm).

## Questions
- → owner: is പുതിയ എൻട്രി right for a journal's "New entry"? (open)

## Build (lead)
See `docs/changes/cross-platform.md` 2026-11-28. Shared `keepOnClose` / `hasWriting` / `isDefaultTitle` / `defaultTitle` / `currentTitle` / `PICKER_KINDS` (forms.ts, Dart port forms.dart, `test/keep_rule_test.dart`); web Workspace `recheckPristine`; phone session `_recheckPristine`; stores' `discardPristine`; MCP create/update. Local checks: typecheck, build, i18n, tsx cases, Playwright keep cases.

## Verification (verifier)
