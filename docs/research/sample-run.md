# S11 — full sample run

2026-11-19, Claude Code 2.1.311, plugin loaded with `--plugin-dir`, mode `acceptEdits`.
Goal: one real run of setup → full-lane feature → retro, with the cost of each stage and the on-screen checks.

## How it ran
- **Driven in background mode** (`claude -p`, resumed turn by turn), by a separate design session. The approval
  phrases were typed with the user's OK. Background mode can't show permission prompts, so **every prompt
  became a refusal**. Each refusal below is a prompt the user would see in a normal terminal.
- Sample project: the eval fixture `evals/fixtures/repo-with-code.sh` (a tiny Node project with 1 test).
- Feature `001-cli`: `node cli.js greet <name>` / `bye <name>`, otherwise print the usage and exit 1. It was
  split into 2 tasks (T01 `bye()`, T02 `cli.js`), and both passed verification in round 1.
- **The usage limit cut the run off** during the final convergence check (the verifier's last look at the
  whole feature). Ship did not run.
- The retro ran separately on 2026-11-24 (Claude Code 2.1.325), on the eval fixture `done-feature.sh`
  (a finished feature whose task hit the fix-round cap), in 2 turns.

## Cost per stage
List prices, read from platform.claude.com/docs/en/about-claude/pricing on 2026-11-24, in USD per million
tokens:

| Model | Input | Cache write 5 min | Cache write 1 h | Cache read | Output |
|---|---|---|---|---|---|
| Opus 5.5 | 4 | 5 | 8 | 0.20 | 20 |
| Sonnet 5.5 | 2 | 2.50 | 4 | 0.10 | 10 |

Method: every message in the transcript (main session plus one file per helper) carries its token use and
model. Duplicate lines of one reply are counted once. The main session is split at each user prompt. The
main session writes to the 1-hour cache; helpers write to the 5-minute cache. The retro cost is the
`total_cost_usd` that `claude -p` reports.

| Stage | Who | Cost | Share |
|---|---|---|---|
| Setup (skill, guides, 4 question rounds, settings, commit + merge) | master (Opus) | $0.55 | 17 % |
| Intent | master | $0.09 | 3 % |
| Spec + rubric + ledger | master | $0.27 | 8 % |
| Plan (written after `approve spec`, shown again after re-approval) | master | $0.21 | 6 % |
| `revoke` test and re-ask (test only, not part of a normal run) | master | $0.17 | 5 % |
| Tasks + manifests, then the build: start helpers, update ledger, commit | master | $1.05 | 33 % |
| Test author T01 · T02 | helper (Opus) | $0.14 · $0.17 | 10 % |
| Implementer T01 · T02 | helper (Sonnet) | $0.05 · $0.04 | 3 % |
| Validate: verifier T01 · T02 · convergence (cut off) | helper (Opus) | $0.16 · $0.20 · $0.11 | 15 % |
| **Feature run total** | | **$3.20** | 100 % |
| Retro (separate run, 2 turns) | master | $0.51 | |

The master (main session) is 73 % of the feature run. Its cost splits into rereading its own context on
every call ($0.93, 4.6 M cache-read tokens), output ($0.75), and cache writes ($0.66). So each extra master
call costs about $0.02–0.03 by the build stage, where the context is about 80 k tokens.

## The 3 biggest costs, with a trimming proposal each
| # | Cost | Why | Proposal (decided: see below) | Expected saving |
|---|---|---|---|---|
| 1 | **Master during tasks + build, $1.05** | 35 calls. Most are bookkeeping: 25 ledger edits and 11 clock reads (`date -u`). One event (task started, report in, task verified) usually took 2–3 small edits plus a clock read. | Playbook: **one ledger update per event**. Header fields and the log line change together. Read the clock once per event, in the same shell call as the git command that follows. | About half the bookkeeping calls, **≈ $0.30–0.40 (10–12 %)**. Medium confidence. |
| 2 | **Setup, $0.55** | One-off per project. About $0.20 of it came from background mode (refused settings writes, merge retries). | No structural change. In a normal terminal those retries disappear. Finding (c) (look at the repo with Read/Glob, not shell) trims a little. | ≈ $0.15–0.20 in a normal run, mostly free |
| 3 | **Validation, $0.47** | 3 verifier runs. 21 shell commands, 7 of them refused and retried: chained commands, `node -e` arithmetic, CLI tries writing to `/tmp`. | Finding (b): fewer commands, each one prompt-free. | ≈ $0.10–0.15, and above all **fewer prompts** |

