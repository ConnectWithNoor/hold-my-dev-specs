# ADR-0012 — Learning through a retro with user-approved lessons

**Status:** Accepted (2026-11-19)

## Context
The same mistakes repeat across features unless someone writes the lesson down. Automatic "learning"
that changes rules in the background is hard to trust and hard to undo.

## Decision
- The **`retro` skill** looks back on a feature: the ledger, the reports, and the user's corrections.
  It proposes **at most five lessons** in a fixed shape (When · Do · Why · Sure), and only lessons that
  would change what someone does next time.
- **Nothing is written without the user's yes.** Each lesson can be accepted, edited or skipped.
  Accepted lessons go into the project's `CLAUDE.md`. A lesson the user has seen in two or more projects
  is offered for their global instructions, which the retro writes only after a separate yes.
- **Break-loop analysis first** when the fix-round cap was hit or a bug got past the verifier: what went
  wrong (with `file:line`), **one** root cause (missing spec · cross-layer contract · change propagation ·
  test gap · implicit assumption), why the earlier fixes failed, how to prevent it, and similar places
  (checked, not guessed). It analyses and proposes; a fix is new work through the `feature` skill.
- An **active** feature's locked spec changes through `revoke`. A **done** feature's documents stay as
  they are (a record); a correction becomes a new feature that names the criterion it replaces.
- The retro **runs no tests**: it reads the records. It **commits** what it wrote on
  `chore/retro-<feature>` and merges as the project's settings say, or tells the user clearly which
  files are uncommitted.

## Consequences
- Lessons are few, specific and traceable to evidence.
- No background observer and no separate lesson store.

**Replaces internal records:** D40 (adapted "instincts"), D43, D65 (break-loop), B17, B46, B50 (f).
