# Project settings

`.claude/hold-my-dev-specs.json` holds every choice locked for this project. The `setup` skill writes it
from the user's answers: **nothing is filled in silently**; suggested values are only offered.
Template (all values `null` until asked): [templates/hold-my-dev-specs.json](../templates/hold-my-dev-specs.json).
Agents must ask before editing anything under `.claude/`.

| Field | Meaning | Suggested at setup |
|---|---|---|
| `schemaVersion` | Format version of this file | `1` (fixed) |
| `profile` | Hook strictness: `minimal` · `standard` · `strict` (see "Profiles" below) | `standard` |
| `disabledHooks` | Single hooks switched off: `plan-gate` · `verifier-integrity` · `safety` · `context-manifest` · `workflow-state` · `stop-checks` | `[]` |
| `models.strongest` | Model for verifier, test author, spec-miner | asked, no suggestion |
| `models.mid` | Model for implementer, explorer, shipper | asked, no suggestion |
| `paths.open` | Paths editable before both approvals (everything else is gated) | `["specs/**", "docs/**"]` |
| `paths.protected` | Paths implementers may never touch: tests, quality configs, specs, CI, guardrails. Each helper's own report file is the only exception (write rights: [artifacts.md](artifacts.md)) | proposed from the repo |
| `commands.test` / `lint` / `format` / `typecheck` | Commands the verifier (and strict Stop checks) run; `null` = none | detected from the repo, confirmed |
| `verification.signals` | What the verifier can use: `browser` · `screenshot` · `logs` · `code-only` | asked |
| `verification.tools` | Plugins / MCP servers / CLIs granted for validation | asked |
| `verification.passThreshold` | Weighted rubric score needed to pass (1–10) | `7` |
| `verification.lenses` | Extra review angles: `silent-failure` · `security` | asked |
| `verification.highRiskAreas` | Paths/topics that get a separate specialist reviewer | asked |
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
| Quality configs locked for the master too | ❌ | ❌ | ✅ |

The approval hook can't be disabled while the plan gate is on: the gate would never open.
If verifier and builder map to the same model, setup warns (the critic should differ from the builder).
