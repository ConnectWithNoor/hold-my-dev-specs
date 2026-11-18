# Ledger format

`specs/<feature>/ledger.md` is the feature's progress record. Hooks read its **header**, so the header
format is strict. Template: [templates/ledger.md](../templates/ledger.md).

## Header
The first lines of the file, between two `---` lines. One `key: value` per line, lowercase keys,
no quotes, nothing else inside the block.

| Key | Values | Written by |
|---|---|---|
| `feature` | folder name, e.g. `001-login` | master |
| `lane` | `full` · `quick` | master |
| `stage` | `spec` · `plan` · `tasks` · `build` · `validate` · `review` · `ship` · `done` | master |
| `awaiting` | `none` · `spec` · `plan` · `both` (quick lane) | master |
| `spec_approved` | `no` · time of approval, e.g. `2026-11-18T19:20:00Z` | **approval hook only** |
| `plan_approved` | `no` · time of approval | **approval hook only** |
| `active_task` | task id, e.g. `T03`, or `none` | master |

Times are UTC in ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`); the ✅ line shows local time.

## Rules the hooks enforce
- **Approving.** The user's whole message, trimmed and ignoring upper/lower case, is exactly
  `approve spec`, `approve plan` or `approve both`, **and** `awaiting` names that same approval.
  `approve plan` also needs `spec_approved` to be a time already (order: spec first, then plan).
  The hook then writes the time, sets `awaiting: none`, adds a log line, and shows `✅ Spec approved 19:20`
  (or plan / both). An approval phrase at the wrong moment records nothing and says why in one line.
  Any other message does nothing. The master never logs approvals itself.
- **Revoking.** A whole message of exactly `revoke` sets both approvals to `no` at any time and shows
  a one-line confirmation. The master then goes back to spec review.
- **No agent writes approvals.** The hook compares the header before and after each agent edit of the
  ledger: if `spec_approved` or `plan_approved` would change, the edit is denied. Edits that leave both
  values unchanged (stage, tasks, log) are allowed.
- **Gate.** Edits outside the project's open paths are blocked until **both** `spec_approved` and
  `plan_approved` are times (quick lane: `approve both` sets them together), and the feature is not `done`.
- **`done` is final.** A finished feature's old approvals never open the gate, and no agent may change
  `stage` away from `done`. New work = a new feature.
- **Approved documents are locked.** While `spec_approved` is a time, that feature's `spec.md` and
  `rubric.md` can't be changed by anyone, the master included; while `plan_approved` is a time, the same
  for `plan.md` (quick lane: `spec.md` holds the plan and is locked after `approve both`). To change one:
  the user types `revoke`, the master makes the change, then asks for approval again. `tasks.md` stays
  editable: it is the master's breakdown, written after approval.
- **Broken header** (missing block, missing key, unknown value): gated edits are blocked; reading and
  editing `specs/` and the project settings stay allowed so the file can be repaired.
- **Limit — best-effort, not airtight.** File tools (Edit, Write…) are always checked; shell commands
  only for common patterns. A script run by an interpreter (`python -c`, `node -e`, a script file) can
  still change files, ledger approvals included, without the hooks seeing it. The rules guard against
  careless agents, not malicious ones; the verifier's diff check is the backstop.

## Body
Two sections, written by the master:
```markdown
## Tasks
| Task | Status | Round | Report |
|---|---|---|---|
| T01 | verified | 1 | reports/T01-verify-1.md |

## Log
- 2026-11-18T19:20:00Z — spec approved
```
Task status values: `todo` · `in-progress` · `verifying` · `fixing` · `verified` · `failed` · `blocked`.
`Round` counts verifier rounds (cap from project settings).

The log is a record, like a decision record (ADR): an intentional exception to the freshness rule.
Never prune or rewrite it; only add lines.
