# ADR-0001 — Spec-driven lifecycle with two human approvals

**Status:** Accepted (2026-11-18)

## Context
AI agents can write a lot of code quickly. Problems usually come from building the wrong thing, or
building it without a clear way to check it. The user should decide *what* gets built. Repetitive
building and checking can be left to agents, as long as the user stays in control at the points that
matter.

## Decision
Every change goes through one lifecycle (playbook: [guides/lifecycle.md](../../guides/lifecycle.md)):

```
intent → spec ──approve spec──→ plan ──approve plan──→ tasks → build ⇄ verify → validate → review → ship → done
```

- **Intent:** the agent interviews the user (goal, users, why, scope, out of scope, constraints) and
  restates it before writing anything.
- **Spec + rubric:** what to build, as Given/When/Then acceptance criteria with ids. The rubric is the
  scoring sheet the verifier uses later, with evidence per criterion. The user approves it.
- **Plan:** how to build it, including test seams and risks. The user approves it.
- **Tasks → build → verify:** agentic. The user is involved only when the agent asks.
- **Validate → review → ship:** a final check by the master, then a manual review by the user
  ("checked, OK to ship"), then merge and optional deploy. The "done" record is always committed on a
  branch, never directly on the main branch: on the feature branch before the merge, or (with a deploy
  step, whose report belongs to the still-active feature) on a short `chore/<feature>-done` branch
  after it.
- **Feedback loops:** bugs go back to the build; a wrong or missing requirement goes back to the spec
  (the agent pauses, explains the gap with evidence, and proposes the change); a changed goal goes back
  to intent.
- **Quick lane** for tiny, low-risk changes: one short spec (intent, criteria, a 3-line plan) and one
  approval (`approve both`), with the same gate and verifier. The agent proposes it; the user confirms.
- **One active feature at a time**, recorded in `specs/ACTIVE`. All files live in `specs/NNN-name/` at
  the repository root.
- **Git:** one branch per feature, never a commit directly on the main branch, one commit per verified
  task (Conventional Commits), no AI attribution lines. The merge method (`local` or pull request) is
  chosen per project.

## Consequences
- The user reads two short documents per feature; nothing else needs their attention unless an agent
  asks.
- Small fixes are not slowed down by the full ceremony (quick lane).
- Work in parallel features has to be paused and resumed, not interleaved.

**Replaces internal records:** D19, D24, D28, D32, D34, D49, B3, B18, B19, B32, B52 (A5).
