# Journals (branch `journals`)

Owner's ask: build claude/journals-plan.md (agreed with the owner) on the website, desktop and phone app, with MCP, help guide, en + ml strings and docs/changes. A Journals tab on the desk with journal cards, ‹ › between journals in the editor, Export of one or all journals, and no share link for journals.
Lead: Claude session 2026-11-28 · Started: 2026-11-28

Note: the plan file lives in the claude.ai project, which this session can't read. The decisions below are the owner's own words from the session brief (28 Nov). Anything the brief doesn't settle goes under Questions and to the owner with the mockups; nothing is guessed silently.

Builds on branch `notes-first` (Part 1): diary is called ജേണൽ · Journal in names, internal kind stays `diary`; the keep rule `keepOnClose` (shared `forms.ts`, phone `lib/data/forms.dart`).

## Decisions
- 2026-11-28 Internal kind stays `diary`; the UI says ജേണൽ · Journal (owner).
- 2026-11-28 Desk tabs: **Works · Books · Journals · Trash**; `?view=journals`. The Works view no longer lists kind `diary` (owner).
- 2026-11-28 Journal cards: the started date as a small calendar block, top left; last-edited date bottom right, only when it differs from the started date; an untitled journal shows its first line in bold as its title; month lines divide the list; empty state "Start your journal" (owner).
- 2026-11-28 A journal's title defaults to its started date (owner). "Started" = the work's `created_at`.
- 2026-11-28 Editor title bar for journals: ‹ title ›, with a "started · edited" line; ‹ and › open the journal started before / after (owner).
- 2026-11-28 Export dialog: This journal / All journals, a date range, a format (PDF, Word). All journals = one file, oldest first, with a contents page (owner).
- 2026-11-28 No share link for journals: hidden in every app, a database rule refusing shares for kind `diary`, and a migration revoking existing diary shares (owner approved).
- 2026-11-28 Journals can't be added to Books (owner).
- 2026-11-28 MCP: `create_document` makes journals, `list_documents` marks them, no share (owner).
- 2026-11-28 Order: designer mockups (phone 320/375/390, desktop 1440, light and dark) → owner's OK → web-dev and flutter-dev in parallel → designer review + tester → fixes → verifier with every CI check green → PR → merge (owner).

## Questions
- → owner (with the mockups): what counts as "untitled" for a journal whose title defaults to the started date: a title still equal to the date (or empty)?
- → owner: date range in Export: by started date (lead's proposal) or last edited?
- → owner: the existing "New entry" button inside a journal (adds today's date): keep it as is?

## Design spec (designer)

## Build (web-dev)

## Build (flutter-dev)

## Design review (designer)

## Tests (tester)

## Verification (verifier)
