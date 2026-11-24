# ADR-0007 — An independent verifier that builders can't game

**Status:** Accepted (2026-11-18)

## Context
An implementer that can't make a test pass may be tempted to change the test, the lint config or the
spec instead. A verifier that only reads the implementer's report would trust what it should check.

## Decision
- **Verifier integrity:** builders may change only the code under test. The hook blocks them from
  **protected paths**: acceptance tests (`paths.tests`, only the test author writes there), quality
  configs and their ignore files, specs, rubric and plan, CI and guardrail files. Protected =
  `paths.protected` + `paths.tests` + `specs/**`.
- **Diff check:** the verifier lists every file changed since the task's base commit. A protected file
  changed by the implementer fails the task, whatever else is true. This also catches shell-based
  edits that the hooks missed.
- **Evidence, not trust:** the verifier runs the project's tests and checks itself, with exactly the
  configured commands. Every acceptance criterion needs evidence from the rubric (a passing test, a
  screenshot, a log line); missing evidence means "not met". It says which signals it had (browser,
  screenshot, logs, code only).
- **Rubric scoring:** each criterion is scored 1–10. The weighted score is computed with a command,
  never in the agent's head (shell arithmetic in tenths, which needs no permission prompt), and
  compared with the project's pass threshold. One report per round, including what changed since the
  last round.
- **Read-only:** the verifier writes nothing but its report: no check files, nothing in `/tmp`, one
  command per call. It relies on the project's tests for behaviour; a manual try that needs a
  permission prompt is acceptable when really needed.
- **Fix loop:** a failed task goes to a **fresh** implementer with a focused brief (task + findings +
  files changed so far). After `fixLoop.maxRounds` failed rounds (suggested 3), the master stops and
  asks the user, with the reports as evidence.
- **Lenses:** `silent-failure` and `security`, chosen per project. For paths listed as high risk, one
  extra verifier per lens reviews the change; the task passes only if all of them pass.
- **Validate:** after the last task, one verifier checks the whole feature (convergence mode), then the
  master runs a lean final check: read the reports, run the full suite once, spot-check the risky
  areas, confirm every criterion has evidence.

## Consequences
- A passing task means the agreed evidence exists, not that a helper said so.
- The verifier uses the strongest tier and is the second most expensive stage (about 15 % of a measured
  feature run).

**Replaces internal records:** D20 (L2), D37, D39, D42, D50 (evaluator pattern), D51, B41 (lens mode),
B44 (computed score), B50 (b).
