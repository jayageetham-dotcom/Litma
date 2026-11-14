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
- **Release needed** for Litma Community (2026-11-09): `/community/` and `/community/guidelines/` run inside the app (no desktop-only code). Check both by loading and by the avatar menu and Settings links in a packaged build.
- **Release needed** for the 2026-11-09 spelling engine, grammar fix cards, grouped rail, editor menus and the other web changes of that day (all in the shared web code).
- Installers are unsigned until the signing secrets exist (see cross-platform.md).
- **Store builds (2026-11-14):** the five `MAS_*` secrets are set. Owner to move the updated `apps/desktop/store-workflow/desktop-stores.yml` into `.github/workflows/` (signing fix, README there), run **Desktop store builds** again; check the Mac App Store copy in TestFlight for Mac before submitting.
- **Release needed** for the 2026-11-08 writing aids (reminders in the main process, notifications, folder backup, and the web features). Try on a Mac and Windows: notification permission, reminder with the window closed, choosing a Google Drive for desktop folder.
- In the Playwright Electron run, `page.goto` to an `app://` address with a query string, or away
  from an open editor, was aborted; in-app clicks work. Use clicks in tests.


## 2026-11-14: Mac App Store build: own signing keychain

- First run of **Desktop store builds** failed while signing: `security set-key-partition-list … SecKeychainUnlock: The user name or passphrase you entered is not correct`. Cause: electron-builder 25.1.8 (`app-builder-lib/out/codeSign/macCodeSign.js`, `importCerts`) passes the `.p12` password as the password of the random-password keychain it creates from `CSC_LINK`.
- New `apps/desktop/scripts/build-mas.sh`: makes its own keychain with a known password, imports both `.p12` files (and Apple's WWDR G3 intermediate), checks that an Apple Distribution and a Mac Installer identity are valid (clear error if not), writes the provisioning profile, builds, and runs electron-builder with `CSC_KEYCHAIN` and no `CSC_LINK`; removes keychain and profile on exit. The workflow step now only calls it, with `MAS_*` env and `BUILD_NUMBER`.
- Updated workflow waits in `apps/desktop/store-workflow/desktop-stores.yml` for the owner to move (README there).
- **Same bug will hit `desktop.yml`** (getlitma.in downloads) once `CSC_LINK` / `CSC_KEY_PASSWORD` are set for Developer ID signing: give it the same treatment (or upgrade electron-builder) before adding those secrets.
- **Unverified:** not run yet (bash -n only; no macOS here).

## 2026-11-14: Store builds (Mac App Store, Microsoft Store, Snap Store)

- `src/store.ts` (new): which store a copy came from (`process.mas`, `process.windowsStore`, `SNAP`). In a store copy `updater.ts` does nothing (`checkForUpdates`, `downloadUpdate`, `installUpdate`, `startUpdateChecks` return early), the menus have no "Check for updates", `main.ts` passes `--litma-store=` and the preload then exposes no update functions plus `store`; the Microsoft Store copy keeps the package's own AppUserModelId. Downloads from getlitma.in: unchanged behaviour (`store` is null).
- `src/backup.ts`: the folder is saved with a security-scoped bookmark in the Mac App Store sandbox (`securityScopedBookmarks`, `startAccessingSecurityScopedResource` in `withFolder`); other copies work as before.
- `electron-builder.stores.yml` (extends `electron-builder.yml`, which is unchanged): `appId in.getlitma.litma`, `mas` (sandbox entitlements `build/entitlements.mas.plist` / `.inherit.plist`, provisioning profile written by CI, `ElectronTeamID`), `appx` (tiles in `build/appx/`, made from `build/icon.png`; identity from repo variables), `snap` (strict, stable, name `litma`). Config loads and validates with app-builder-lib 25.1.8; the base config still resolves to `com.jayageetham.litma` with no store sections.
- Workflow `desktop-stores.yml` (by hand; skips each store until its secrets/variables exist; Mac upload with the `ASC_*` key via `xcrun altool`, Snap via `snapcore/action-publish`, Microsoft Store packages attached for a Partner Center upload). The owner moved it into `.github/workflows/` (commit 34d6a68).
- Web: `UpdateNotice` shows nothing in a store copy and About says "Updates come from {store}" (`update.storeAuto`, `update.store_*`, en + ml).
- **Unverified:** no store package has been built yet (no Electron/Windows/macOS toolchain here). First runs to watch: the Mac sandbox (sign-in, `app://`, `/dict` fetch, export, print, backup folder), `xcrun altool --upload-app` still accepted on the runner's Xcode, the appx build on windows-latest, the snap template build on ubuntu-latest. A Release is needed for the downloads to carry the store detection too (harmless there).

## 2026-11-14: Clear button and Esc in name fields

Same code as the web (`ScriptField.tsx`, `Workspace.tsx` title). No desktop-only code. **Release needed.**

## 2026-11-14: Mac signing steps

- With the Apple developer account, the Mac app can be signed and notarised: steps in `docs/setup/google-and-supabase.md` 10.5 (secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, already read by `desktop.yml`). No code change.

## 2026-11-13: Delete account and CAPTCHA (web code, needs a Release)

- Settings → Delete account and the sign-in check come from `apps/web`. The check loads `https://getlitma.in/captcha/` in an iframe (Turnstile won't run on app://litma); `.htaccess` lets `app:` frame that page only. Subframe navigation isn't blocked by `main.ts`. Unverified in a packaged app.

## 2026-11-13: Credits link (web code, needs a Release)

- Settings → About's new "Credits and licences" link comes from `apps/web` (`AboutLitma`); on desktop it opens getlitma.in/help/?a=credits in the browser. Reaches the app with the next Release.

## 2026-11-09: Desktop build survives GitHub download hiccups

- A Release failed on macOS: github.com answered 504 while electron-builder downloaded Electron 33.2.1. `.github/workflows/desktop.yml` now keeps Electron's download in `actions/cache` (`ELECTRON_CACHE` / `ELECTRON_BUILDER_CACHE` under `.electron-cache`, key from `package-lock.json`) and tries `electron-builder` up to 3 times, 30 s apart. A day earlier `npm ci` itself failed the same way (electron's postinstall got a 504), so `desktop.yml` and `deploy.yml` now set `ELECTRON_SKIP_BINARY_DOWNLOAD=1`: no CI step runs the Electron binary, and electron-builder fetches its own copy. No app change. Unverified until the next Release run (the cache is filled on the first run).

## 2026-11-08: Read aloud: pitch, volume, word underline

- Same web code (`ReadAloudPanel.tsx`, `lib/speech.ts`); no desktop-only change. Reaches the desktop app with the next Release. The Mac and Windows system voices still have no Malayalam, so most desktop writers see the "no voice" help as before.

## 2026-11-08: Pinned work on the desk

- Web change only (shared code); reaches the desktop app with the next Release.

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
