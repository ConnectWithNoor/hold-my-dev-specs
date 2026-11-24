# ADR-0008 — The ledger is the one progress record

**Status:** Accepted (2026-11-18)

## Context
Sessions end, context gets compacted, and task lists in the chat don't survive. A fresh session must
be able to continue a feature from files alone.

## Decision
- Each feature has **one Markdown ledger**, `specs/<feature>/ledger.md` (format:
  [guides/ledger.md](../../guides/ledger.md)). It has a small `key: value` header that hooks read
  (`stage`, `awaiting`, the two approvals, `active_task`), a task table, and a log.
- **Task status lives only in the ledger**; `tasks.md` holds the task definitions.
- The log is a record: it is only appended to, never rewritten.
- The master writes **one ledger update per event** (header, task row and log line together), with the
  time read from the clock once per event, never estimated. The measured sample run showed that
  bookkeeping in many small edits was the largest single cost.
- A **workflow-state note** (2–3 lines from the ledger: feature, stage, next step) is added to each
  user message, so the agent always knows where it is. A message that contains the project's skip
  keyword (suggested `#nostate`) gets no note.

## Consequences
- Any session can resume a feature by reading one file.
- A broken header blocks gated edits until it is repaired; `specs/` stays editable for that.

**Replaces internal records:** D46 (ledger as the durable record), D65 (workflow-state note), B5, B33,
B50 (cost #1).
