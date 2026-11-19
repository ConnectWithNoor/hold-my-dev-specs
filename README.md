# hold-my-dev-specs

A Claude Code plugin for **spec-driven development**: you explain what you want, the AI writes a
spec (a short description of what to build and how to check it) and a plan for you to review, and
only after your approval does it build the work in small, checked steps.

**Status:** in development. Not ready to use yet.

## Requirements
- **Claude Code 2.1.295 or newer.** Older versions can't make a crashing safety check block the
  action, so the plugin's protections wouldn't be reliable.
- **Node.js 22 or newer.** Node.js runs the plugin's small check scripts (hooks).
- Tested on **Linux only** so far.

## What the protections can and can't do
The plugin's checks stop careless mistakes, such as a helper editing tests or code changing before you
approved the plan. They are **best-effort, not airtight**:
- A script run inside a shell command can still change files without the checks seeing it.
- File names that a command gets from somewhere else (for example `xargs cat < list.txt`) can't be
  seen by text checks either.

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
- Run the tests: `npm test` (uses Node's built-in test runner; nothing to install).
- Run the skill-trigger evals: `npm run eval` (18 short Claude sessions that check each skill starts
  when it should and not otherwise; costs usage, about $1.50 per run).

## License
[MIT](LICENSE): free to use, change and share; keep the copyright notice.
