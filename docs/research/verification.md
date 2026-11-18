# S0 — verified facts

Checked 2026-11-18 on Claude Code 2.1.311, Node v24.22.3 (Linux). "Probe" = run locally with a throwaway plugin
(`claude -p --plugin-dir … --include-hook-events`); "Docs" = official docs, source linked.

## Hooks
| Fact | How we know | Effect on the build |
|---|---|---|
| Inside a helper, hook input has `agent_id` and `agent_type`. A plugin helper arrives **prefixed**: `agent_type: "hmds-probe:echoer"`. Main-session tool calls carry neither field (unless the session runs with `--agent`) | Probe; [hooks docs](https://code.claude.com/docs/en/hooks) | Integrity hook (D42) identifies builders by `hold-my-dev-specs:<agent>`; still accept the bare name too (agreed in review 2). No `agent_type` → main agent (master) |
| PreToolUse fires for tool calls inside helpers | Probe + docs | Gate and integrity cover helpers |
| PreToolUse on the Agent tool sees `prompt`, `description`, `subagent_type`, `model`, `run_in_background` | Probe | Context-manifest hook reads `subagent_type` + task id from `prompt` |
| `updatedInput` on the Agent tool **rewrites the helper's brief**: an appended marker reached the helper verbatim | Probe | Context manifest (D65) works as designed. `updatedInput` replaces the whole input, so copy all fields |
| Agent tool accepts a `model` alias at spawn (`"model": "haiku"` passed through) | Probe | Master passes the tier's model from project config; no model names in plugin text (D36) |
| `env` from settings (`--settings '{"env":{…}}'`) is visible to plugin hook processes | Probe | B25 switch works as an `env` entry |
| UserPromptSubmit gets `prompt`; also fires for helper reports, `/loop`, other sessions, Code Mode | Probe + docs | B24's three rules stay needed |
| UserPromptSubmit `systemMessage` is delivered as a user-facing notice: `UserPromptSubmit says: <text>` | Probe (stream event `system/informational`, level `notice`) | ✅ confirmation line works; look at it once in the interactive UI during S8 |
| `"onFailure": "block"` on a hook entry: a crashing hook **blocks** the action ("blocking because onFailure is \"block\""); needs Claude Code ≥ 2.1.295 | Probe + docs | Native fail-closed. Plain exit 1 is non-blocking, so scripts also exit 2 on bad input |
| PreToolUse output: `hookSpecificOutput.permissionDecision` = `allow` / `deny` / `ask` / `defer` + `permissionDecisionReason`; precedence deny > defer > ask > allow | Docs | Dispatcher output format |
| Default timeouts: command hooks 600 s; UserPromptSubmit command hooks 30 s | Docs | Keep the approval and workflow-state hooks fast |

## Plugin format
| Fact | How we know |
|---|---|
| Manifest `.claude-plugin/plugin.json`; only `name` required; optional `version`, `description`, `author{name,email,url}`, `homepage`, `repository`, `license`, `keywords`, `engines`, `userConfig`, … | [plugins-reference](https://code.claude.com/docs/en/plugins-reference) |
| Default folders at plugin root: `skills/<name>/SKILL.md`, `agents/*.md`, `hooks/hooks.json`; `${CLAUDE_PLUGIN_ROOT}` = install folder | Docs + probe |
| `marketplace.json` in `.claude-plugin/`; needs `name`, `owner`, `plugins[]`; `"source": "./"` for a plugin at the repo root **validates** | Docs + `claude plugin validate` |
| Plugin agents may set `name`, `description`, `tools`, `disallowedTools`, `model`, `effort`, `maxTurns`, `skills`, `omitClaudeMd`, …; **`hooks`, `permissionMode`, `mcpServers` are ignored** in plugin agents | [sub-agents](https://code.claude.com/docs/en/sub-agents) |
| Custom/plugin agents load CLAUDE.md; built-in Explore and Plan don't | Docs (confirms B22) |
| Plugins can't ship permission rules; `userConfig` gives per-user options, read in hooks as `CLAUDE_PLUGIN_OPTION_<KEY>` — but with `--plugin-dir` no `CLAUDE_PLUGIN_OPTION_*` reaches hooks (not even the default) and `claude plugin configure` can't target the plugin, so it isn't used for the off switch. Hooks do get `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` | Docs + probe (S3) |
| Exit 2 means "block" on PreToolUse, but on UserPromptSubmit it **swallows the user's message** and on Stop it **keeps Claude going** | [hooks docs](https://code.claude.com/docs/en/hooks) | Message and Stop hooks fail by warning (exit 0 + ⚠), not by blocking; only PreToolUse entries get `onFailure: "block"` |
| `engines: { "claude-code": "<semver range>" }` is enforced from Claude Code 2.1.323; 2.1.311 ignores it (validator: "Unknown field 'engines' … safe to keep") and loads the plugin; 2.0.15–2.1.75 reject it | Docs + probe |
| `author` is an object: `name` required, `email` / `url` optional | Docs |
| `claude plugin validate <path>` works; an icon is optional (warning only); `claude plugin eval` reads `evals/**/case.yaml` or `prompt.md` + `graders/*.md` and adds a no-plugin baseline | CLI help + run |

## Node.js
Node 20 end of life 2026-04-30; Node 22 maintenance LTS until 2027-04-30; Node 24 LTS until 2028-04-30.
`node --test` stable since v20. → **B15 (Node 22+) confirmed.**
Sources: [nodejs.org previous releases](https://nodejs.org/en/about/previous-releases), [nodejs/Release](https://github.com/nodejs/Release), [node:test](https://nodejs.org/api/test.html).

Probe cost: about $0.21 in API-equivalent usage.
