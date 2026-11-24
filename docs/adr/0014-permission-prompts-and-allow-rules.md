# ADR-0014 — Fewer permission prompts, without weakening the checks

**Status:** Accepted (2026-11-24)

## Context
The suggested working mode is `acceptEdits`: file edits run without asking, and everything else follows
the allow / ask / deny rules and the hooks. A measured sample run showed many prompts that added no
safety: the same `npm test` for every helper, one-off shell tries, shell listings of the plugin's own
folder. Each prompt stops the work until the user answers.

## Decision
- **Allow rules, offered at setup:** for each configured project command, one Claude Code rule in the
  form `Bash(<command> *)` (the current syntax in Claude Code's permissions docs). The user chooses
  shared `.claude/settings.json`, personal `.claude/settings.local.json`, or no rules.
- **An allowed command is only safe if builders can't change what it runs.** For each rule, setup names
  the file that decides what the command does (e.g. `package.json` for `npm test`). If that file isn't
  protected ([ADR-0007](0007-verifier-integrity.md)), setup warns and suggests protecting it.
- **Guarded files:** only the master may change `.claude/settings.json`, `.claude/settings.local.json`
  and `.mcp.json` (the tool servers Claude may use). Helpers and other agents are always denied. The
  master's writes go through a permission prompt: Claude Code's own prompt for `.claude/`, and the
  hook's own prompt for `.mcp.json`, where Claude Code may not ask.
- **A refused command means no variants:** neither the master nor a helper retries a refused command in
  another spelling (`node --test` for `npm test`); it reports what was refused and why it was needed.
- Agents look at files with the file tools (Glob, Grep, Read) instead of `ls` / `find` / `cat`, and read
  the plugin's guides with the Read tool, which a hook allows without a prompt.
- Prompts that remain on purpose are explained in the README ("Permission prompts to expect"), such as
  merging into the main branch when the user's own safety rules guard it.

## Consequences
- A normal feature run asks only where a decision really belongs to the user.
- Allow rules make the protection of the command's definition file important; setup says so.

**Replaces internal records:** D48, B42 (plugin docs readable), B50 (a, c, d), B51 (1).
