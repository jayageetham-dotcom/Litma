# Litma desktop (Electron)

The same Litma as the website, as an app for macOS and Windows. The web app is built with an empty base path and bundled into the installer; the window serves it from the private `app://litma/` origin, so it opens instantly and keeps working offline (writing is journalled locally and synced when the connection is back). Dictionary data is fetched from the website on demand instead of being bundled (it is over 100 MB).

## Run it locally

```bash
npm install                              # at the repo root (npm workspaces)
npm run desktop                          # builds the web app for the desktop, then starts Electron
```

## Build installers

```bash
npm run desktop:dist                     # current OS: release/Litma-mac.dmg or release/Litma-win.exe
```

CI does this for both platforms: push a tag like `desktop-v0.1.0` (or run the **Desktop app** workflow by hand). `.github/workflows/desktop.yml` builds the web app once, packages it on macOS and Windows runners, attaches the installers to a GitHub release and uploads `latest.json` to getlitma.in/downloads/ (add/replace only). The home page reads `downloads/latest.json` and shows the download buttons.

## Publishing

The installers (100–200 MB each) don't fit the web host's disk quota, so they are published on **GitHub Releases of a small public repository**, `jayageetham-dotcom/litma-releases` (no code in it, only downloads). The website keeps just `downloads/latest.json`, which points to them. One-time setup:

1. On GitHub, create a new **public** repository named `litma-releases` (tick "Add a README" so it isn't empty).
2. Create a fine-grained token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate. Repository access: only `litma-releases`. Permissions: **Contents: Read and write**. Pick an expiry you're happy with.
3. In the Litma repository: Settings → Secrets and variables → Actions → New repository secret, name `RELEASES_TOKEN`, value the token.

To use another repository name, add a repository variable `RELEASES_REPO` (e.g. `owner/name`).

## Signing

Without certificates the installers are unsigned:

- **macOS**: first launch needs right-click → Open (or System Settings → Privacy & Security → Open Anyway). To sign and notarize, add repository secrets `CSC_LINK` (base64 .p12 of a Developer ID Application certificate), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- **Windows**: SmartScreen shows "More info → Run anyway". Add `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` for a code-signing certificate.

## How sign-in works

Email and password sign-in happens in the app. Google sign-in opens in the app window too; Supabase sends the browser back to the website's `/auth/callback/` (getlitma.in, or the old jayageetham.com/litma address for apps from before the move), which the app intercepts and finishes on `app://litma/auth/callback/`, so the session is stored in the app. Links in emails (confirm, reset password) open in your browser.
