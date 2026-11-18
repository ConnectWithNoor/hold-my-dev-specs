# Project files — what each one is

Every file the plugin creates in a project, who writes it, and the rules. Exact formats live in the
templates (`templates/`); the ledger header and the project settings have their own guides because
hooks read them: [ledger.md](ledger.md), [project-config.md](project-config.md).

## Folder layout
```
.claude/hold-my-dev-specs.json     # project settings; its existence switches the plugin on
specs/
├── ACTIVE                         # one line: folder name of the active feature, e.g. 001-login
├── baseline/                      # spec-miner: what existing code already does
└── 001-login/                     # NNN-short-name, numbered in creation order
    ├── spec.md                    # what to build and how we check it
    ├── rubric.md                  # how the verifier scores the work
    ├── plan.md                    # how to build it (full lane only)
    ├── tasks.md                   # small units of work (full lane only)
    ├── ledger.md                  # progress: header for hooks + task statuses + log
    ├── manifests/T01.json         # files a helper gets pasted into its brief
    └── reports/                   # one report per helper run (names below)
```
One feature is active at a time. `ACTIVE` is empty (or missing) when none is.

## Files
| File | Written by | Reviewed by | Rules |
|---|---|---|---|
| `spec.md` | master (with the user's answers) | user: `approve spec` | Every requirement has Given/When/Then criteria. **Open questions must be empty** before asking for approval |
| `rubric.md` | master, before any building | user sees it with the spec | Defines scoring + the evidence each criterion needs. Builders never edit it |
| `plan.md` | master | user: `approve plan` | Technical approach; names the files and test seams |
| `tasks.md` | master, after plan approval | — | Definitions only. **Status lives in the ledger**, never here |
| `ledger.md` | master; approval lines only by the approval hook | — | See [ledger.md](ledger.md) |
| `manifests/<task>.json` | master | — | See "Context manifest" below |
| `reports/*` | each helper writes its own report | master | Names in "Who may write what" below |

## Who may write what
Hooks enforce this table; the helper is known from the hook input (`hold-my-dev-specs:<helper>`).
"Gated" = only after both approvals ([ledger.md](ledger.md)).

| Who | May write | Report file in `specs/<feature>/reports/` |
|---|---|---|
| Implementer / fixer | source code (gated); never protected paths | `<task>-impl.md` |
| Test author | test files (gated) | `<task>-tests.md` |
| Verifier | its report only (runs tests, changes nothing) | `<task>-verify-<round>.md` |
| Explorer | its report only | `explore-<topic>.md` |
| Spec-miner | `specs/baseline/` only | `spec-miner.md` |
| Shipper | its report only; deploy and monitor commands come from the project settings and stay Ask first | `ship.md` |
| Master | specs, ledger (approval values excepted), manifests, `ACTIVE`; source code through the same gate; in `strict` never quality configs | `final-check.md` |

A helper may write only its **own** report file name; any other file inside `reports/` is denied.

## Two lanes
- **Full lane:** spec.md + rubric.md → `approve spec` → plan.md → `approve plan` → tasks.md → build.
- **Quick lane** (tiny fixes, the user confirms the lane): one short `spec.md` from
  `templates/spec-quick.md` that also holds a 3-line plan, plus `rubric.md`. One approval: `approve both`.
  No plan.md, no tasks.md; the ledger holds a single task `T01`.

## Context manifest
`manifests/<task>.json` lists what the helper for that task must read. A hook pastes those files into
the helper's brief, within the project's size caps; folders are listed by file name only.
```json
{
  "task": "T01",
  "files":   [ { "path": "specs/001-login/spec.md", "why": "criteria R1–R3" } ],
  "folders": [ { "path": "src/auth", "why": "see which files exist" } ]
}
```
The master starts every helper brief with one line naming the task, so the hook can find the manifest:
```
hmds-task: 001-login/T01
```
No line or no manifest → the hook adds a short notice and the helper reads what it needs itself.
