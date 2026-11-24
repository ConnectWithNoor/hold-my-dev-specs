# S12 — sanitizer audit before publishing

2026-11-24, branch `chore/s12-release-prep` at `28c967c`. Read-only, with git and Node built-ins only;
nothing was installed. Scope: the current files **and every file version in every commit** on all local
branches (31 commits, 243 distinct file versions, 134 paths ever committed).

**Verdict: PASS.** Nothing secret, personal or private was found in the files or the history. Two
deliberate exceptions are listed below, and so are three points for the publishing step.

## What was checked
| Check | How | Result |
|---|---|---|
| Secrets in content | every file version in history against patterns: private key blocks, Anthropic / OpenAI-style / AWS / GitHub / Slack / Google keys, `password` / `secret` / `token` / `api_key` assignments | none |
| Home and temp paths | `/home/<name>`, `/Users/<name>`, Claude Code's per-session temp folders in every file version; control: the text `home/` appears in no commit at all | none |
| Email addresses | every file version | only `eval@example.com` and `t@example.com` (test fixtures) |
| Private planning notes | their file names and paths in every file version and path | none; they were never committed |
| Secret-looking file names | every path ever committed (`.env*`, keys, certificates, `credentials`, `.netrc`, `.npmrc`, …) | none |
| Commit authors and committers | all 31 commits | all `Noor Muhammad <…@users.noreply.github.com>` (GitHub's privacy address) |
| Commit messages | AI attribution lines, email addresses, local paths | none |
| Symlinks | all 18 (the eval cases' `scaffold.sh`) resolved | all stay inside the repository |
| Executables | file modes | 4, all intended: the 3 eval fixture scripts and `hooks/scripts/pre-tool.sh` |
| Binary and large files | null bytes; size over 200 KB in history | none; the largest file is 23 KB |
| Ignore rules | `git check-ignore` on the private notes; untracked files | all private notes ignored; nothing untracked and unignored |

## Deliberate exceptions
- **Author name** "Noor Muhammad" in `LICENSE`, `.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`: name only, no email (ADR-0016).
- **GitHub username** inside the noreply commit address: this is GitHub's own privacy address, chosen
  for this repository instead of a personal email.

## For the publishing step
1. **Push `main` and the release tag only.** The 14 step branches (`feat/s2-formats` … `chore/s12-release-prep`)
   are merged history; this audit covered them too, but they don't need to be published.
2. The `.gitignore` comment still mentions converting the private notes "at S12"; it gets updated
   when they are deleted (S12 step 5).
3. Re-run this audit's checks if anything is committed after it (the script reads only git, so it
   takes a few seconds).
