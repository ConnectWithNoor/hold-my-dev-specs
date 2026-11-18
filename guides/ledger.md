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
  The hook then writes the time, sets `awaiting: none`, and shows `✅ Spec approved 19:20` (or plan / both).
  Any other message does nothing.
- **Revoking.** A whole message of exactly `revoke` sets both approvals to `no` at any time and shows
  a one-line confirmation. The master then goes back to spec review.
- **No agent writes approvals.** The hook compares the header before and after each agent edit of the
  ledger: if `spec_approved` or `plan_approved` would change, the edit is denied. Edits that leave both
  values unchanged (stage, tasks, log) are allowed.
- **Gate.** Edits outside the project's open paths are blocked until **both** `spec_approved` and
  `plan_approved` are times (quick lane: `approve both` sets them together).
- **Broken header** (missing block, missing key, unknown value): gated edits are blocked; reading and
  editing `specs/` and the project settings stay allowed so the file can be repaired.

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
