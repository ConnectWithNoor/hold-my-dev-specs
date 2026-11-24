# ADR-0015 — How the plugin itself is tested

**Status:** Accepted (2026-11-18)

## Context
A plugin that enforces rules on agents needs its own rules checked, and its skills must start at the
right moments and not at the wrong ones. Some of this can be tested for free; some needs real Claude
sessions, which cost usage.

## Decision
"Done" for a release needs all of these:
1. **Unit tests** (`npm test`, Node's built-in test runner, nothing to install). They cover every hook
   decision, including garbled input (fail-closed), every bypass attempt found in reviews, and the agent
   and skill files (tools, report names, required wording, no model names).
2. **One full sample run** on a throwaway project (setup → feature → retro), with the cost of each stage
   and the on-screen checks: results in [research/sample-run.md](../research/sample-run.md).
3. **Skill-trigger evals** (`npm run eval`, `claude plugin eval`): 18 short sessions, three that should
   start each skill and three that shouldn't, graded by which skill started. Before publishing, the
   suite runs **three times and must score 18/18 each time**. Details:
   [research/s10-evals.md](../research/s10-evals.md).
4. **An independent review** by a helper that didn't build the plugin, before publishing, and a
   **sanitizer audit** of the files and the whole git history (secrets, personal data, home paths, risky
   files).

The skills are for **software projects only**: their descriptions say so, and the negative evals
include learning, discussion and non-software requests.

## Consequences
- Free checks run on every change; paid checks (evals, sample run) run at milestones.

**Replaces internal records:** D50 (sanitizer audit), D56, B9, B20, B49.
