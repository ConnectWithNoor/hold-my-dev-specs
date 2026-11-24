#!/bin/sh
# Blocking PreToolUse entry. Checks for the project settings before starting Node, so the plugin stays
# inert in projects without them even when Node is missing. Projects with settings stay fail-closed:
# no Node there → this fails → Claude Code blocks the action (README "Requirements").
# Without CLAUDE_PROJECT_DIR, Node decides from the hook input as before.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ ! -f "$CLAUDE_PROJECT_DIR/.claude/hold-my-dev-specs.json" ]; then
  exit 0
fi
exec node "$(dirname "$0")/pre-tool.js"
