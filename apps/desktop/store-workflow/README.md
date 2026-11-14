# Desktop store builds: the workflow file

`desktop-stores.yml` here is the GitHub Actions workflow for the desktop app's store packages
(Mac App Store, Microsoft Store, Snap Store). It belongs in `.github/workflows/`, which only the owner
writes to (workflows run with the repository's secrets). Move it there once:

```sh
cd ~/Documents/Litma
git mv apps/desktop/store-workflow/desktop-stores.yml .github/workflows/desktop-stores.yml
git commit -m "Add the desktop store builds workflow"
```

Then this folder (and this note) can go. Setup for each store: `docs/setup/google-and-supabase.md`, Part 11.
