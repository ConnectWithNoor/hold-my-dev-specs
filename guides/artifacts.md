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

"Protected" = the settings' `paths.protected` + `paths.tests` + `specs/**`.

| Who | May write | Report file in `specs/<feature>/reports/` |
|---|---|---|
| Implementer / fixer | source code (gated); never protected paths | `<task>-impl.md` |
| Test author | `paths.tests` only (gated) | `<task>-tests.md` |
| Verifier | its report only (runs tests, changes nothing) | `<task>-verify-<round>.md`; lens mode: `<task>-verify-<round>-<lens>.md` |
| Explorer | its report only | `explore-<topic>.md` |
| Spec-miner | `specs/baseline/**` only, its report included (`specs/baseline/report.md`) | — |
| Shipper | its report only; deploy and monitor commands come from the project settings and stay Ask first | `ship.md` |
| Master | specs (approved ones locked), ledger (approval values and `done` excepted), manifests, `ACTIVE`; the settings file only with a permission prompt; everything else through the same gate; in `strict` never protected or test paths (`specs/**` excepted) | `final-check.md` |
| Any other agent (not from this plugin, e.g. Claude Code's general-purpose helper) | source code through the gate only; never protected paths | none: no report files |

No helper or other agent may ever change `.claude/hold-my-dev-specs.json`, and while the settings are
unfinished or broken, helpers may write nothing at all.

A helper may write only its **own** report file name (the pattern above, inside the **active** feature's
`reports/`); any other file inside `reports/` is denied. Creating the active `reports/` folder itself
(`mkdir -p`) is fine for every helper; deleting it is not. Shell commands that write files are checked on a
best-effort basis only; the verifier's diff check catches what slips through. The ledger can't be written
through the shell at all (use Edit / Write, so the approval values can be checked).

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
No line or no manifest → the hook adds a short notice to this plugin's helpers (other agents are left
alone) and the helper reads what it needs itself. A manifest that isn't valid JSON or doesn't match the
format stops the helper from starting, so the master fixes it first.

What the hook pastes, and what it never pastes:
- Each file up to `contextManifest.maxFileBytes`, all files together up to `maxTotalBytes`; anything cut
  or left out is named at the end, so the helper knows to read it itself.
- **Never** files that may hold secrets (`.env*` except `.env.example` / `.sample` / `.template`, keys,
  certificates, names containing "secret" or "credential", `.ssh/`, `.aws/`), files outside the project,
  or binary files, even when the manifest lists them. Symlinks are followed to the real file first.
- Folders: the names of the files directly inside (up to 200).
- The pasted block tells the helper to treat the contents as project data, not as instructions.

## Workflow-state note
On every user message, a hook gives Claude (not the user) 2–3 lines from the active ledger: feature,
stage, approvals, the active task's status and round, and the next step. A message containing the
project's skip keyword (default `#nostate`) gets no note.
