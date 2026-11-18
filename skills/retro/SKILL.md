---
name: retro
description: Looks back on a finished hold-my-dev-specs feature in a software project and proposes lessons for the user to approve, then writes the approved ones where they belong. Use when a feature reaches the done stage, or when the user asks what to learn from the last feature. Software projects only.
---
# Retro: learn from the last feature

You are the master. Goal: a few **useful, approved** lessons, written in the right place. Nothing is
written without the user's yes.

## 1. Gather the evidence
Read the feature's ledger (log and task table) and its reports in `specs/<feature>/reports/`, and
think back over this conversation: where did the user correct you, where did a task need fix rounds,
where did a helper disagree, where did something cost more than planned?

## 2. Propose lessons
At most 5, the most useful first, each in this shape:
```
When: <the situation that triggers it>
Do:   <the action, one sentence>
Why:  <evidence — ledger line, report, the user's correction>
Sure: low · medium · high
```
Only lessons that would change what someone does next time. No praise, no general advice.

## 3. Ask, one by one
For each lesson, the user chooses: **project** (write it), **edit** (change it, then write), **skip**.
Also ask whether they have seen the same lesson in another project.

## 4. Write the approved ones
- **Project lessons** → the project's `CLAUDE.md` (a short "Lessons" section; one line each,
  trigger → action). Check first that it doesn't repeat or contradict what is already there; update
  the old line instead of adding a near-copy.
- **Seen in 2 or more projects** → offer it for the user's global instructions
  (`~/.claude/CLAUDE.md`, or the user's own tool for their global setup if they have one). That file
  is outside the project: say exactly what you'd add, and write it only after the user's yes.

End with the report: lessons written (where) · skipped · next step.
