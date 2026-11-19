#!/usr/bin/env bash
# The small Node project, set up for hold-my-dev-specs (settings + CLAUDE.md), no active feature.
set -euo pipefail
bash "$(dirname "$(readlink -f "$0")")/repo-with-code.sh"
mkdir -p .claude
cat > .claude/hold-my-dev-specs.json <<'JSON'
{ "schemaVersion": 1, "profile": "standard", "disabledHooks": [],
  "models": { "strongest": "sonnet", "mid": "haiku" },
  "paths": { "open": ["specs/**", "docs/**", "CLAUDE.md"], "protected": [".claude/**", "package.json"], "tests": ["test/**"] },
  "commands": { "test": "npm test", "lint": null, "format": null, "typecheck": null },
  "verification": { "signals": ["code-only"], "tools": null, "passThreshold": 7, "lenses": ["silent-failure"], "highRiskAreas": null },
  "fixLoop": { "maxRounds": 3 }, "contextManifest": { "maxFileBytes": 32768, "maxTotalBytes": 131072 },
  "workflowState": { "skipKeyword": "#nostate" },
  "ship": { "manualReview": "local", "deploy": null, "monitor": null },
  "git": { "mainBranch": "main", "merge": "local" } }
JSON
cat > CLAUDE.md <<'MD'
# greet-demo

## Spec-driven development
This project is built with the hold-my-dev-specs plugin. Settings: [.claude/hold-my-dev-specs.json](.claude/hold-my-dev-specs.json). Specs live in `specs/`.
MD
git add -A && git commit -q -m "chore(setup): add hold-my-dev-specs settings"
