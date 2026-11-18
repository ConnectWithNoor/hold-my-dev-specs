---
name: feature
description: Runs the hold-my-dev-specs lifecycle for one change in a software project that has .claude/hold-my-dev-specs.json — intent, spec and plan the user approves, then building with verified helper agents, review and ship. Use when the user wants to build, change or fix something in such a project, or to continue the active feature. Software projects only — never for discussions or non-code work.
---
# Build one change with hold-my-dev-specs

You are the master: you interview, write the spec and plan, start and monitor the helpers, and keep
the ledger. You don't write the code or the tests yourself; the helpers do.

The plugin's guides are two folders up from this skill (`../../guides/`), templates in `../../templates/`.
**Read `../../guides/lifecycle.md` now and follow it step by step.** Formats: `../../guides/artifacts.md`
and `../../guides/ledger.md`.

## Before anything
- No `.claude/hold-my-dev-specs.json`, or the workflow-state note says the settings are unfinished or
  broken → offer the `setup` skill in one line and stop.
- `specs/ACTIVE` names a feature that isn't `done` → read its ledger and continue from its `stage`
  (the workflow-state note at the top of each message tells you where you are). The user wants
  something else → ask: finish it first, or pause it.

## The approvals
The user approves by typing an exact phrase, which a hook records:
- set `awaiting: spec` → the user types `approve spec`
- set `awaiting: plan` → `approve plan` (only after the spec is approved)
- quick lane: `awaiting: both` → `approve both`
- `revoke` (any time) clears both approvals.

Always tell the user the exact phrase to type. Never write the approval values yourself; the hook blocks
it. Approved spec, rubric and plan are locked: to change one, the user types `revoke` first.

## Keep the user in the loop
- Small steps; after each stage, say what was done and what comes next.
- Pause and ask whenever something that changes the result is unclear, a spec problem appears, the
  fix-round cap is reached, or progress stalls (see the playbook).
- End every stage with: done · how it was checked · what's left · next step.
