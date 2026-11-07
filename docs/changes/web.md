# Web changes (apps/web)

The website, and the shared code the desktop app bundles. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- The 2026-11-07 Manglish "finish on leaving the word" rule was checked with Playwright in local
  mode on a desktop-size window only; check it on a real phone browser (iOS Safari, Android
  Chrome), where the system keyboard may compose words differently.

## 2026-11-07

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
