# ADR-0013 — A baseline of what existing code does

**Status:** Accepted (2026-11-19)

## Context
In an existing codebase, a new spec has to say what changes, but nobody has written down what the code
does today. Without that, agents guess, and a guess can quietly break existing behaviour.

## Decision
- **`spec-miner`**, a helper on the `strongest` tier, reads existing code and records **what it does
  today, never what it should do**, as Given/When/Then blocks: requirements (`BR1.1`) and invariants
  (`BI1`). Every block has `file:line` evidence and a `Sure: high · medium · low`; uncertain points go
  in their own section.
- Output: `specs/baseline/<area>.md` (template: `templates/baseline.md`) and a list of the mined areas
  in `specs/baseline/index.md`. The spec-miner may write nothing else. (A helper report named
  `report.md` is refused by Claude Code, so the summary has another name.)
- **Setup offers it** only when the repository already has code and no baseline yet, with the areas to
  choose from and the cost (one helper run per area). The user may decline; it can run later.
- **Baselines are a record:** features **link** to the baseline ids they change (section "Baseline it
  changes" in the spec), and never copy or edit them.
- Given/When/Then is the one criteria format everywhere, baselines included.

## Consequences
- Specs for existing projects start from evidence instead of assumptions.
- Mining costs usage once per area; the baseline goes stale for areas changed later, which the
  "Baseline it changes" links make visible.

**Replaces internal records:** D50 (spec-miner step), B7, B34, B47.
