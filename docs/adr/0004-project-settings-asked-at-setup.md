# ADR-0004 — One project settings file, every value asked at setup

**Status:** Accepted (2026-11-18)

## Context
Projects differ: language, test commands, protected files, how to deploy, how strict the checks should
be. Silent defaults lead to agents guessing, and guesses become bugs.

## Decision
- All project choices live in **`.claude/hold-my-dev-specs.json`** (fields:
  [guides/project-config.md](../../guides/project-config.md)). The project's `CLAUDE.md` explains it in
  plain words and links to it, without copying its values.
- The **`setup` skill interviews the user** in small groups of questions, with suggestions only where
  the guide gives one. Nothing is filled in silently. Anything missing that turns up later makes the
  master pause, ask, and record the answer.
- The file's existence **switches the plugin's hooks on**. Without it, the plugin does nothing in that
  project. Setup writes it last.
- A required value still `null` means setup is unfinished. Then gated edits are blocked, and only the
  settings and `specs/` stay editable until setup is finished.
- The file is **guarded in every profile**: helpers and other agents may never change it, and every
  change by the master shows the user a permission prompt.
- **Hook profiles** set how strict the project is:

  | Hook | minimal | standard (suggested) | strict |
  |---|---|---|---|
  | Approvals + plan gate, verifier integrity | ✅ | ✅ | ✅ |
  | Safety copy, context manifest, workflow-state note | ❌ | ✅ | ✅ |
  | Format / lint / typecheck after each reply while building; quality configs locked for the master too | ❌ | ❌ | ✅ |

  Single hooks can be switched off with `disabledHooks`. In `strict`, the configured format / lint /
  typecheck commands run by themselves, outside Claude Code's permission prompts: the README says so,
  and setup warns clearly about a format command without `{files}` (it would reformat locked files).
- Suggested values at setup: 3 fix rounds, manifest caps of 32 KB per file and 128 KB in total, and
  the skip keyword `#nostate`. `paths.open` (suggested `specs/**`, `docs/**`, `CLAUDE.md`) is where
  writing is allowed before approval.

## Consequences
- A new project needs one interview of a few minutes before the first feature.
- Every rule that differs between projects can be traced to one file.

**Replaces internal records:** D21, D35, D38, B6, B11, B12, B42 (`CLAUDE.md` open path), B52 (R8).
