# Project settings

`.claude/hold-my-dev-specs.json` holds every choice locked for this project. The `setup` skill writes it
from the user's answers: **nothing is filled in silently**; suggested values are only offered.
Template (all values `null` until asked): [templates/hold-my-dev-specs.json](../templates/hold-my-dev-specs.json).
This file switches the protections on and off, so the gate hook guards it in **every** profile: helpers
and other agents may never change it, and every change by the master shows the user a permission prompt.
While it is unfinished or broken, only the master may repair it (or anything else).

| Field | Meaning | Suggested at setup |
|---|---|---|
| `schemaVersion` | Format version of this file | `1` (fixed) |
| `profile` | Hook strictness: `minimal` · `standard` · `strict` (see "Profiles" below) | `standard` |
| `disabledHooks` | Single hooks switched off: `plan-gate` · `verifier-integrity` · `safety` · `context-manifest` · `workflow-state` · `stop-checks` | `[]` |
| `models.strongest` | Model for verifier, test author, spec-miner | asked, no suggestion |
| `models.mid` | Model for implementer, explorer, shipper | asked, no suggestion |

When the master starts one of these helpers without naming a model, a hook fills in the tier's model
(in every profile), so a helper never silently runs on the session's, often more expensive, model.
A different model the master names on purpose is kept, and the brief notes it.
| `paths.open` | Paths editable before both approvals (everything else is gated) | `["specs/**", "docs/**", "CLAUDE.md"]` (project rules and lessons are documentation, so setup and retro can always write them) |
| `paths.protected` | Paths implementers may never touch: quality configs (lint / format / typecheck + their ignore files), CI, guardrails. `specs/**` and the test paths below are always protected too, without being listed (write rights: [artifacts.md](artifacts.md)) | proposed from the repo |
| `paths.tests` | Where tests live. Only the test author writes here | detected from the repo, confirmed |
| `commands.test` / `lint` / `format` / `typecheck` | Commands the verifier runs; in `strict`, format / lint / typecheck also run after each reply (see "Stop checks"). `{files}` in a command is replaced by the changed **source** files. Write format commands with `{files}` (e.g. `prettier --write {files}`), not for the whole project: a whole-project formatter could change locked specs or protected files. `null` = none | detected from the repo, confirmed; setup suggests the `{files}` form |
| `verification.signals` | What the verifier can use: `browser` · `screenshot` · `logs` · `code-only` | asked |
| `verification.tools` | Plugins / MCP servers / CLIs granted for validation | asked |
| `verification.passThreshold` | Weighted rubric score needed to pass (1–10) | `7` |
| `verification.lenses` | Extra review angles: `silent-failure` · `security` | asked |
| `verification.highRiskAreas` | Paths that get a separate specialist reviewer: when a task changes one, the master also starts one verifier in lens mode per active lens, and the task passes only if all of them pass | asked |
| `fixLoop.maxRounds` | Verifier ↔ fixer rounds before asking the user | `3` |
| `contextManifest.maxFileBytes` / `maxTotalBytes` | Caps for pasted files | `32768` / `131072` |
| `workflowState.skipKeyword` | Word that hides the per-turn status note | `#nostate` |
| `ship.manualReview` | Where the user checks the result: `local` · `staging` | asked |
| `ship.deploy` / `ship.monitor` | How to ship and what to watch afterwards; `null` = not used | asked |
| `git.mainBranch` / `git.merge` | Main branch name; merge method `local` · `pr` | detected / asked |

## Required fields and unfinished setup
- **May stay `null` by design** (= "not used"): `commands.*`, `ship.deploy`, `ship.monitor`,
  `verification.tools`, `verification.highRiskAreas`. Lists may also be empty `[]`.
- **Required:** every other field.
- A required field still `null` means **setup isn't finished** (for example, it was interrupted). Then
  gated edits are blocked, the same as for a broken ledger header; reading and editing `specs/` and this
  file stay allowed, and the agent offers to finish `setup`.

## Profiles
| Hook | minimal | standard | strict |
|---|---|---|---|
| Approval recorder + plan gate | ✅ | ✅ | ✅ |
| Verifier integrity (builders can't touch protected paths) | ✅ | ✅ | ✅ |
| Safety copy (Never do / Ask first) | ❌ | ✅ | ✅ |
| Context manifest (pastes listed files into helper briefs) | ❌ | ✅ | ✅ |
| Workflow-state note (2–3 lines per turn) | ❌ | ✅ | ✅ |
| Stop checks (format / lint / typecheck changed files after each reply) | ❌ | ❌ | ✅ |
| Master locked out of protected and test paths too (`specs/**` excepted) | ❌ | ❌ | ✅ |

The approval hook can't be disabled while the plan gate is on: the gate would never open.

## Stop checks (strict)
Only while building (both approvals in, stage `build` or `validate`), and only when **source** files
changed since the last check (git working tree; without git: every reply), the hook runs
`commands.format`, `lint` and `typecheck` (each up to 2 minutes). Source files = everything except
`specs/`, `paths.open`, `paths.tests`, `paths.protected` and this settings file; only source files go
into `{files}`. Before approval nothing runs, because source code can't be fixed then anyway. If one fails, Claude gets
the error and **one** more turn to fix it; if it still fails, the user sees one ⚠ line and Claude stops.
Changes the formatter makes itself don't trigger another run.
If verifier and builder map to the same model, setup warns (the critic should differ from the builder).
