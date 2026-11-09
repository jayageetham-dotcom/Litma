# Instagram posters

Finished Litma posters, made in Figma with the `litma-instagram-poster` skill.

- `<date>-<slug>_1080.png`: the file to post. Exactly 1080 px wide, so Instagram keeps it untouched.
- `<date>-<slug>_master@3x.png`: 3240 px wide master for print, ads or re-cropping.

Only these two kinds of file are kept here (see `.gitignore`). The working files stay out of the repo.
Commits here never redeploy the website (`deploy.yml` ignores `marketing/**`).
