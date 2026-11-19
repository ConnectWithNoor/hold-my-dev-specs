#!/usr/bin/env bash
# The configured project with one finished feature whose task T01 hit the fix-round cap.
set -euo pipefail
bash "$(dirname "$(readlink -f "$0")")/configured.sh"
mkdir -p specs/001-greeting/reports
: > specs/ACTIVE
cat > specs/001-greeting/ledger.md <<'MD'
---
feature: 001-greeting
lane: full
stage: done
awaiting: none
spec_approved: 2026-11-18T10:00:00Z
plan_approved: 2026-11-18T10:20:00Z
active_task: none
---
# Ledger — 001-greeting

## Tasks
| Task | Status | Round | Report |
|---|---|---|---|
| T01 | verified | 4 | reports/T01-verify-4.md |

## Log
- 2026-11-18T10:00:00Z — spec approved (approval phrase received)
- 2026-11-18T10:20:00Z — plan approved (approval phrase received)
- 2026-11-18T11:30:00Z — T01 failed verification 3 times (fix-round cap); user asked to continue with a changed brief
- 2026-11-18T12:10:00Z — T01 verified in round 4
- 2026-11-18T12:30:00Z — feature done, merged into main
MD
printf '# Spec — 001-greeting\n\n### R1 — Greeting\n- **AC1.1** Given a name When greet is called Then it returns "Hello, <name>!"\n' > specs/001-greeting/spec.md
git add -A && git commit -q -m "chore(specs): 001-greeting done"
