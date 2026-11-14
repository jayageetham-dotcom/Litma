# Desktop store builds: workflow update waiting to be moved

`desktop-stores.yml` here is the updated workflow for Actions → **Desktop store builds**. Its Mac App
Store step now runs `apps/desktop/scripts/build-mas.sh` (electron-builder 25.1.8 couldn't unlock the
keychain it made from `CSC_LINK`). It belongs in `.github/workflows/`, which only the owner writes to:

```sh
cd ~/Documents/Litma
mv apps/desktop/store-workflow/desktop-stores.yml .github/workflows/desktop-stores.yml
git add -A apps/desktop/store-workflow .github/workflows/desktop-stores.yml
git commit -m "Desktop store builds: sign the Mac App Store copy with build-mas.sh" && git push
```

After that this folder holds only this note and can be deleted. Setup for each store:
`docs/setup/google-and-supabase.md`, Part 11.
