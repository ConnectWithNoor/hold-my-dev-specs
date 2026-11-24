# ADR-0006 — Plan gate and fixed write rights per helper

**Status:** Accepted (2026-11-18)

## Context
Written rules ("don't edit code before the plan is approved", "the implementer must not touch the
tests") are easy for an agent to forget. A hook can enforce them on every file write.

## Decision
- **Plan gate:** edits outside the project's open paths are blocked until **both** approvals are in,
  and while the active feature isn't `done`. Specs and docs stay editable before approval.
- **`done` is final:** a finished feature's old approvals never open the gate again, and no agent can
  move it back. New work is a new feature.
- **Write rights per helper** (table: [guides/artifacts.md](../../guides/artifacts.md)): each helper
  may write only its own area and its own report file, with a fixed name. **Other agents** (not from
  this plugin) get the strictest rights: source code through the gate only, never protected paths,
  no reports.
- **Always guarded**, in every profile and whatever the project protects: helpers and other agents may
  never write `.claude/**` (the plugin's settings live there, so moving it would switch the plugin off),
  `.mcp.json`, any `CLAUDE.md` (every later session reads it as instructions), or `.git/**` (git hooks
  run on the master's commits).
- Path rules use the **real path** (symlinks resolved), and a move or delete counts as a change to the
  file it moves or removes. A folder that a command deletes, moves, restores or copies counts with
  **every file below it** (bounded; a folder too big to check, or a pattern, is denied for helpers),
  so a test file or a ledger can't be carried off with its folder.
- **Only the master commits and changes branches:** helpers and other agents may not run `git stash`,
  `git reset --hard`, `git merge`, `git cherry-pick`, `git revert`, `git switch` or a `git checkout` of
  another branch. `git checkout <rev> <path>` names its paths like any other write.
- Shell commands are scanned for writes on a **best-effort** basis: common patterns (redirection,
  `sed -i`, `tee`, `cp`, `mv`, `curl -o`, `tar -x`, `git checkout -- …`, and others), `cd` followed
  within one command, heredoc text skipped.
- **Stated limit:** this is not airtight. A script run by an interpreter (`python -c`, `node -e`, a
  script file) can still change files, and file names a command gets from elsewhere (`xargs`) can't be
  seen. The rules stop careless agents, not malicious ones; the verifier's diff check is the backstop
  ([ADR-0007](0007-verifier-integrity.md)).

## Consequences
- An agent that forgets the playbook is stopped with a plain reason that says what to do next.
- Bypass attempts found in reviews are kept as permanent tests.
- The README says plainly what the protections can and can't do.

**Replaces internal records:** D47, B31, B35, B36 (other agents, real paths), B38, B44 (heredocs), B48,
B52 (A1–A3).
