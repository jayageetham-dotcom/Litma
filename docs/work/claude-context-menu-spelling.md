# Right-click menu, quotative spelling fix, Manglish picks (branch `claude/context-menu-spelling`)

Owner's ask: "once in web, litma should show its own right click menu with shortcuts, rather than system's. Check how docs shows. Add litma's own right click menu options along with common options." (web and desktop). Also: കാണാനില്ലെന്ന് is a correct word but shows "Check spelling?"; capital letters in Manglish should count online like offline; my earlier Manglish picks were not remembered. "Merge your own and test if needed."
Lead: Claude session (claude.ai/code) · Started: 2026-11-26

## Decisions
- 2026-11-26 The owner asked the lead to merge this branch itself (overrides "owner merges" for this branch).
- 2026-11-26 Right-click menu only on pointer devices (web + desktop). Phones keep their own selection bar. Shift + right-click keeps the browser menu.
- 2026-11-26 Capitals in Manglish (N ണ, L ള, T ട, D ഡ, R റ) put the exact reading first online too, as the offline ranker already did, so online and offline agree.

## Questions
- (none open)

## Build (web-dev, done by the lead)
- Spelling engine: `MlSpeller.quoted()` in `packages/shared/src/mlmorph.ts` (synced to `_shared`): a word mlmorph knows + quotative എന്ന്/എന്നു/എന്ന/എന്നും/എന്നോ (ഇല്ല + എന്ന് → ഇല്ലെന്ന്) is ok. mlmorph has each half but not the chain. Checked with the real transducer (mlmorph 1.4.3): കാണാനില്ലെന്ന്, കാണാനില്ലെന്നു, കാണാനില്ലെന്ന, അറിയില്ലെന്ന്, വരില്ലെന്ന്, പറഞ്ഞില്ലെന്ന്, കാണാനാവില്ലെന്ന്, വേണ്ടെന്ന് now ok; കാണാനില്ലെന്ന്ന്, ലെന്ന് still not. Server-side, so web, desktop, phone and MCP get it when `litma-spell` deploys.
- Manglish picks: `withPick` was skipped when a word's Google list came from the visit cache (`ManglishPopup.tsx`) and for the first offline list (`extensions/manglish.ts` `computeCompose`). Both now put the writer's own pick first. Capitals: `fetchCandidates` puts `manglishWord(word)` first when the word has a capital.
- Right-click menu: `components/editor/EditorContextMenu.tsx`, mounted in `Workspace.tsx` when not on a phone. `SpellSuggest` hides while it is open (`CONTEXT_MENU_EVENT`). Desktop: `litma:edit` IPC (`paste` / `pasteAndMatchStyle` on `webContents`), `litmaDesktop.edit` in preload, and `editMenuFor` (small native Cut/Copy/Paste menu outside the editor). Strings `editorMenu.*` in en + ml; help guide `03-editor.md` (Select text → The right-click menu).
- Checks: `npm run typecheck`, `npm run build`, `npm run i18n:check`, `npm run sync:shared`, `npm run mobile:assets` (phone i18n copy) all pass.
- Manual Playwright in local mode (1280 px, Chromium): menu opens on right-click, keeps a selection, Copy puts the word on the clipboard, Paste inserts it, ↓↓ moves `aria-activedescendant`, Esc closes without changing text, Look up selects the word and opens the dictionary, Shift + right-click shows no Litma menu.
- Phone: nothing to mirror for the menu. The phone app already remembers picks in its own transliterator. Unverified: the phone's online list and capitals (`lib/core/transliterate*.dart`) against the web rule.

## Tests (tester)

## Verification (verifier)
