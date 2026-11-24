# Desktop changes (apps/desktop, Electron)

The desktop app bundles its own copy of `apps/web`, so web changes reach it only after
Actions → **Release** builds new installers. Cross-app summary and open items:
`cross-platform.md`. Read before starting; add your changes (newest first) before finishing.

## Open items

- **Release needed** for ranked offline Manglish suggestions (2026-11-24, shared web code; the word list comes from the website's `/dict/` and is kept on disk by `kept()`).

- **Release needed** for the 2026-11-22 accessibility work: spelling suggestions from the keyboard and for screen readers, Manglish list for screen readers, shortcuts list in Malayalam (`SpellSuggest.tsx`, `ManglishPopup.tsx`, `ShortcutsDialog.tsx`; no desktop-only code).

- **Release needed** for the 2026-11-07 web changes (print view without the white strip on top,
  no "What's new" changelog link, inbox Copy keeps the suggestion,
  selectable inbox text, Manglish word finishing when the cursor leaves it, empty line as a
  section break in novels and stories, Book details and cover labels in Malayalam, in-app
  confirm dialogs) and to publish the first Linux AppImage.
- **Release needed** for Litma Community (2026-11-09): `/community/` and `/community/guidelines/` run inside the app (no desktop-only code). Check both by loading and by the avatar menu and Settings links in a packaged build.
- **Release needed** for the 2026-11-09 spelling engine, grammar fix cards, grouped rail, editor menus and the other web changes of that day (all in the shared web code).
- The Mac download is signed and notarised (14 Nov). The Windows installer is still unsigned until `WIN_CSC_LINK` exists (a paid code-signing certificate).
- **Microsoft Store (2026-11-14):** product Litma reserved (Store ID 9NKP5NXGX0J2); variables set, first appx build passed, submission 1 certified and **live in the Microsoft Store** (seen 22 Nov); the website links to it. Updates: upload the `.appx` from a Release run in Partner Center → Start update. Linux is off the website for now; the AppImage keeps building and updating existing copies.
- **Store builds (2026-11-14):** the five `MAS_*` secrets are set. Desktop store builds run #2 passed; 0.7.26 (4) submitted for Mac App Store review on 14 Nov; check the Mac App Store copy in TestFlight for Mac before submitting.
- **Release needed** for the 2026-11-08 writing aids (reminders in the main process, notifications, folder backup, and the web features). Try on a Mac and Windows: notification permission, reminder with the window closed, choosing a Google Drive for desktop folder.
- In the Playwright Electron run, `page.goto` to an `app://` address with a query string, or away
  from an open editor, was aborted; in-app clicks work. Use clicks in tests.


## 2026-11-22: Release builds the desktop store packages too

Owner asked why TestFlight showed macOS 0.7.27 but iOS 0.7.31: the Mac App Store build only came from **Desktop store builds**, run by hand (last on 15 Nov). `release.yml` now calls `desktop-stores.yml` (new `workflow_call`, input **stores**, on by default) with the new tag, so every Release uploads the Mac App Store build to TestFlight and attaches the Microsoft Store `.appx` and Snap. Build number is the Release run number (same as the phone). A manual run takes an optional `build_number` (CFBundleVersion must rise). Unverified until the first Release with it runs. Microsoft Store: Litma is live there (Partner Center shows "In Microsoft Store", 22 Nov). Each Release now attaches `litma-microsoft-store`; a Store update is still by hand (Partner Center → Start update → Packages → upload both `.appx`).

## 2026-11-19: Spelling suggestions at the marked word

Web change only (`SpellSuggest` card under the word, Esc closes). Reaches the desktop app with the next Release.

## 2026-11-18: നാട്ടറിവ് restyle and new categories

Shared web code only (see `cross-platform.md`); reaches the desktop app with the next Release.

## 2026-11-16: Rhymes "Next set" (shared web code)

Comes with the web change (`RhymeFinder.tsx`); keyboard-capital fix doesn't matter on desktop keyboards. Needs a desktop Release.

## 2026-11-14: Microsoft Store product reserved

Owner registered a free Individual developer account (publisher display name **Litma**, contact support@getlitma.in) and reserved the product **Litma** (MSIX or PWA app). Product identity: Name `Litma.Litma`, Publisher `CN=65F97D31-CBDB-4940-BD50-27470F8E0B57`, PublisherDisplayName `Litma`, PFN `Litma.Litma_khazx26530b2y`, Store ID `9NKP5NXGX0J2` (https://apps.microsoft.com/detail/9NKP5NXGX0J2). No code change: `electron-builder.stores.yml` already uses displayName/applicationId `Litma`. Next: owner adds the repo variables `MSSTORE_IDENTITY_NAME`, `MSSTORE_PUBLISHER`, `MSSTORE_PUBLISHER_DISPLAY_NAME` (the cloud session's proxy blocks the Actions variables API), runs **Desktop store builds**, uploads both `.appx` in a submission. The first appx build passed (Desktop store builds, 14 Nov: artifact `litma-microsoft-store`, 240 MB, x64 + arm64). Partner Center validated both packages. Submission 1 (0.7.27.0) filled in on 15 Nov: free, all markets, Productivity, privacy URL, IARC 3+ (Users Interact), listings in en-IN and ml-IN from `marketing/store/microsoft-store/listing-text.txt` (Mac screenshots, poster and box art in that folder), runFullTrust justified, reviewer account jagath.gj+review@gmail.com under Credentials, publishing held until "Publish now". After certification: Publish now, then add the Microsoft Store link (https://apps.microsoft.com/detail/9NKP5NXGX0J2) to `STORE_LINKS`. The Community has no block-user feature (IARC answer "No"); stores may ask for it. The package declares `en-IN` and `ml-IN`, so Partner Center will ask for a listing in both; submission will ask to justify `runFullTrust`.

## 2026-11-14: Signed getlitma.in Mac download (prepared)

- New `apps/desktop/scripts/mac-keychain.sh`, sourced by the macOS step of `desktop.yml` when `CSC_LINK` is set: own keychain with a known password, imports the Developer ID Application `.p12` and Apple's Developer ID intermediates, checks the identity, sets `CSC_KEYCHAIN`, unsets `CSC_LINK`; removed when the step ends. Notarisation stays electron-builder's (automatic with `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).
- Owner moved the `desktop.yml` change into place (dabf5ea), added `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and ran **Release**: the Mac download from getlitma.in now installs and opens without the security warning (owner, 14 Nov). Still to see: the in-app updater moving an older unsigned copy to the signed one.

## 2026-11-14: Mac App Store copy carries its encryption answer

- Builds 2 and 3 showed "Missing Compliance" in TestFlight: `ITSAppUsesNonExemptEncryption` (and `ElectronTeamID`) were under `mas.extendInfo`, which electron-builder 25 ignores (`macPackager.js` reads `extendInfo` from `mac` only). Moved to `mac.extendInfo` in `electron-builder.stores.yml` (store builds only; `electron-builder.yml` for the downloads is unchanged). Build 0.7.26 (4) arrived without the compliance question and installed from TestFlight (owner, 14 Nov).

## 2026-11-14: Dictionary suggestions for Manglish (web code)

Same `DictionaryView` as the website (see `web.md`). No desktop-only code. Reaches the downloads with the next **Release** and the Mac App Store copy with the next **Desktop store builds** run.

## 2026-11-14: Mac App Store build: own signing keychain

- First run of **Desktop store builds** failed while signing: `security set-key-partition-list … SecKeychainUnlock: The user name or passphrase you entered is not correct`. Cause: electron-builder 25.1.8 (`app-builder-lib/out/codeSign/macCodeSign.js`, `importCerts`) passes the `.p12` password as the password of the random-password keychain it creates from `CSC_LINK`.
- New `apps/desktop/scripts/build-mas.sh`: makes its own keychain with a known password, imports both `.p12` files (and Apple's WWDR G3 intermediate), checks that an Apple Distribution and a Mac Installer identity are valid (clear error if not), writes the provisioning profile, builds, and runs electron-builder with `CSC_KEYCHAIN` and no `CSC_LINK`; removes keychain and profile on exit. The workflow step now only calls it, with `MAS_*` env and `BUILD_NUMBER`.
- Owner moved the updated workflow into `.github/workflows/` (afd0f71); the `apps/desktop/store-workflow/` folder is gone.
- **Same bug will hit `desktop.yml`** (getlitma.in downloads) once `CSC_LINK` / `CSC_KEY_PASSWORD` are set for Developer ID signing: give it the same treatment (or upgrade electron-builder) before adding those secrets.
- **Run #2 of Desktop store builds passed** (Mac App Store job green in 3m 45s; Microsoft Store skipped, Snap built but not uploaded, as expected). Still to check: the upload reached App Store Connect, and the TestFlight copy on a Mac (sign-in, `app://`, `/dict` fetch, export, print, backup folder in the sandbox).

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
