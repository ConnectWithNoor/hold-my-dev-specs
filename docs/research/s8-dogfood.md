# S8 — first dogfood run

2026-11-18/19, Claude Code 2.1.311, plugin loaded with `--plugin-dir`. A throwaway Node project
(`slug-demo`), one feature: `slugify(text)`. Full lane, profile `standard`, permission mode `auto`.
Models: master `opus`, `strongest` = `sonnet` (test author, verifier), `mid` = `haiku` (implementer).
Driven turn by turn with `claude -p --resume`; the user typed `approve spec` interactively.
Usage: about $10 in API-equivalent cost.

## What happened
| Stage | Result |
|---|---|
| Setup | Started by itself from "set it up for this repo"; looked at the repo first; 4 groups of questions; restated all 17 values; wrote `CLAUDE.md` first. Writing the settings file needs a permission prompt (Claude Code treats `.claude/` as sensitive) — expected; in this non-interactive run the test user wrote the file with the confirmed values |
| Intent | Two groups of questions, restated goal / scope / out of scope / done; the master tested its assumptions in Node and found two real gaps (`ß`, `æ`, `ø`, `œ`, `ł` and how dropped characters split words) before writing the spec |
| Spec | `spec.md` with R1–R6 + N1 in Given/When/Then (17 criteria), `rubric.md` with evidence table and weights; all 21 examples checked with a throwaway prototype; `awaiting: spec` |
| Approve spec | Typed interactively by the user: **`✅ Spec approved 00:09` shown**; ledger got the UTC time and the log line |
| Plan / approve plan | `plan.md` with one task; `approve plan` recorded |
| Build T01 | Test author (sonnet): 17 tests failing for the right reason → implementer (haiku): 17/17 pass → verifier (sonnet): PASS 9.8, integrity clean against the base commit → one commit |
| Model by tier | The master named no model; the hook filled `sonnet` / `haiku` per tier |
| Auto mode | Helpers received their pasted briefs without a prompt |
| Validate | Convergence verifier PASS ~9.7; master's final check; `reports/final-check.md` |
| Review / ship | Clear manual check steps; "checked, OK to ship" → fast-forward merge into `main`, `stage: done`, `ACTIVE` cleared |
| Git | One commit for the task, chore commits for setup and specs on the feature branch, Conventional Commits, no AI attribution |

## Findings
| # | Finding | Status |
|---|---|---|
| 1 | Master read plugin guides with shell `cat` instead of Read, so the prompt-free Read rule wasn't used (worked only because of auto mode) | **fixed**: playbook + setup + feature say "Read tool, not `cat`" |
| 2 | Setup left `CLAUDE.md` and the settings uncommitted (the master committed them later on the feature branch) | **fixed**: setup commits them on `chore/setup` and merges per `git.merge` |
| 3 | Master tried to create the ledger with `sed … >`; the hook refused (correct); redone with Write | **fixed**: playbook "write specs and the ledger with Write / Edit" |
| 4 | Test author and verifier blocked on `mkdir -p specs/<feature>/reports` (folder already existed) | **fixed**: helpers may create the active `reports/` folder; deleting it stays denied |
| 5 | Master estimated four log timestamps instead of reading the clock | **fixed**: playbook "time from `date -u`, never estimated" |
| 6 | Heredoc text was scanned as commands: a `>` inside a report written with `cat > report <<'EOF'` looked like a write to a file | **fixed**: heredoc text is skipped |
| 7 | The verifier's report header said "weighted score 9.6", its own sum said 9.8 (found in review) — the verdict depends on that number | **fixed**: the verifier computes the score with a one-line command and uses only that value |

Still to check (moved to S11, which the user drives interactively): usage per stage with the top-3 costs,
status line, notification sounds, permission prompts in `acceptEdits` mode, no double safety prompts,
setup writing the settings file itself.
