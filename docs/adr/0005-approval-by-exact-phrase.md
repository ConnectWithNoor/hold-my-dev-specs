# ADR-0005 — Approvals are typed phrases recorded by a hook

**Status:** Accepted (2026-11-18)

## Context
The gate on source code ([ADR-0006](0006-plan-gate-and-write-rights.md)) is only as strong as the
approval behind it. If an agent could write "approved" into the record itself, the gate would mean
nothing. The prompt hook also receives messages that are not the user's (background helper reports,
scheduled `/loop` prompts, messages from other sessions), and nothing in the hook's input tells them
apart.

## Decision
- The user approves by typing an **exact phrase**: `approve spec`, `approve plan`, or `approve both`
  (quick lane). A prompt hook records it with a timestamp in the ledger header.
- An approval counts only when **all three** hold:
  1. the whole message, trimmed and ignoring upper/lower case, is exactly the phrase;
  2. the ledger's `awaiting` field names that same approval (`approve plan` also needs the spec to be
     approved already);
  3. the user sees a one-line confirmation, e.g. `✅ Plan approved 19:20`.
- **`revoke`**, typed alone, clears both approvals at any time and closes the gate (`↩` line).
- **Agents can never write approval values:** the gate compares the ledger header before and after
  every agent edit and denies any change to them.
- **Approved documents are locked:** after `approve spec`, nobody (the master included) may change that
  feature's `spec.md` or `rubric.md`; after `approve plan`, `plan.md`. Changing one means `revoke`, the
  change, and a new approval. `tasks.md` stays editable.
- After a `revoke` with nothing to change, the agent asks for the approvals again right away.
- A short message that starts with "approve" but isn't exact (`approve spec.`) records nothing and
  shows one line with the exact phrase the ledger is waiting for.
- No one-time codes: they add friction for little extra safety, given the three conditions above.

## Consequences
- An approval can't be faked by an agent, a helper report or another session through the file tools.
  Interpreter scripts remain a known limit ([ADR-0006](0006-plan-gate-and-write-rights.md)).
- **Known limit:** the hook sees only the message text. A prompt the master sends itself (scheduled or
  repeated) at the moment `awaiting` matches would be recorded; the ✅ line makes it visible, and the
  README names this limit.
- The user has to type the phrase exactly; the agent always tells them which one.

**Replaces internal records:** B24, B30, B35 (order), B50 (e), B52 (R10, R24).
