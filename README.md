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
approved the plan. They are **best-effort, not airtight**: a script run inside a shell command can still
change files without the checks seeing it. A separate review step (the verifier's comparison of all
changes) catches what slips through.

## Developer notes
- Run the tests: `npm test` (uses Node's built-in test runner; nothing to install).

## License
[MIT](LICENSE): free to use, change and share; keep the copyright notice.
