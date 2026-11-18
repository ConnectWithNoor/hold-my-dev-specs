# Tasks — NNN-short-name

Written after `approve plan`. Each task is the smallest piece that can be built and checked on its own.
Status is **not** kept here; it lives in the ledger.

| Task | What | Depends on | Parallel | Files | Criteria | Check (command → expected) | Tier |
|---|---|---|---|---|---|---|---|
| T01 | … | — | no | `src/…` | AC1.1 | `npm test -- login` → 3 passed | mid |

- **Parallel:** `yes` only when the task touches no file another open task touches.
- **Tier:** `mid` for implementer work; the master picks the model from the project settings.
