# Google and Supabase setup for Litma

Everything the owner sets up by hand in **Google Cloud**, **Supabase** and **GitHub** for sign-in,
emails, the database and the Google Drive backup. Each part says what it is for, where to click and
how to check it. Do the parts in order the first time; later, use the checklist at the end.

| | |
|---|---|
| Website | https://getlitma.in |
| Supabase project | `jdexadomaxjtxlvgtldu` (https://jdexadomaxjtxlvgtldu.supabase.co) |
| GitHub repo | https://github.com/jayageetham-dotcom/Litma |
| Phone app id | `in.getlitma.litma` (Android and iOS), sign-in return address `in.getlitma.app://auth-callback` |
| Support mailbox | support@getlitma.in (replies), no-reply@getlitma.in (sending) |

How the pieces fit:

- **Sign in with Google** (website, desktop app, phone app) goes through **Supabase Auth**. Google
  sends the writer back to Supabase, and Supabase sends them back to Litma: the website's
  `/auth/callback/`, which the desktop app catches, or the phone app's `in.getlitma.app://auth-callback`.
  The phone needs no separate Google client.
- **Google Drive backup** (website only) uses the same Google client from the browser, with the extra
  `drive.file` permission. Nothing about Drive is stored on Litma's server.
- **Supabase** holds accounts, works and statistics, runs the Edge Functions and sends Litma's own
  emails through the Send Email hook.

---

## Essential links

**Google**
- Google Cloud console: https://console.cloud.google.com/
- Google Auth Platform (consent screen, clients, data access): https://console.cloud.google.com/auth/overview
- Credentials (OAuth clients): https://console.cloud.google.com/apis/credentials
- Google Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com
- Drive permissions explained: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- App verification help: https://support.google.com/cloud/answer/13463073
- Remove an app's access from your own account (for testing): https://myaccount.google.com/connections

**Supabase** (dashboard pages of this project)
- Project home: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu
- Sign-in providers: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/auth/providers
- URL configuration: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/auth/url-configuration
- Auth hooks (Send Email): https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/auth/hooks
- Edge Function secrets: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/functions/secrets
- Migrations: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/database/migrations
- SQL editor: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/sql/new
- Cron jobs: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/integrations/cron/jobs
- Database settings (password): https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/settings/database
- Your access tokens: https://supabase.com/dashboard/account/tokens
- Docs, Google sign-in: https://supabase.com/docs/guides/auth/social-login/auth-google
- Docs, redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Docs, Send Email hook: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- Docs, pg_cron: https://supabase.com/docs/guides/database/extensions/pg_cron

**GitHub**
- Secrets: https://github.com/jayageetham-dotcom/Litma/settings/secrets/actions
- Variables: https://github.com/jayageetham-dotcom/Litma/settings/variables/actions
- Actions (runs): https://github.com/jayageetham-dotcom/Litma/actions

---

## Part 1. Google Cloud: the project and the consent screen

The consent screen is what writers see when they press **Continue with Google**.

1. Open https://console.cloud.google.com/ and pick Litma's project at the top (or **New project**,
   name it "Litma").
2. Open **Google Auth Platform → Branding** (older consoles: **APIs & Services → OAuth consent screen**).
3. Fill in:
   - App name: `Litma`
   - User support email: support@getlitma.in
   - App logo: `apps/desktop/build/icon.png` (or a 120 × 120 copy of it)
   - App home page: `https://getlitma.in`
   - Privacy policy: `https://getlitma.in/privacy/`
   - Terms of service: `https://getlitma.in/terms/`
   - Authorised domains: `getlitma.in` and `jdexadomaxjtxlvgtldu.supabase.co`
   - Developer contact: your email
4. **Audience:** User type **External**. While testing, add your own Google accounts under **Test
   users**. When it works, choose **Publish app** so every writer can sign in.
5. **Data Access → Add or remove scopes**, tick:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   - `.../auth/drive.file` (only for the Drive backup in Part 4; harmless to add now)

   Click **Update**, then **Save**.
