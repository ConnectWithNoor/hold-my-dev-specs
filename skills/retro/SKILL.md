---
name: retro
description: Looks back on a hold-my-dev-specs feature in a software project and proposes lessons for the user to approve, then writes the approved ones where they belong. Use when a feature reaches the done stage, when the user asks what to learn from the last feature, or — as a break-loop analysis — when the fix-round cap was hit or a bug got past the verifier. Software projects only.
---
# Retro: learn from the last feature

You are the master. Goal: a few **useful, approved** lessons, written in the right place.
**Nothing is written without the user's yes** — no lesson, no report, no change to a spec or to
`CLAUDE.md`.

Run the **break-loop analysis** (part A) first when either of these happened:
- the **fix-round cap** was hit on a task (the verifier failed it `fixLoop.maxRounds` times), or
- a **bug got past the verifier**: something the verifier passed turned out to be wrong later (in the
  manual review, after shipping, or found by a later feature).

Then do the normal lessons (part B). Without either trigger, skip straight to part B.

## A. Break-loop analysis — why did this get through?
Goal: understand why the loop didn't catch the problem, so the same kind of problem is caught next
time. You **analyse and propose**; you don't fix code here. A fix for the bug itself is a new piece of
work through the `feature` skill (often the quick lane).

### A1. Gather the evidence
For the task or bug in question, read the ledger lines, the spec criteria involved, the test author's,
implementer's and verifier's reports for every round, and the code or test that was finally wrong
(read with the Read tool). Note what each round tried and what changed between rounds.

### A2. Write the analysis (shown to the user, not saved yet)
```
Trigger:      fix-round cap on <task> · bug got past the verifier (<where it showed up>)
What went wrong: <one or two plain sentences, with file:line>
Root cause:   one of
  - missing spec — the spec never said what should happen here
  - cross-layer contract — two parts expected different things from each other
  - change propagation — a change in one place wasn't carried to the places that depend on it
  - test gap — the behaviour was specified, but no test checked it (or the test checked the wrong thing)
  - implicit assumption — someone relied on something that was never written down or checked
Why the earlier fixes failed: <per round: what the fixer changed, and why it didn't solve the cause>
Prevention:   <what would have caught it: a spec criterion, a test, a rubric line, a playbook step>
Similar places: <other files or features with the same pattern, checked with Grep / Read — say which
               you checked and what you found; "none found" is a valid answer>
Sure:         low · medium · high
```
Pick exactly one root cause; if two fit, name the main one and mention the other in one line.

### A3. Turn it into proposals
Each proposal names **what** changes, **where**, and **why** (pointing at the analysis):
- **Spec / rubric / plan** — e.g. a missing Given/When/Then criterion or a missing rubric line.
  - **Feature still active:** approved documents are locked, so the user types `revoke` first, then you
    change them, then ask for approval again (as in the playbook).
  - **Feature already done:** its spec, rubric and plan stay exactly as they are — a finished feature is
    a record and stays locked. The correction becomes a **new feature**, whose spec names the old
    criterion it replaces (e.g. "replaces AC2.3 of 001-slugify").
- **Project `CLAUDE.md`** — a lesson line (trigger → action), as in part B.
- **Similar places** — each one becomes its own piece of work for the `feature` skill, not a silent edit.

### A4. Ask, one by one — then write only what was approved
For the analysis itself: **save** it as `specs/<feature>/reports/break-loop-<task>.md` (or
`break-loop-<short-name>.md` for a bug found later), or **don't save**. For each proposal: **do it**,
**edit**, or **skip**. Write nothing the user didn't say yes to.

## B. Lessons

### B1. Gather the evidence
Read the feature's ledger (log and task table) and its reports in `specs/<feature>/reports/`, and
think back over this conversation: where did the user correct you, where did a task need fix rounds,
where did a helper disagree, where did something cost more than planned?

### B2. Propose lessons
At most 5, the most useful first, each in this shape:
```
When: <the situation that triggers it>
Do:   <the action, one sentence>
Why:  <evidence — ledger line, report, the user's correction>
Sure: low · medium · high
```
Only lessons that would change what someone does next time. No praise, no general advice. A lesson
that the break-loop analysis already proposed isn't repeated here.

### B3. Ask, one by one
For each lesson, the user chooses: **project** (write it), **edit** (change it, then write), **skip**.
Also ask whether they have seen the same lesson in another project.

### B4. Write the approved ones
- **Project lessons** → the project's `CLAUDE.md` (a short "Lessons" section; one line each,
  trigger → action). Check first that it doesn't repeat or contradict what is already there; update
  the old line instead of adding a near-copy.
- **Seen in 2 or more projects** → offer it for the user's global instructions
  (`~/.claude/CLAUDE.md`, or the user's own tool for their global setup if they have one). That file
  is outside the project: say exactly what you'd add, and write it only after the user's yes.

End with the report: analysis saved or not · proposals done / edited / skipped (where) · lessons
written (where) · next step.
