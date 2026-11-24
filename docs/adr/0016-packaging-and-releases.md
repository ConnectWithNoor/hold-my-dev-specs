# ADR-0016 — Packaging, license and releases

**Status:** Accepted (2026-11-18)

## Context
The framework should be reusable by anyone, not tied to one machine or one person's setup.

## Decision
- A **Claude Code plugin** with a **marketplace catalog in the same repository**, so one repository is
  both the plugin and its install source. The marketplace is named after its owner, `connectwithnoor`,
  so users install `hold-my-dev-specs@connectwithnoor` and later plugins can join the same catalog.
- The plugin holds **only the spec-driven workflow**: three entry skills, six helpers, the hooks, guides
  and templates. Personal configuration stays out. Version 1 covers the lifecycle, spec-miner, retro
  with break-loop analysis, and the safety copy. Per-developer journals for shared repositories may
  come later.
- Guides, skills and docs use **plain words**, with each technical term explained the first time.
- **MIT license.** The `plugin.json` author is a name only, with no email.
- **Versions:** the version number in the plugin manifest, plus a git tag and release notes on GitHub
  for each release. No CHANGELOG file: release notes are the history, and the docs describe only the
  current state.
- **Decisions** live in these ADRs. A replaced ADR stays, marked "Superseded by ADR-n", and nothing may
  rely on it.

## Consequences
- Installing is one marketplace step for users.
- Each release needs a tag and notes written at release time.

**Replaces internal records:** D26, D30, D66, D70, B1, B4, B10, B16, B21, B23, B28.
