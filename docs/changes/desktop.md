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
- **Release needed** for the 2026-11-08 writing aids (reminders in the main process, notifications, folder backup, and the web features). Try on a Mac and Windows: notification permission, reminder with the window closed, choosing a Google Drive for desktop folder.
- In the Playwright Electron run, `page.goto` to an `app://` address with a query string, or away
  from an open editor, was aborted; in-app clicks work. Use clicks in tests.

## 2026-11-08: reminders, notifications and the daily folder backup

- `src/reminders.ts`: the reminder lives in the main process (`litma:reminder:set` from the web app's `Reminders`, checked every minute, once a day, only while today's goal isn't met), so it rings with every window closed on macOS. `litma:notify` shows system notifications (writing timer). `app.setAppUserModelId` on Windows so notifications show.
- `src/backup.ts`: `litma:backup:*` IPC; a folder chosen with the system dialog (kept in `userData/backup.json`), backups written there daily by the web app's `BackupNudge` a minute after start, newest 14 kept.
- Preload adds `setReminder`, `reminderRang`, `notify`, `backupFolder`, `chooseBackupFolder`, `forgetBackupFolder`, `openBackupFolder`, `writeBackup` (typed in `apps/web/src/lib/desktop.ts`). Google Drive's popup is hidden in the desktop app; pick the Drive for desktop folder instead.
- Read aloud uses the system voices (none for Malayalam on macOS or Windows yet; the panel says so).
- Needs a **Release**. Unverified: not run in Electron in this session (typecheck only).

## 2026-11-08: no admin links in the desktop app

- The desktop build (`NEXT_PUBLIC_DESKTOP=1`) shows neither the avatar menu's Admin dashboard nor
  the Settings admin card; the dashboard is a website page. Next Release.

## 2026-11-08: Manglish in search

- Same as the web (shared code); reaches the desktop app with the next Release.

## 2026-11-07 (evening): Litma Help; publisher line

- `src/main.ts`: Help menu has **Litma Help** (F1 on Windows/Linux) opening `${SITE}/help/` in the
  browser; `setWindowOpenHandler` sends `/help` links on the site to the browser instead of an app
  window (Settings → Help and guide and the account menu use the site URL in the desktop app).
- Gets the web's cover change (publisher as its own part, readable over artwork) with the next
  Release. Unverified in a packaged app: the menu item (typecheck only).


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
