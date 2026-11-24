# hold-my-dev-specs

A Claude Code plugin for **spec-driven development**: you explain what you want, the AI writes a
spec (a short description of what to build and how to check it) and a plan for you to review, and
only after your approval does it build the work in small, checked steps.

**Status:** version 0.1.0, complete and tested on Linux, before its first release. It isn't published
yet: install it from a local copy (below).

## Install
In Claude Code, from a local copy of this repository (it is its own marketplace):
```
/plugin marketplace add /path/to/hold-my-dev-specs
/plugin install hold-my-dev-specs@hold-my-dev-specs
```
The plugin does nothing in a project until you set it up there.

## Quick start
1. In a software project, say "set up this project for hold-my-dev-specs". Setup asks a few groups of
   questions (models, how strict, which paths, test commands, how you ship) and writes
   `.claude/hold-my-dev-specs.json`.
2. Ask for a change, e.g. "add a command-line tool that prints a greeting". The agent asks about your
   goal, then writes a spec and a scoring sheet (rubric) in `specs/001-…/`.
3. Read them and type the phrase it shows. Then the plan, the same way. After that, helper agents write
   the tests, the code and the checks; the agent asks you only when something needs your decision.
4. Check the result when asked ("checked, OK to ship"). Afterwards, "what can we learn from this
   feature?" starts a short retro.

**The approval phrases** — type the whole message exactly, nothing else in it:

| You type | When |
|---|---|
| `approve spec` | the spec and rubric are right |
| `approve plan` | the plan is right (after the spec) |
| `approve both` | quick lane for tiny changes: one short spec holds the plan too |
| `revoke` | any time: takes both approvals back and stops the building |

Each phrase shows a confirmation line (`✅ Spec approved 19:20`, `↩ Approvals revoked …`). A phrase
with anything added records nothing.

**How strict** (chosen at setup; details: [guides/project-config.md](guides/project-config.md)):

| Profile | What it adds |
|---|---|
| `minimal` | approvals, plan gate, builders kept away from tests and protected files |
| `standard` (suggested) | + safety rules, helper briefs with the files they need, a status note on each message |
| `strict` | + format / lint / typecheck **run automatically** after each reply while building (the commands from your settings, outside the permission prompts); protected files locked for the main agent too |

## Requirements
- **Claude Code 2.1.295 or newer.** Older versions can't make a crashing safety check block the
  action, so the plugin's protections wouldn't be reliable.
- **Node.js 22 or newer.** Node.js runs the plugin's small check scripts (hooks). Check it the way the
  hooks see it: `sh -c 'node --version'` (Node loaded only in interactive shells, e.g. by a version
  manager, doesn't count). Without Node, projects that use the plugin block every edit, shell command
  and helper start, on purpose: the checks can't run. Other projects are not affected. To recover,
  install Node, or turn the plugin off with `/plugin`.
- Tested on **Linux only** so far.

## Permission prompts to expect
- **Setup writes into `.claude/`.** Claude Code always asks before changing files there, so setup's
  settings file (and allow rules, if you choose them) each show one prompt.
- **Project commands such as `npm test`** ask every time in `acceptEdits` mode. Setup offers allow
  rules so they run without asking, either shared with the team or just for you. It also warns when a
  builder could change what an allowed command runs (for example `package.json` isn't protected).
- **Merging into the main branch** may ask once if your own safety rules guard it. That is expected,
  not an error. Commits may also ask, unless you allow `git commit`.

## What the protections can and can't do
The plugin's checks stop careless mistakes, such as a helper editing tests or code changing before you
approved the plan. They are **best-effort, not airtight**:
- A script run inside a shell command can still change files without the checks seeing it.
- File names that a command gets from somewhere else (for example `xargs cat < list.txt`) can't be
  seen by text checks either, and neither can some rarer in-place edits (`awk -i inplace`,
  `find … -exec sed -i …`).
- Helpers can't run `git stash`, `reset --hard`, `merge`, `cherry-pick`, `revert` or change branches,
  but the main agent can; the safety rules ask before the ones that can lose work.
- An approval is recorded from the message text alone. A prompt that the main agent sends itself (a
  scheduled or repeated prompt) reaches the same check; the ✅ line shows when anything was recorded.
- A Grep over a whole folder can still read secret files; Claude Code's deny rules below are the real
  protection.

A separate review step (the verifier's comparison of all changes) catches what slips through.

**Safety rules.** The plugin also brings a safety copy: it blocks secrets and dangerous commands, and
asks before risky ones. It works only in projects that have `.claude/hold-my-dev-specs.json`, and it
never blocks reading files because of its own error. For secrets, also add Claude Code's built-in deny
rules to your `~/.claude/settings.json`. Claude Code enforces them itself, with no script involved:
```json
{ "permissions": { "deny": ["Read(//**/.env)", "Read(//**/.envrc)", "Read(//**/*.pem)", "Read(//**/*.key)", "Read(~/.ssh/**)", "Read(~/.aws/**)"] } }
```
If you already have your own safety hooks, switch the copy off: add `"HOLD_MY_DEV_SPECS_SAFETY": "off"`
to the `env` section of the same file.

## Developer notes
- Why the plugin works the way it does: [decision records](docs/adr/README.md).
- Run the tests: `npm test` (uses Node's built-in test runner; nothing to install).
- Run the skill-trigger evals: `npm run eval` (18 short Claude sessions that check each skill starts
  when it should and not otherwise; costs usage, about $1.50 per run).

## License
[MIT](LICENSE): free to use, change and share; keep the copyright notice.
