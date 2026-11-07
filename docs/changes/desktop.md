# Desktop changes (apps/desktop, Electron)

The desktop app bundles its own copy of `apps/web`, so web changes reach it only after
Actions → **Release** builds new installers. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- **Release needed** for the 2026-11-07 web changes (print view without the white strip on top,
  no "What's new" changelog link, inbox Copy keeps the suggestion,
  selectable inbox text, Manglish word finishing when the cursor leaves it, empty line as a
  section break in novels and stories, Book details and cover labels in Malayalam, in-app
  confirm dialogs) and to publish the first Linux AppImage.
- Installers are unsigned until the signing secrets exist (see cross-platform.md).
- In the Playwright Electron run, `page.goto` to an `app://` address with a query string, or away
  from an open editor, was aborted; in-app clicks work. Use clicks in tests.

## 2026-11-07: Help menu

- `src/main.ts`: Help → "What's new" (opened `CHANGELOG.md` on GitHub) removed; "Report a problem"
  now writes to support@getlitma.in instead of the owner's own address. The print view fix in
  `web.md` reaches the app with the next Release. Not driven in Electron this time (same print
  code as the website, checked there).

## 2026-11-07: Electron check (PR #6)

- Drove the local-mode desktop build with Playwright's `_electron.launch` under `xvfb-run`
  (pass `executablePath: node_modules/electron/dist/electron`): desk → new story → Manglish typing
  converts; Books → New book opens the book page with Book details, Page & type and sample values;
  no page errors.

## 2026-11-07: Linux (PR #4)

- `electron-builder.yml` and `desktop.yml` build `Litma-<v>-linux.AppImage` (x64), listed in
  `latest.json`; `src/updater.ts` replaces the AppImage in place and reopens it.

## 2026-11-07

- No desktop-only code changed. The desktop app picks up the web changes listed in `web.md` with
  the next Release. The phone-only parts (keyboard strip, docked suggestion row) don't show on
  desktop.
