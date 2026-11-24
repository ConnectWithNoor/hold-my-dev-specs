# How it works

The [README](../README.md) shows the method from the outside. This page explains the parts inside the
plugin: what each one is for, when it comes into play, and what it may and may not do. The exact rules
live in the guides and decision records linked below; this page points to them instead of repeating them.

**Contents:** [Skills](#skills) · [Helpers](#helpers-agents) · [Hooks](#hooks) · [One task, step by step](#one-task-step-by-step) ·
[Evals](#evals) · [Saving context and usage](#saving-context-and-usage)

## Skills
A **skill** is a set of instructions Claude loads when the situation fits. The agent starts these three
by itself when you ask for something that matches; typing `/hold-my-dev-specs:<name>` works too. They
are for software projects only.

| Skill | Role | Comes into play | May | May not |
|---|---|---|---|---|
| `setup` | Interviews you and writes the project settings (`.claude/hold-my-dev-specs.json`) | A project without settings, unfinished settings, or "change the settings" | Propose values it found in the repo, offer allow rules for your test commands, offer the spec-miner for existing code | Fill in any value you didn't confirm |
| `feature` | Runs one change through the whole lifecycle ([playbook](../guides/lifecycle.md)) | "Build / change / fix …" in a set-up project, or continuing the active feature | Write the spec, rubric, plan, tasks and ledger; start helpers; commit verified tasks; merge after your OK | Write approvals itself, change approved documents, write the code or the tests itself |
| `retro` | Looks back on a feature and proposes lessons; first a "break-loop" analysis when a task kept failing or a bug got past the checks | A finished feature, "what can we learn", or the fix-round limit | Read the records, propose up to 5 lessons, write and commit the ones you approve | Write anything without your yes, run tests, edit a finished feature's documents |

## Helpers (agents)
A **helper** is a separate Claude agent that the master starts for one job. It begins with an empty
memory, gets a short brief, writes a report, and replies to the master. Helpers never start other
helpers. Which model each one uses comes from your settings, by **tier** (see
[ADR-0003](adr/0003-model-tiers.md)): `strongest` for judgement, `mid` for the rest.

| Helper | Tier | Role | May write | May not |
|---|---|---|---|---|
| `test-author` | strongest | Turns each acceptance check into a test, before the code exists; the tests must fail for the right reason | Test paths + its report (with a fingerprint of every test file) | Write the implementation |
| `implementer` | mid | Makes one task's tests pass; also the **fresh fixer** after a failed check | Source code (only after both approvals) + its report | Touch tests, specs, quality configs, CI or other protected files |
| `verifier` | strongest | The independent critic: checks changed files and test fingerprints, runs the tests, scores the rubric, decides PASS or FAIL; also checks the whole feature and special risk areas | Its report only | Change anything else, write check files, use `/tmp` |
| `explorer` | mid | Reads code or outside docs so the master doesn't have to | Its report only (nothing when no feature is active) | Change files |
| `shipper` | mid | Runs your deploy and monitor commands exactly as configured, after your manual review | Its report only | Change code to make shipping work, improvise commands |
| `spec-miner` | strongest | Records what existing code does today, with `file:line` evidence, as a baseline for later specs | `specs/baseline/` only | Write what the code *should* do |

All helpers, and any other agent: never `.claude/`, `.mcp.json`, any `CLAUDE.md` or `.git/`; no
`git stash`, `reset --hard`, `merge`, `cherry-pick`, `revert` or branch changes; a refused command is
reported, never retried in another form. The full table: [guides/artifacts.md](../guides/artifacts.md).

## Hooks
A **hook** is a small script Claude Code runs automatically at a fixed moment, for example before every
file write. Hooks are what turn the method's rules into checks. All of them do nothing in a project
without the settings file (except letting the plugin's own guides be read).

| Hook | Runs before / at | What it does | If the script itself fails |
|---|---|---|---|
| `pre-tool.sh` → `pre-tool.js` | every file write, shell command and helper start | **Plan gate** (no code before both approvals), write rights per helper, approval values only from your phrases, locked approved documents, guarded paths, the safety copy; for a helper start: fills in the tier's model and pastes the files from the task's manifest | **Blocks** the action (fail closed) |
| `pre-read.js` | every Read and Grep | Lets the plugin's guides be read without a prompt; denies reading secret files while the safety copy is on | Lets the read through (a broken script must never block every read) |
| `prompt-submit.js` | every message you send | Records exact approval phrases, hints at the exact phrase after a near miss, adds the short status note | Lets the message through, shows ⚠ |
| `stop.js` | the end of each reply | `strict` profile only: while building, runs your format / lint / typecheck commands when source files changed | Lets Claude stop, shows ⚠ |

Why the failure modes differ, and why the blocking entry starts with a tiny `sh` wrapper:
[ADR-0009](adr/0009-hook-runtime-and-failure-modes.md). What the checks can't see:
[README limits](../README.md#what-the-protections-can-and-cant-do).

## One task, step by step
The master runs the tasks in order (independent tasks may run side by side). For one task:

```mermaid
sequenceDiagram
    participant M as Master
    participant TA as Test author
    participant IM as Implementer
    participant VE as Verifier
    M->>TA: brief for T01 (the hook adds the files and the model)
    TA->>TA: write tests and run them: they fail for the right reason
    TA-->>M: report with test fingerprints
    M->>IM: brief for T01, base commit noted
    IM->>IM: change source code until the tests pass
    Note over IM: hooks block writes to tests, specs and protected files
    IM-->>M: report
    M->>VE: round 1, base commit, mode task
    VE->>VE: list changes, recheck fingerprints, run tests, score the rubric
    alt PASS
        VE-->>M: PASS with score and evidence
        M->>M: ledger says verified, one commit for the task
    else FAIL
        VE-->>M: FAIL with findings
        M->>IM: fresh implementer as fixer: task, findings, changed files
        Note over M,VE: verify again; after the fix-round limit, ask the user
    end
```

After the last task: one verifier checks the whole feature, the master runs a short final check
(reports, full test run, risky areas, evidence for every check), then asks you for the manual review.
Details: [guides/lifecycle.md](../guides/lifecycle.md).

## Evals
An **eval** is a short, automatic Claude session that checks the plugin's behaviour from the outside.
The suite (`evals/`, run with `npm run eval`) has 18 cases: for each skill, three requests that should
start it and three that shouldn't (learning questions, non-software tasks). A case passes only when the
right skill started and no other. Each run costs real usage (about $1.60), so maintainers run it before a
release: three runs, each 18/18 ([results](research/s10-evals.md)). The free unit tests (`npm test`)
cover every hook decision.

## Saving context and usage
Each Claude session has a limited **context** (what it can keep in mind at once), and every call re-reads
it, so a larger context costs more. The plugin keeps it small:

- **Always-on cost: about 905 tokens per session** (a token is roughly ¾ of a word), measured with
  `claude plugin details`: the three skill descriptions (~130 each) and six helper descriptions
  (~80–110 each). Hooks add nothing. Full instructions load only when used: setup or retro about 2,200
  tokens, the feature skill about 850 plus the guides it reads, a verifier about 1,800.
- **Context manifests:** for each task the master lists exactly the files a helper needs; a hook pastes
  them into the brief, within size limits (suggested 32 KB per file, 128 KB in total), and never pastes
  secret-looking, outside or binary files ([ADR-0011](adr/0011-context-manifests.md)).
- **Model tiers:** only the judgement roles use the strongest model; building, exploring and shipping use
  the `mid` tier.
- **Short status note:** two or three lines from the ledger on each message (stage, next step), instead
  of re-reading files; a skip keyword turns it off for one message.
- **Compaction** (summarising the conversation to free space) only at breakpoints: after the spec, after
  the plan, between tasks, never in the middle of one. The ledger lets any fresh session continue.
- **Fewer calls:** one ledger update per event and one clock read per event, because each extra call
  re-reads the whole conversation.

**Measured costs** (list prices, one small feature; [details](research/sample-run.md)):

| Part | Cost |
|---|---|
| A full small feature (setup, spec, plan, 2 tasks, checks) | about $3.20; the master's own work was 73 % of it |
| Biggest single part: the master during the build (bookkeeping) | $1.05, the reason for the one-update-per-event rule |
| The three verifier runs | $0.47 |
| A retro (two turns) | $0.51 |
| A run from your OK to shipped | $0.32 |
