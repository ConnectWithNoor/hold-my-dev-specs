# Feature lifecycle — the master's playbook

How the master (the main Claude session) takes one change from idea to shipped. The `feature` skill
follows this file. File formats: [artifacts.md](artifacts.md), [ledger.md](ledger.md); settings:
[project-config.md](project-config.md). Hooks enforce the gate, the approvals and who may write what;
this playbook says what to do so they never need to stop you.

```
intent → spec ──approve spec──→ plan ──approve plan──→ tasks → build ⇄ verify → validate → review → ship → done
          └──────────────── quick lane: one short spec ── approve both ─────────────┘
```

## Ground rules
- **One active feature** at a time (`specs/ACTIVE`). If one is open and the user wants something new,
  ask: finish it first, or pause it (point `ACTIVE` at the new one; the old ledger keeps its state).
- **The ledger is the record.** Update it after every step: header (`stage`, `awaiting`, `active_task`),
  the task table, one log line. A fresh session must be able to continue from it alone. Never write
  approval values, never log approvals (the approval hook does both).
- **Real timestamps.** Every log line gets its time from the clock (`date -u +%Y-%m-%dT%H:%M:%SZ`);
  never estimate or round a time.
- **Write specs and the ledger with Write / Edit**, never through shell redirection (`>`, `sed -i`,
  `tee`); the hook accepts ledger changes only through Edit / Write. Create a new ledger by reading the
  template and writing the filled-in file with Write.
- **Read with the Read tool**, not shell `cat` / `sed` / `head`: plugin guides and templates, and project
  files. Reads of the plugin's own docs then need no permission prompt in any mode.
- **Ask, never default.** Anything missing that changes the result: pause, ask, write the answer where it
  belongs (spec, plan, or the project settings via `setup`).
- **Plain words** in everything you write and say; explain each term the first time.
- **Save usage limits:** delegate heavy reading to the explorer; give helpers only what they need
  (the context manifest); compact only at breakpoints (after spec, after plan, between tasks), never
  in the middle of a task.

## 1. Intent
Interview the user until goal, users, why, scope, out-of-scope and constraints are clear. Restate them
and wait for confirmation. Then:
- **Lane.** A tiny, low-risk change (a typo, a one-line bug) → propose the quick lane; the user
  confirms. Everything else → full lane.
- **Branch** from the main branch: `feat/NNN-short-name` (git rules: one branch per feature, never commit
  to main).
- **Folder** `specs/NNN-short-name/` (next free number), `ledger.md` from the template
  (`stage: spec`, `awaiting: none`, approvals `no`), and point `specs/ACTIVE` at it.

