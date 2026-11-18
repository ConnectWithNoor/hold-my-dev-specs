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

## License
[MIT](LICENSE): free to use, change and share; keep the copyright notice.
