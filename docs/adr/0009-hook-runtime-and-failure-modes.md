# ADR-0009 — Hooks: Node built-ins, safe failure per event, inert without settings

**Status:** Accepted (2026-11-18)

## Context
The hooks are the plugin's enforcement. A hook that crashes must not silently let a forbidden action
through. A hook that blocks every file read because of its own bug would make Claude Code unusable.
Outside libraries would add install steps and supply-chain risk.

## Decision
- **Node.js built-ins only**, no outside libraries. Minimum **Node.js 22** (Node 20 reached end of
  life on 2026-04-30). Minimum **Claude Code 2.1.295**, stated in `plugin.json` and the README.
- **Safe failure depends on the event:**
  - **Actions** (file writes, shell commands, helper starts) **fail closed**. The script denies on bad
    input, and the hook entry has `"onFailure": "block"`, so a missing or crashing script blocks too.
    This needs Claude Code 2.1.295 or newer. The entry is a tiny `sh` wrapper (`pre-tool.sh`): it exits
    at once when the project has no settings file and only then starts Node (`pre-tool.js`). So a
    machine without Node blocks actions only in projects that use the plugin, and the README says how
    to check and recover.
  - **Reads** (`pre-read.js`) **fail open**. A broken script never blocks reading. This entry lets the
    plugin's own docs be read without a prompt, and denies reads of secret files while the safety copy
    is on. For a hard line that needs no script, the README recommends Claude Code's own deny rules.
  - **Prompt and stop hooks** warn: they change nothing on error and show one ⚠ line.
- **Inert without settings:** in a project without `.claude/hold-my-dev-specs.json`, every hook does
  nothing, except allowing reads of the plugin's own docs. The plugin can be installed once and affects
  only projects that use it.
- **Strict profile only:** after each reply while building, and only when source files changed, the
  project's format / lint / typecheck commands run (`{files}` in a command becomes the changed source
  files, so a formatter can't touch locked files). On failure Claude gets one extra turn to fix it,
  then a ⚠ line.

## Consequences
- Installing needs nothing beyond Node.js.
- Reliability rests on Claude Code's `onFailure` support, hence the version floor.

**Replaces internal records:** D45 (fail-closed), D54, B8, B15, B26, B36 (safe failure), B39, B42
(read rule), B52 (A6).
