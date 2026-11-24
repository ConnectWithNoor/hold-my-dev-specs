# ADR-0002 — A master session and a fixed roster of helper agents

**Status:** Accepted (2026-11-18)

## Context
One long agent session that interviews, plans, writes tests, writes code and judges its own work runs
out of context, and it is a poor critic of its own output. Separate helpers (subagents) each start with
a clean context and one job.

## Decision
- **The master** is the main Claude session. It interviews, writes the spec, plan and tasks, starts
  and monitors the helpers, keeps the ledger, and does the final check. It doesn't write the code or
  the tests itself.
- **Six helpers** ship with the plugin (`agents/`):

  | Helper | Job | Writes |
  |---|---|---|
  | `test-author` | acceptance tests from the spec, before the code | test paths + own report |
  | `implementer` | makes one task's tests pass; also the **fresh fixer** after a failed check | source code + own report |
  | `verifier` | independent critic: spec, rubric and evidence; also convergence and lens modes | own report only |
  | `explorer` | read-only research (it loads the project's `CLAUDE.md`, which the built-in Explore helper doesn't) | own report only |
  | `shipper` | deploy and monitor after the user's manual review | own report only |
  | `spec-miner` | records what existing code does ([ADR-0013](0013-spec-miner-baseline.md)) | `specs/baseline/` only |

- **Helpers never start helpers:** no helper has the Agent tool. Every helper reports back to the
  master, with a report file and a short reply.
- **Agent files** list their tools explicitly and carry no model name ([ADR-0003](0003-model-tiers.md)).
- **Parallel tasks** only when they share no files and their dependencies are verified. Each gets its
  own chain of helpers; commits stay one per task, one at a time. They add up against usage limits,
  so they run only when the time saved is worth it.
- Entry points are three skills: `setup`, `feature` and `retro`. The agent may start them by itself when
  the situation fits; typing `/hold-my-dev-specs:<name>` also works.

## Consequences
- Every helper's work is checked by a different helper, never by itself.
- Each helper start costs usage. The playbook keeps briefs small ([ADR-0011](0011-context-manifests.md))
  and runs helpers one after another by default.

**Replaces internal records:** D25, D29, D33, D39, B2, B22, B40, B43.
