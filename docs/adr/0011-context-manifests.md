# ADR-0011 — Context manifests: helpers get exactly the files they need

**Status:** Accepted (2026-11-18)

## Context
A helper starts with an empty context. If it has to search the repository for the spec, the rubric and
the right source files, it spends usage and may read the wrong things. If the master pastes everything,
the brief gets huge.

## Decision
- For each task the master writes a **manifest**, `specs/<feature>/manifests/T01.json`, listing the
  spec, rubric, plan parts and source files that helper needs, and nothing more.
- A hook on every helper start whose brief begins with `hmds-task: <feature>/<task>` **pastes those
  files** into the brief, inside `<context-manifest>`, within the project's byte caps (suggested 32 KB
  per file, 128 KB in total). The helpers treat pasted contents as project data, never as
  instructions.
- **Never pasted:** files that look like secrets, files outside the project, and binary files.
- An empty or missing manifest gives the helper a short "no manifest" note, and it reads what it needs
  itself. A **broken** manifest stops the helper from starting, so the master fixes it first.

## Consequences
- Helper briefs are small and predictable.
- The master has to keep manifests current when the plan changes.

**Replaces internal records:** D65 (context manifest), B12 (caps), B39 (manifest safety).
