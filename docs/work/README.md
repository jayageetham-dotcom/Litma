# Work files: how Litma's agents coordinate

One file per feature or branch: `docs/work/<branch>.md`, copied from `TEMPLATE.md` by the lead session when work starts. It is the team's shared board: every agent reads the whole file before starting and writes its hand-over into its own section before finishing. Agents don't talk to each other directly; the lead session passes the file (and anything new in it) to the next agent.

Rules
- Read the whole file first. Decisions already made there stand unless you raise a question.
- Write facts others can act on: files and functions, test names, exact inputs that fail, screenshots' paths. No "looks fine".
- Disagree in the open: add a line under **Questions** addressed to a role (`→ designer: …`). The lead decides or asks the owner, then records the answer under **Decisions**.
- Loops: designer review and tester failures go back to the dev who owns the code; after a fix the same reviewer checks again. The verifier is last and runs once more after any blocking fix.
- Keep it short. When the branch is merged the lead moves the useful parts into `docs/changes/` and deletes the work file.
