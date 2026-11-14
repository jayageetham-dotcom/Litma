# Signed Mac download: workflow update waiting to be moved

`desktop.yml` here is `.github/workflows/desktop.yml` with one change: the macOS step sources
`apps/desktop/scripts/mac-keychain.sh` before electron-builder when `CSC_LINK` is set (electron-builder
25.1.8 can't unlock the keychain it makes itself). Only the owner writes `.github/workflows/`:

```sh
cd ~/Documents/Litma
mv apps/desktop/download-workflow/desktop.yml .github/workflows/desktop.yml
git rm -q apps/desktop/download-workflow/README.md
git add .github/workflows/desktop.yml
git commit -m "Desktop app: sign the Mac download with mac-keychain.sh" && git push
```

Then add the secrets (`docs/setup/google-and-supabase.md` 10.5) and run Actions → **Release**.
