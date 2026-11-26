# Litma Malayalam Keyboard

A separate Litma product: a Malayalam keyboard for the whole phone (WhatsApp, Instagram, Notes, Litma itself), with its own App Store and Google Play listings. Plan and owner decisions: the claude.ai project doc `claude/feature-roadmap.md`.

## Decided (owner, 26 Nov 2026)

- Separate app, **fully offline**, **native** to each platform (not Flutter: iOS keyboard extensions have a tight memory limit).
- v1: Manglish → Malayalam with the ranked suggestion strip, a Malayalam (InScript-style) layout, handwriting, spelling suggestions, remembered picks, light/dark.
- Used together with the Litma app it brings more: Story World names and personal words in the strip, and handwriting and voice inside Litma. iOS keyboards can't use the microphone at all, so voice on iPhone lives in the apps, never in the keyboard.
- No typed text leaves the phone. The keyboard must work with no network and without iOS "Full Access".

## Layout

| Folder | What |
|---|---|
| `android/` | Kotlin `InputMethodService` app (Gradle). Not created yet. |
| `ios/` | Swift keyboard extension + small container app; `project.yml` for XcodeGen (no `.xcodeproj` committed). Not created yet. |
| `data/` | Engine data, not committed: `manglish-words.txt` from `scripts/build-manglish-words.mjs`, downloaded by CI from the **Engine data** workflow. Bundled into both apps. |

## Shared with Litma

- Manglish ranking must give the same answers as `packages/shared/src/manglish-rank.ts` (web) and `apps/mobile/lib/core/manglish_rank.dart` (phone). The Swift and Kotlin ports get the same vector tests (`apps/mobile/test/manglish_vectors.json`) and the Dakshina / 300-word Google checks (71.9% first right).
- The InScript layout comes from `packages/keyboards`.
- Sharing with the Litma app: iOS App Group, Android content provider (Story World names, remembered picks, kept words).

## CI and releases

- `.github/workflows/keyboard.yml` runs only on changes here, to the Manglish engine or the word list builder. Each platform job does nothing until its project exists.
- Versions are the keyboard's own: tags `keyboard-vX.Y.Z`. Litma's Release (`release.yml`, tags `vX.Y.Z`) never touches this folder, and pushes here never deploy getlitma.in.
- Store builds (TestFlight, Play) come in a later `keyboard-release.yml`, with their own bundle ids under the same developer accounts.