6. If Google asks for **verification**, submit it. Litma's permissions are all non-sensitive, so it is a
   basic check (branding, links, domain ownership), not a security audit. Google may ask you to prove
   you own getlitma.in in Google Search Console (https://search.google.com/search-console).

> Keep the Privacy Policy true to what is asked here. `apps/web/src/app/privacy/page.tsx` describes
> email, profile, openid and the optional `drive.file`; update it (and its date) if you ever add a scope.

## Part 2. Google Cloud: the web sign-in client

1. Open **Google Auth Platform → Clients** (older consoles: **APIs & Services → Credentials**).
2. If there is no **Web application** client yet: **Create client → Web application**, name it
   "Litma web". Otherwise open the existing one.
3. **Authorised JavaScript origins** (add each with **+ Add URI**):
   - `https://getlitma.in`
   - `http://localhost:3000` (local development)
   - `http://localhost:4173` (local preview)
4. **Authorised redirect URIs:**
   - `https://jdexadomaxjtxlvgtldu.supabase.co/auth/v1/callback`

   This is the only redirect Google needs: Supabase passes writers on to the website, desktop or phone.
5. Click **Save**. Copy the **Client ID** and the **Client secret**; Part 3 needs both, Part 4 the ID.

## Part 3. Supabase: sign-in

### 3.1 Turn on Google

1. Open https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/auth/providers → **Google**.
2. Switch **Enable Sign in with Google** on.
3. Paste the **Client ID** and **Client secret** from Part 2.
4. Check that the **Callback URL** shown is `https://jdexadomaxjtxlvgtldu.supabase.co/auth/v1/callback`
   (the same as in Part 2, step 4). Click **Save**.

### 3.2 Where writers may be sent back to

1. Open https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/auth/url-configuration
2. **Site URL:** `https://getlitma.in`
3. **Redirect URLs** (add each):
   - `https://getlitma.in/**`
   - `in.getlitma.app://auth-callback` (the phone app)
   - `http://localhost:3000/**` (local development)
   - `https://www.jayageetham.com/litma/**` (desktop apps from before the move; it redirects)
4. Click **Save**.

### 3.3 Sign in with Apple (phone app, App Store rule)

Apple requires it once Google sign-in is offered in an iPhone app.

1. Apple Developer → Certificates, Identifiers & Profiles → the App ID `in.getlitma.litma` → tick
   **Sign in with Apple** → Save.
2. Supabase → Providers → **Apple** → enable, and add `in.getlitma.litma` to **Client IDs**. Save.
   The app shows Apple's own sheet and sends Apple's token to Supabase; no secret key is needed for
   that native flow.

### 3.4 Check sign-in

1. Open https://getlitma.in/login/ in a private window → **Continue with Google** → pick an account.
2. You should land on the desk, signed in.
3. Desktop app: **Continue with Google** opens the browser and comes back into the app.
4. Phone app: **Continue with Google** opens a browser sheet and returns to the app.

### 3.5 Stop automated sign-ups (CAPTCHA and leaked passwords, free)

Litma's apps already know how to show the human check; it starts working once you turn it on here.
Until then nothing changes for writers.

1. **Cloudflare Turnstile** (free, no Cloudflare hosting needed): https://dash.cloudflare.com/?to=/:account/turnstile
   → **Add widget**. Name `Litma`, hostname `getlitma.in`, widget mode **Managed**. Copy the **Site
   key** and the **Secret key**.
2. **GitHub → Settings → Secrets and variables → Actions → Variables** → add `TURNSTILE_SITE_KEY`
   with the site key. Push or re-run the deploy, so getlitma.in/captcha/ has the key. Open
   https://getlitma.in/captcha/ to check: a small Cloudflare box should appear.
3. **Supabase → Authentication → Attack Protection**
   (https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/auth/protection):
   - **Enable Captcha protection** → provider **Turnstile by Cloudflare** → paste the **Secret key** → Save.
     Do this only after step 2 is live, or sign-in stops working.
   - **Prevent use of leaked passwords** → on (checks new passwords against HaveIBeenPwned).
4. Try it: sign in at getlitma.in in a private window. A "Quick security check" box appears for a
   moment, then you are in. The desktop app shows the same box (it loads getlitma.in/captcha/), and the
   phone app shows it in a sheet. Google and Apple sign-in never ask for it.

To switch CAPTCHA off again, untick it in Supabase; the apps stop asking straight away.

## Part 4. Google Drive backup (website, optional, free)

Writers get **Settings → Backup → Save to Google Drive**. Litma only sees the files it makes (a
"Litma backup" folder). The button stays hidden until step 4.

1. Enable the Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com → **Enable**
   (same project as Part 2).
2. Make sure `https://getlitma.in` is in the web client's **Authorised JavaScript origins** (Part 2, step 3).
3. Make sure `.../auth/drive.file` is in **Data Access** (Part 1, step 5), and submit verification if
   Google asks.
4. GitHub → **Variables** (https://github.com/jayageetham-dotcom/Litma/settings/variables/actions) →
   **New repository variable**: name `GOOGLE_CLIENT_ID`, value the Client ID from Part 2.
5. Redeploy: push to `main`, or **Actions → Deploy Litma → Run workflow**.
6. Check: https://getlitma.in → Settings → Backup → **Save to Google Drive** → choose your account →
   a zip appears in **Litma backup** in https://drive.google.com.

The desktop app doesn't use this: it backs up daily into a folder (pick the Google Drive for desktop
folder to reach Drive). The phone app saves through the share sheet (choose Drive there).

## Part 5. Supabase: database, Edge Functions and the GitHub connection

Pushing to `main` deploys the Edge Functions and applies migrations, once GitHub can reach Supabase.

1. Make an access token: https://supabase.com/dashboard/account/tokens → **Generate new token**
   ("Litma GitHub"). Copy it.
2. Database password: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/settings/database
   (reset it there if you don't have it).
3. GitHub → **Secrets** (https://github.com/jayageetham-dotcom/Litma/settings/secrets/actions) →
   **New repository secret**:
   - `SUPABASE_ACCESS_TOKEN` = the token from step 1
   - `SUPABASE_DB_PASSWORD` = the password from step 2
4. Push, then open **Actions → Deploy Litma**. The job **Edge Functions & database** should be green.
   It deploys `litma-transliterate`, `litma-mcp`, `litma-ai`, `litma-track`, `litma-admin`, `litma-account` and
   `litma-send-email`, and runs `supabase db push`. Last, it builds the spelling engine's data from
   mlmorph on PyPI and deploys `litma-spell` with Docker (`--use-docker`, the data is over 5 MB). That
   step may fail without stopping the others; the editor then uses its own spelling checks. Check it at
   https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/functions (litma-spell listed).
5. Check the migrations: https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/database/migrations
   should list `writing_stats_retention` (Nov 2026) among the others.
6. Check the nightly statistics clean-up (statistics are kept 90 days):
   https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/integrations/cron/jobs should show
   `litma-prune-statistics` at `40 21 * * *` (03:10 India time) and `litma-prune-community` at
   `50 21 * * *` (03:20 India time; deletes community posts 180 days after they were deleted or
   removed, from migration `community`, Nov 2026). Or in the SQL editor:

   ```sql
   select jobname, schedule, active from cron.job;
   ```

## Part 6. Supabase: Edge Function secrets

Open https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/functions/secrets. `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are there already (Supabase adds them).

| Name | Needed | Value |
|---|---|---|
| `SEND_EMAIL_HOOK_SECRET` | yes, for emails | from Part 7, starts `v1,whsec_` |
| `SMTP_PASSWORD` | yes, for emails | the password of no-reply@getlitma.in (cPanel → Email Accounts) |
| `LITMA_KEYS_SECRET` | recommended | a long random text; encrypts writers' AI keys. Set it once and never change it, or saved keys stop working |
| `LITMA_SITE_URL` | no | leave unset (defaults to `https://getlitma.in`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` | no | defaults `mail.getlitma.in`, `465`, `no-reply@getlitma.in` |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | no | defaults `Litma <no-reply@getlitma.in>`, `support@getlitma.in` |
| `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL` | no | only to change the AI companion's default models |

There are **no** shared AI keys on the server: every writer adds their own in Settings.

> Make a random secret with `openssl rand -base64 48` in Terminal.

## Part 7. Supabase: Litma's own emails (Send Email hook)

Sign-in, password and email-change emails go out from no-reply@getlitma.in through the
`litma-send-email` function, not Supabase's mailer (Gmail marked those as spam).

1. Open https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/auth/hooks → **Add a new hook →
   Send Email hook**.
2. Type **HTTPS**, URL `https://jdexadomaxjtxlvgtldu.supabase.co/functions/v1/litma-send-email`.
3. Click **Generate secret**, copy it (`v1,whsec_…`), and save the hook.
4. Put that secret in Edge Function secrets as `SEND_EMAIL_HOOK_SECRET`, and the mailbox password as
   `SMTP_PASSWORD` (Part 6).
5. Check: https://getlitma.in/forgot-password/ → your email → the email arrives from Litma
   <no-reply@getlitma.in>, and its link opens a "Choose a new password" page.

The email designs come from `node scripts/build-email-templates.mjs`. With the hook on, the dashboard's
own templates and SMTP settings are not used; keep them as a fallback. Don't run
`supabase config push` until the rest of `[auth]` is written in `supabase/config.toml`.

## Part 8. Admin dashboard access

After Part 5 has run, give yourself the owner's dashboard at https://getlitma.in/admin/. In the SQL
editor (https://supabase.com/dashboard/project/jdexadomaxjtxlvgtldu/sql/new):

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'you@example.com';
```

Settings then shows the Admin dashboard link to that account. The same row makes that account a
moderator of Litma Community (getlitma.in/community/): a **Moderate** menu on every post, and
**Reports** on the community page for the reports queue. Add your community moderators the same way
(they also see the admin dashboard).

Admins can also block a writer (for some days or for good) or delete an account from **/admin/ →
Writers → a writer → Account**. Admin accounts can't be blocked or deleted there. Every action is
kept in the `admin_actions` table (migration `20261113120000_admin_moderation`).

## Part 9. Connect AI assistants (MCP), for writers

Nothing to set up on Google or Supabase. Each writer makes a token in **Settings → Connect AI
assistants**; cloud assistants (Claude.ai, ChatGPT) use the direct address Settings shows, because the
web host's firewall blocks data-centre callers on `getlitma.in/mcp`.

---

## Part 10. App Store and Google Play (phone app), and Mac signing

The phone app's bundle id is `in.getlitma.litma` on both stores. Store builds run in Actions →
**Mobile store builds** (and from **Release**). Each platform is skipped with a warning until its
secrets exist. All secrets below go in GitHub → the Litma repo → Settings → Secrets and variables →
Actions → **New repository secret**.

### 10.1 Apple: the App ID and Sign in with Apple

1. [developer.apple.com/account](https://developer.apple.com/account) → Membership details: copy the
   **Team ID** (10 letters and digits). Add it as secret `APPLE_TEAM_ID` (the Mac desktop signing
   uses the same secret).
2. Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App → Bundle ID
   **Explicit** `in.getlitma.litma`, description "Litma". Tick **Sign in with Apple**. Register.
3. Supabase → Authentication → Providers → **Apple**: enable, Client IDs `in.getlitma.litma`
   (Part 3.3).

### 10.2 Apple: the app in App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Apps → **+** → New App: iOS,
   name "Litma" (if taken, for example "Litma Malayalam Writing"), primary language Malayalam or
   English, bundle id `in.getlitma.litma`, SKU `litma-ios`.
2. Users and Access → **Integrations** → App Store Connect API → Team Keys → **+**: name "GitHub",
   access **Admin** (Admin lets Xcode create the distribution certificate on GitHub's Mac). Download
   the `.p8` file (only once). Note the **Key ID** and the **Issuer ID** at the top of the page.
3. Secrets: `ASC_KEY_ID` (Key ID), `ASC_ISSUER_ID` (Issuer ID), `ASC_KEY_P8_BASE64`: on the Mac
   run `base64 -i AuthKey_XXXX.p8 | pbcopy` and paste.
4. Run Actions → **Mobile store builds**. The build appears in App Store Connect → TestFlight after
   10 to 30 minutes. Answer the export compliance question (Litma uses only standard encryption:
   HTTPS).
5. Before review: App Privacy (data types match `/privacy/`: email, name, writing, usage
   statistics that you can switch off; no tracking), privacy policy URL
   `https://getlitma.in/privacy/`, support URL `https://getlitma.in/help/`, screenshots for 6.9"
   and 13" iPad (the screenshots job's pictures can help), and a **demo account** for the reviewer
   (Apple asks for one when an app needs sign-in).

### 10.3 Google Play

1. [play.google.com/console](https://play.google.com/console) → **Create app**: name "Litma",
   default language, App, Free. Accept the declarations.
2. The upload key, on the Mac (keep the `.jks` file and both passwords somewhere safe; a lost
   upload key can be reset through Play support, but it takes days):
   ```sh
   keytool -genkey -v -keystore ~/litma-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   base64 -i ~/litma-upload.jks | pbcopy
   ```
   Secrets: `ANDROID_KEYSTORE_BASE64` (paste), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`
   (`upload`), `ANDROID_KEY_PASSWORD` (the same as the store password if you pressed Enter).
3. Run Actions → **Mobile store builds**. The run attaches `litma-android` (`app-release.aab`).
   The **first** upload must be by hand: Play Console → Testing → Internal testing → Create new
   release → upload that `.aab` (this also turns on Play App Signing). Google sign-in in the phone
   app goes through the browser, so no SHA-1 fingerprint is needed.
4. Automatic uploads after that: Google Cloud → IAM & Admin → Service Accounts → create
   "play-upload" → Keys → Add key → JSON. Enable the **Google Play Android Developer API** in the
   same Cloud project. Play Console → Users and permissions → Invite new users → the service
   account's email → app permission for Litma with **Release to testing tracks** (and production
   when you want it). Secret `PLAY_SERVICE_ACCOUNT_JSON`: the whole JSON file.
5. App content in Play Console: privacy policy `https://getlitma.in/privacy/`, **Data safety** (as
   in 10.2 step 5), account deletion URL `https://getlitma.in/help/delete-account/`, app access
   (the demo account), content rating, target audience (not for children).
6. A **personal** developer account made after November 2023 must run a closed test with at least
   12 testers for 14 days before it may publish to production. An organisation account doesn't.

### 10.4 After the apps are live

- Put the store links in `STORE_LINKS` (`apps/web/src/lib/release.ts`) and the `mobile` block of
  `latest.json` (`ios`, `android`), so the website's "Coming soon" buttons become real.
- Each Actions → **Release** sends the phone build to TestFlight and Play internal testing; you
  promote it to the stores from App Store Connect and Play Console.

### 10.5 Mac desktop app: signing and notarisation (optional, same Apple account)

Without it, the first launch of the Mac app needs right-click → Open.

1. developer.apple.com → Certificates → **+** → **Developer ID Application** (if asked, the **G2
   Sub-CA**) → upload a certificate request made with Keychain Access (as in 11.1, step 2) → Download →
   double-click it.
2. Keychain Access → login → My Certificates → right-click the **certificate** row **Developer ID
   Application: … (D9U998359G)** (not the key under it) → Export as `.p12` with a password. Then
   `base64 -i ~/Downloads/<file>.p12 | pbcopy`. Secrets: `CSC_LINK` (paste), `CSC_KEY_PASSWORD`.
3. [account.apple.com](https://account.apple.com) → Sign-In and Security → App-Specific Passwords →
   make one called "Litma notarise". Secrets: `APPLE_ID` (your Apple ID email),
   `APPLE_APP_SPECIFIC_PASSWORD`. `APPLE_TEAM_ID` is already set (10.1).
4. The next Actions → **Release** builds a signed, notarised Mac app. The macOS step signs from a
   keychain made by `apps/desktop/scripts/mac-keychain.sh` (electron-builder 25.1.8 can't unlock its
   own); if the certificate is wrong, its log says which secret to check. Then delete the `.p12`.

## Part 11. The desktop app in the Mac App Store, Microsoft Store and Snap Store

The downloads from getlitma.in stay as they are (Release → **Desktop app**). The store packages come
from a separate workflow, **Desktop store builds**, which Release runs on every new version (tick **stores**, on by default). Each store is skipped with a warning
until its secrets exist. A store copy is updated by its store, so Litma's own update card stays off in it.

### 11.0 The workflow

The workflow is `.github/workflows/desktop-stores.yml` (Actions → **Desktop store builds**). Release calls it, so the Mac App Store build reaches TestFlight with each version, numbered like the phone builds (the Release run number). Run by hand only to rebuild: then fill **build_number** with a number above the last macOS build in TestFlight, or the upload is refused. The Mac App Store step runs `apps/desktop/scripts/build-mas.sh`.

### 11.1 Mac App Store (same listing as the iPhone app)

1. App Store Connect → **Litma: Malayalam Writing** → **Add Platform** → **macOS**. The Mac app uses
   the same ID, `in.getlitma.litma`, so it shares the listing.
2. Make a certificate request in Keychain Access (as in 10.5, step 1).
3. [developer.apple.com → Certificates](https://developer.apple.com/account/resources/certificates/list)
   → **+** → **Apple Distribution** → upload the request → download → double-click it. Keychain
   Access → My Certificates → **Apple Distribution: …** → Export as `mas-app.p12` (in your home
   folder) with a password. Secrets: `MAS_CSC_LINK` (`base64 -i ~/mas-app.p12 | pbcopy`) and
   `MAS_CSC_KEY_PASSWORD`.
4. **+** again → **Mac Installer Distribution** → same steps → `mas-installer.p12`. Secrets:
   `MAS_INSTALLER_CSC_LINK`, `MAS_INSTALLER_CSC_KEY_PASSWORD`.
5. **Profiles** → **+** → Distribution: **Mac App Store Connect** → App ID `in.getlitma.litma` → the
   Apple Distribution certificate → name it `Litma Mac App Store` → download. Secret
   `MAS_PROVISION_PROFILE_BASE64`: `base64 -i ~/Downloads/Litma_Mac_App_Store.provisionprofile | pbcopy`
   (move it to your home folder first if Terminal can't read Downloads).
6. Actions → **Desktop store builds** → Run workflow. The upload uses the App Store Connect key the
   phone builds already use (`ASC_*`). If the upload step fails, download `litma-mac-app-store` from
   the run and send the `.pkg` with Apple's **Transporter** app.
7. In App Store Connect, the macOS version needs its own screenshots (for example 2880 × 1800), then
   pick the build and submit. The Mac app runs in Apple's sandbox: check sign-in, saving, export and
   the backup folder in TestFlight for Mac before submitting.

### 11.2 Microsoft Store

1. [Partner Center](https://partner.microsoft.com/dashboard) → sign up as an individual developer
   (the sign-up page shows any fee).
2. **Apps and games** → **New product** → **MSIX or PWA app** → reserve the name **Litma**.
3. The product → **Product identity**: copy three values into GitHub → Settings → Secrets and
   variables → Actions → **Variables** tab (not secrets):
   - `MSSTORE_IDENTITY_NAME` ← Package/Identity/Name
   - `MSSTORE_PUBLISHER` ← Package/Identity/Publisher (starts with `CN=`)
   - `MSSTORE_PUBLISHER_DISPLAY_NAME` ← Package/Properties/PublisherDisplayName
4. Run **Desktop store builds**, download `litma-microsoft-store` from the run (two `.appx` files, x64
   and arm64), and upload both in the submission's **Packages** page. The Store signs them.
5. Fill the listing (description, screenshots, privacy policy `https://getlitma.in/privacy/`, age
   rating questionnaire) and submit. Later versions: run the workflow after each Release and upload the
   new packages; a new submission needs a higher version, which Release gives.

### 11.3 Snap Store (Linux)

1. Sign in at [snapcraft.io](https://snapcraft.io) (Ubuntu One account) and register the name
   **litma** ([snapcraft.io/register-snap](https://snapcraft.io/register-snap)).
2. On your Mac: `brew install snapcraft`, then
   `snapcraft export-login --snaps=litma --channels=stable --acls=package_access,package_push,package_update,package_release litma-snap.txt`
   and sign in when asked. Secret `SNAPCRAFT_STORE_CREDENTIALS`: the whole content of `litma-snap.txt`
   (then delete the file).
3. Run **Desktop store builds**. The snap is built on every run (download `litma-snap` to try it) and
   uploaded to the **stable** channel when the secret exists.
4. On snapcraft.io → **litma** → **Listing**: icon, screenshots, description, then make it public.

### 11.4 After they're live

Put the store links on the website's download page (`STORE_LINKS` in `lib/release.ts`, shown by `components/StoreBadges.tsx`)
and in the desktop help guide.

## Checklist

- [ ] Google consent screen: name, logo, links, domains, scopes (email, profile, openid, drive.file), published
- [ ] Google web client: JavaScript origins, Supabase redirect URI
- [ ] Supabase Google provider: client ID and secret
- [ ] Supabase URL configuration: Site URL and the four redirect URLs (incl. the phone's)
- [ ] Apple: Sign in with Apple for `in.getlitma.litma`, Supabase Apple provider
- [ ] GitHub secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`; deploy job green; migrations listed
- [ ] Cron jobs `litma-prune-statistics` and `litma-prune-community` active
- [ ] Edge Function secrets: `SEND_EMAIL_HOOK_SECRET`, `SMTP_PASSWORD`, `LITMA_KEYS_SECRET`
- [ ] Send Email hook on; password email arrives
- [ ] Drive backup: Drive API on, GitHub variable `GOOGLE_CLIENT_ID`, button works
- [ ] Your account in `app_admins`
- [ ] Turnstile widget, GitHub variable `TURNSTILE_SITE_KEY`, then Supabase Captcha protection on (3.5)
- [ ] Supabase "Prevent use of leaked passwords" on (3.5)
- [ ] Apple: App ID `in.getlitma.litma` with Sign in with Apple; secret `APPLE_TEAM_ID` (10.1)
- [ ] App Store Connect app and API key; secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`; build in TestFlight (10.2)
- [ ] Play Console app; upload key secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; first `.aab` uploaded by hand (10.3)
- [ ] Play service account; secret `PLAY_SERVICE_ACCOUNT_JSON` (10.3)
- [ ] Store links in `STORE_LINKS` and `latest.json` once the apps are live (10.4)
- [ ] Mac desktop signing: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (10.5)
- [ ] Desktop store workflow moved into `.github/workflows/` (11.0)
- [ ] Mac App Store: macOS platform added; secrets `MAS_CSC_LINK`, `MAS_CSC_KEY_PASSWORD`, `MAS_INSTALLER_CSC_LINK`, `MAS_INSTALLER_CSC_KEY_PASSWORD`, `MAS_PROVISION_PROFILE_BASE64` (11.1)
- [ ] Microsoft Store: Partner Center app; variables `MSSTORE_IDENTITY_NAME`, `MSSTORE_PUBLISHER`, `MSSTORE_PUBLISHER_DISPLAY_NAME`; first packages uploaded by hand (11.2)
- [ ] Snap Store: name `litma` registered; secret `SNAPCRAFT_STORE_CREDENTIALS` (11.3)

## When something goes wrong

| What you see | Where to look |
|---|---|
| Google: **Error 400: redirect_uri_mismatch** | Part 2, step 4: the redirect URI must be exactly `https://jdexadomaxjtxlvgtldu.supabase.co/auth/v1/callback` |
| Google: **Error 400: origin_mismatch** (Drive button) | Part 2, step 3: add `https://getlitma.in`, no slash at the end |
| Google: **access_denied** or "app not verified" | Part 1: add yourself as a test user, or publish and verify the app |
| After Google, you land on the home page instead of the desk | Part 3.2: Site URL and `https://getlitma.in/**` |
| Phone app stays in the browser after Google | Part 3.2: `in.getlitma.app://auth-callback` in Redirect URLs |
| "Email link is invalid or has expired" | Part 7: the hook must be on (its links work in any browser) |
| No emails at all | Part 6: `SMTP_PASSWORD`, `SEND_EMAIL_HOOK_SECRET`; Supabase → Edge Functions → `litma-send-email` → Logs |
| Deploy job says "No SUPABASE_ACCESS_TOKEN secret" | Part 5, step 3 |
| Goals page shows no minutes or hours | Part 5, step 5: the `writing_stats_retention` migration hasn't run |
| Writers' saved AI keys stopped working | `LITMA_KEYS_SECRET` was changed; set it back, or writers add their keys again |
| iOS store build: "No Accounts" or "No signing certificate" | 10.2 step 2: the API key needs the **Admin** role, and `APPLE_TEAM_ID` must be the paid team's id |
| Play upload: "Package not found" | 10.3 step 3: upload the first `.aab` by hand |
| No **Save to Google Drive** button | Part 4, steps 4 and 5: the variable, then a new deploy |
