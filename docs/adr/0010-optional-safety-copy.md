# ADR-0010 — An optional safety copy: "Never do" and "Ask first"

**Status:** Accepted (2026-11-19)

## Context
Agents that build code also run shell commands, and some commands can't be undone: deleting folders,
force-pushing, leaking a secret. Many users have no safety hooks of their own. Users who already do
shouldn't get every warning twice.

## Decision
- The plugin ships a **safety copy** (`hooks/scripts/lib/safety.js`), ported with the same rules,
  patterns and wording from the author's own safety hook. It sorts actions into two buckets:
  - **Never do** (denied): reading, printing or committing secrets (`.env` files, `.envrc`, keys, SSH and
    cloud credentials), including tricks like `.e""nv`; deleting `/`, the home folder or anything outside
    the project; wiping disks; force-pushing or rewriting the history of `main` / `master`; piping a
    downloaded script straight into a shell.
  - **Ask first** (permission prompt, with a note on what the agent should have explained): anything that
    leaves the machine (push, pull request, deploy, publish, email); deleting files; git actions that
    can lose work (`reset --hard`, `clean -f`, `restore`, `git checkout` of a path, `.` or a pattern,
    branch delete); database drops and migrations; `sudo` and system installs; `chmod 777`; every package
    install; changes to Claude Code configuration; committing directly on `main` / `master`.
- It runs in the blocking action hook together with the gate (a deny from either wins). Secret **reads**
  are checked in the fail-open read hook ([ADR-0009](0009-hook-runtime-and-failure-modes.md)).
- **On** in the `standard` and `strict` profiles. **Off** with profile `minimal`, with `"safety"` in
  `disabledHooks`, or machine-wide with the environment entry `HOLD_MY_DEV_SPECS_SAFETY=off` (for users
  with their own safety hooks). A plugin option for this was tried and rejected: it doesn't reach the
  hooks when the plugin is loaded from a folder.
- Claude Code's own deny rules are recommended in the README as the hard line for secrets, because
  they need no script at all.
- The copy is kept identical to the author's hook: every case it was built against is a test, and a
  side-by-side comparison must show identical decisions.

## Consequences
- New users get basic protection without setting anything up.
- **Known limit:** file names a command reads from elsewhere (`xargs cat < list.txt`) can't be seen.

**Replaces internal records:** D23, D40 (adopted patterns), D44, D45 (placement), B25, B45, B51 (3).
