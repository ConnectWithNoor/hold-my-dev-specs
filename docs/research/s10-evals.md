# S10 — skill-trigger evals

2026-11-19, Claude Code 2.1.311, `claude plugin eval` (format: `evals/<skill>/<case>/case.yaml`).
Goal: the three skills start at the right moments and not at the wrong ones (D56).

## Suite
18 cases, 3 positive + 3 negative per skill. Each case starts from a shared script in `evals/fixtures/`
(linked as `scaffold.sh`; the eval tool only accepts scripts inside the case folder):

| Fixture | State | Used by |
|---|---|---|
| `repo-with-code.sh` | small Node project, git, no plugin settings | setup |
| `configured.sh` | the same + `.claude/hold-my-dev-specs.json` + `CLAUDE.md` section | feature |
| `done-feature.sh` | configured + feature `001-greeting` at `stage: done`, task T01 hit the fix-round cap | retro |

Graders (deterministic, no judge model): `tool_used` on `Skill`. Positive cases: the expected skill
started (`min: 1`) **and** the other two did not (`max: 0`). Negative cases: none of the three started.
Cheap settings: `runs: 1`, `max_turns: 3`, tools `Skill, Read, Glob, Grep` only, one arm
(`--ablation none` — without the plugin its skills can't start, so a baseline says nothing),
`--no-publish`. Run: `npm run eval`.

Negative prompts: learning ("explain what a hash table is", "what is a retrospective"), discussion
("what does spec-driven development mean"), non-software ("plan a trip to Lisbon", "edit this photo
caption", "set up a weekly meal plan", "what can I learn from Meditations", "feedback on my essay"),
and code without change ("what does index.js do? no changes").

## Result (one full run)
| Skill | Positive | Negative | Cost |
|---|---|---|---|
| setup | 3/3 | 3/3 | $0.53 |
| feature | 3/3 | 3/3 | $0.47 |
| retro | 3/3 | 3/3 | $0.47 |
| **all** | **9/9** | **9/9** | **$1.47** (192 s) |

Cost is the tool's list-price estimate (`costUsd`), with the user's default model.

## Found while building
- Grader entries need a `name`.
- A `scaffold_script` must be inside the case folder (`..` is refused); a symlink to a shared fixture works.
- A YAML value that starts with a quote mark (`description: "build X" in …`) breaks the file — the first
  run silently loaded only 11 of 18 cases. Descriptions are now always quoted, and
  `tests/evals.test.js` checks it (free, no model).
- Runs end with "Reached maximum number of turns (3)" — expected: the run is cut right after the skill starts.
