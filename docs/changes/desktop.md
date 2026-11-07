# Desktop changes (apps/desktop, Electron)

The desktop app bundles its own copy of `apps/web`, so web changes reach it only after
Actions → **Release** builds new installers. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- **Release needed** for the 2026-11-07 web changes (inbox Copy keeps the suggestion,
  selectable inbox text, Manglish word finishing when the cursor leaves it, empty line as a
  section break in novels and stories).
- Not yet driven in Electron with Playwright (`_electron.launch`, see CLAUDE.md).

## 2026-11-07

- No desktop-only code changed. The desktop app picks up the web changes listed in `web.md` with
  the next Release. The phone-only parts (keyboard strip, docked suggestion row) don't show on
  desktop.