Possible but not recommended: moving the test author to the `mid` tier would cut $0.31 to about $0.10.
`guides/project-config.md` puts it on `strongest`, and the tests decide what counts as "correct", so a
weaker test author weakens every later check.

## On-screen checks
| Check | Result |
|---|---|
| Status line | ✅ confirmed by the user |
| Sounds | ✅ confirmed by the user |
| ✅ / ↩ lines | ✅ shown as hook messages ("✅ Spec approved 19:20", "↩ Approvals revoked — the plan gate is closed 19:24", "✅ Plan approved 19:25") |
| No double safety prompts | ✅ none, because the plugin's safety copy is off on this machine |
| Setup writes its own settings file | Refused 3× in background mode, so the design session created the file. In a normal terminal this is one Claude Code prompt for `.claude/`. **Not a plugin bug.** |
| Prompts in `acceptEdits` | Helper starts and plugin-guide reads: **no prompt**. The prompts that did appear are findings (a)–(d). |

## Findings and decisions (2026-11-24)
| # | Evidence | Decision (built) |
|---|---|---|
| a | `npm test` needed approval for the master (2×) and for test author T01 (5×: it tried `npm test`, `npm --prefix … test` and `node --test` one after another). | Setup offers **allow rules** `Bash(<command> *)` for the configured commands, and asks whether they go in shared `.claude/settings.json` or personal `.claude/settings.local.json`. It **warns** when the file that decides what a command runs (e.g. `package.json`) isn't in `paths.protected`. The gate hook lets only the master change these two files, through Claude Code's own prompt. Every helper and the master: a refused command → no variants, report it. |
| b | Verifiers: 21 shell commands, 7 refused: chains mixing `echo`/`node`, `node -e` for the score, CLI tries with `/tmp` files. | The verifier **stays read-only**: no check files. It relies on the project's tests for behaviour (a manual try that asks is acceptable when really needed), sums the score in tenths with `echo $(( … ))`, runs one command per call, and writes nothing in `/tmp`. |
| c | Setup looked at the repo with `ls -la`, `find` and `for … cat`. The feature skill ran `ls` on the plugin's `templates/`, which was refused 2×. | Setup and feature look with Glob / Grep / Read. The feature skill names all six templates. |
| d | `git merge --ff-only chore/setup` needed approval 2× (the user's own safety rule for the main branch). | Setup, ship and retro tell the user before merging that this may ask once. The README has a "Permission prompts to expect" section. |
| e | After `revoke` with nothing to change, the master spent 2 turns ($0.17), and the user had to say "ask me again". | After `revoke`: ask what should change. If nothing, ask for the approvals again right away. |
| f | The retro tried `npm test` and left `CLAUDE.md` uncommitted. | The retro runs no tests. It commits what it wrote on `chore/retro-<feature>` and merges as `git.merge` says, or says clearly which files are uncommitted. |
| cost #1 | See "The 3 biggest costs". | **One ledger update per event** (one Write, or one Edit when only one place changes). **One clock read per event.** |
| tier | Test author on the strongest tier. | Stays. |

**Clock probe** (2026-11-24, `claude -p`, `acceptEdits`, plugin active): `date -u …` alone, and
`git commit … && date -u …` on a feature branch, both ran without a prompt. A commit on `main` asks
first (the user's own rule), so the probe used a branch, as the master does. The same probe confirmed
that with `Bash(npm test *)`, both `npm test` and `npm test 2>&1 | tail -5` run without a prompt,
`node --test` is still refused, and `echo $(( … ))` runs. Allow-rule syntax: code.claude.com/docs/en/permissions
(the space form `Bash(npm test *)`; `:*` is an equivalent older spelling).

## Smaller observations (no decision needed yet)
- The master tried twice to edit the ledger's hook-written approval line ("string not found"). This was
  harmless, because hooks own those lines.
- The retro wrote exactly the two lessons approved and nothing else (its other two findings are (f) above).
- The `done-feature.sh` fixture has no reports or plan, so the retro's analysis was guesswork. That's
  fine for the eval, too thin for judging retro quality.