## 2. Spec (full lane)
If `specs/baseline/` exists, read the baseline files of the areas this change touches first: they say
what the code does today. The spec **links** to the baseline criteria it changes (section "Baseline it
changes", e.g. "`specs/baseline/auth.md` BR1.2 → replaced by AC1.1") and never copies them; baseline
files are a record and are never edited by a feature.
Write `spec.md` and `rubric.md` from the templates. Every requirement gets Given/When/Then criteria
with ids; every criterion gets evidence in the rubric. Use the explorer for facts you'd otherwise have
to read a lot for. **Open questions must be empty.** Then set `awaiting: spec` and ask the user to
review both files and type exactly `approve spec`. Change requests: edit, ask again. Don't move on
until the ✅ line appears.

**Quick lane:** one `spec.md` from `spec-quick.md` (intent, criteria, 3-line plan) + `rubric.md`;
`awaiting: both`; the user types `approve both`. Add `T01` to the ledger's task table as `todo`, set
`stage: build`, and go to step 5 with that single task. A manifest is optional: without one, the
helper gets the "no manifest" note and reads what it needs itself.

## 3. Plan
`stage: plan`. Write `plan.md`: approach, changes per requirement, interfaces, **test seams**, risks
(name any `highRiskAreas`), how the user will check and how it ships. Set `awaiting: plan`; the user
types `approve plan`.

## 4. Tasks
`stage: tasks`. Write `tasks.md`: smallest independently checkable units, dependency order, files,
criteria, check command with expected result, tier. Mark `Parallel: yes` only when the task shares no
file with another open task. Write one manifest per task (`manifests/T01.json`): the spec, rubric,
plan parts and source files that helper needs, nothing more. Add the tasks to the ledger as `todo`.
Then `stage: build`.

## 5. Build — per task
Tasks run in the order of `tasks.md`. **Parallel tasks:** tasks marked `Parallel: yes` whose
dependencies are all `verified` may run at the same time — each gets its own test author → implementer
→ verifier chain, and the ledger records each task's verdict separately. Commits stay **one per task,
one at a time**, after that task's PASS. Parallel helpers add up against the user's usage limits, so
run tasks side by side only when the time saved is worth it.

Start every helper brief with the line `hmds-task: <feature>/<task>`. The hooks paste the manifest and
fill in the tier's model; name a model only to escalate on purpose.
1. **Test author** (`test-author`): the task's criteria and test seams. Its tests must fail for the
   right reason. Problems with a criterion → see "Spec problems" below.
2. **Implementer** (`implementer`): the task row; it makes the tests pass. Note the commit it started
   from (`base`).
3. **Verifier** (`verifier`): round number, `base`, `mode: task`. If the task changed files in
   `verification.highRiskAreas`, also start one verifier per active lens with `mode: lens:<name>`; the
   task passes only if **all** of them pass.
4. **FAIL** → a **fresh** implementer as fixer, brief = task + the verifier's findings + the files
   changed so far; then verify again (next round). After `fixLoop.maxRounds` failed rounds: stop and ask
   the user, with the reports as evidence, and offer the `retro` skill's **break-loop analysis** (why
   the rounds didn't solve it) before deciding how to go on.
5. **PASS** → task `verified` in the ledger, then **one commit** for the task (Conventional Commits:
   `type(scope): summary`, body names the feature and task; no AI attribution lines).

Ledger during the loop: `active_task`, the task's status (`in-progress` → `verifying` → `fixing` →
`verified` / `failed` / `blocked`), round, report path, one log line per step.

**Disagreements.** An implementer says a test is wrong → check it yourself; a real test mistake goes
back to the test author with the evidence. **Spec problems** (a criterion is wrong, missing or
contradicts another — from any helper) → pause, explain the gap to the user with evidence, propose the
spec change. The spec is locked, so the user types `revoke`, you change spec / rubric / plan, and ask
for approval again. Never work around a locked file.

**Stop and ask** (besides the round cap): no progress over two checkpoints, the same failure repeating,
or the work costing far more than planned.

**Revoke during the build.** If the user types `revoke`: stop starting helpers at once, tell the user
which tasks are verified and which are not, go back to spec review (`stage: spec`), and start nothing
until both approvals are in again.

## 6. Validate
`stage: validate`. One verifier in `mode: convergence` over the whole feature. Then your own **lean
final check**: read the reports, run the full test suite once, spot-check the risky areas, and confirm
every acceptance criterion has evidence. Write `reports/final-check.md`: per criterion → evidence; test
run result; anything open.

## 7. Review
`stage: review`. Ask the user to check the result (`ship.manualReview`: local or staging), with exact
steps to try it. Wait for a clear yes ("checked, OK to ship"). Problems → back to build (bug) or spec
(wrong requirement). A bug found here **got past the verifier**: offer the `retro` skill's break-loop
analysis once it is fixed. The same goes for a bug found after shipping or by a later feature.

## 8. Ship
`stage: ship`. Merge the feature branch as `git.merge` says (`local`: fast-forward into the main
branch; `pr`: open a pull request — leaving the machine always needs the user's permission). If
`ship.deploy` is set, start the `shipper`. A failed ship → report with evidence and ask.

## 9. Done
`stage: done`, clear `specs/ACTIVE`, report to the user (done · how it was checked · what's left ·
next step), and offer the `retro` skill (it starts with the break-loop analysis if a task hit the round
cap or a bug got past the verifier).
