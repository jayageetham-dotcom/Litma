# Interaction and keyboard audit, every app (branch `claude/interaction-audit`)

Owner's ask (26 Nov 17:33, on phone 0.7.33): "I selected a word and clicked outside which doesnt deselect the word. I need the tester agent to test all these events, interactions, keyboard accessibility and all across app in different features."
Lead: Claude session (claude.ai/code) · Started: 2026-11-26

## Decisions
- 2026-11-26 Lead fixed the reported bug first: `tapPaper` (apps/mobile/lib/editor/editor_screen.dart) now calls `session.clearSpan()`; before, `clearSpan` was never called anywhere, so a tap below the text on the already-focused line kept the highlight, handles and bar.
- 2026-11-26 The owner asked the lead to merge its own branches once tested.

## Questions


## Design spec (designer)
Where it lives on desktop and phone, every state, exact strings (en + ml), components and tokens.

## Build (web-dev)
Shared engine, web/desktop, MCP, Edge Functions. Files changed, checks run, what the phone must mirror.

## Build (flutter-dev)
Phone port, vector tests, CI run id.

## Build (keyboard-dev)
Only when the keyboard is involved.

## Design review (designer)
Screenshots (paths), concrete fixes, status of each.

## Tests (tester)
What was tested, false-alarm rate on real writing, failures with steps, status of each.

## Verification (verifier)
Checklist result, CI status, verdict: MERGE / DON'T MERGE, blocking issues.
