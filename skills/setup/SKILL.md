---
name: setup
description: Sets up hold-my-dev-specs spec-driven development in a software project, by interviewing the user and writing the project settings (.claude/hold-my-dev-specs.json). Use when the user wants to build software in a repo that has no such file yet, when its settings are unfinished or broken, or when the user wants to change them. Software projects only — never for discussions or non-code work.
---
# Set up hold-my-dev-specs in this project

You are the master. Goal: every choice this project needs is **asked and locked** in
`.claude/hold-my-dev-specs.json`. Nothing is filled in silently; suggested values are only offered.

The plugin's guides are two folders up from this skill (`../../guides/`), templates in `../../templates/`.
Read `../../guides/project-config.md` first: it lists every field, what it means and what to suggest.
Read guides, templates and project files with the **Read tool**, not shell `cat` (plugin docs then need
no permission prompt), and write files with Write / Edit, never through shell redirection.

## 1. Look first
- Settings file exists and is complete → show a short summary and ask what to change.
  Unfinished or broken → say which fields, and continue with those only.
- Look at the repo before asking, so you can propose real values: languages, package files, test folders
  and commands, lint / format / typecheck configs, CI files, main branch name. Look with Glob, Grep and
  Read, not shell `ls` / `find` / `cat` (those can ask for permission; the file tools don't).
- Existing code but no `specs/baseline/` → remember it for the offer at the end (section 4).

## 2. Interview
Ask in small groups (up to 4 questions at a time), plain words, each with options and a recommendation
where the guide suggests one:
1. **Models:** which model for the `strongest` tier (verifier, test author, spec-miner) and for `mid`
   (implementer, explorer, shipper). No suggestion of your own. Offer the short model names your Agent
   tool accepts for its `model` setting (the aliases listed in that tool's description). If the user
   wants another name, test it once before writing it: start a tiny explorer with that model, a
   one-line question and the brief "answer only, write nothing", and check that it ran. If both tiers
   are the same, warn once: the critic should differ from the builder.
2. **Profile:** show the profiles table from the guide; suggest `standard`.
3. **Paths:** `open` (suggest `specs/**`, `docs/**`, `CLAUDE.md`), `tests` (from the repo), `protected`
   (quality configs + their ignore files, CI, guardrails such as `.claude/**`; specs and tests are
   protected anyway).
4. **Commands:** test, lint, format, typecheck, as found in the repo; confirm each or set `null`.
   Suggest the `{files}` form for format commands (e.g. `prettier --write {files}`). A format command
   without `{files}` reformats the whole project, locked specs and protected files included, and in
   `strict` it runs by itself after replies: **warn clearly** and recommend the `{files}` form.
5. **Verification:** signals (browser, screenshot, logs, code-only), validation tools to use
   (e.g. a browser plugin for a web app — installing anything is the user's call), pass threshold
   (suggest 7), lenses (`silent-failure`, `security`), high-risk paths.
6. **Loop and context:** fix rounds (suggest 3), manifest caps (suggest 32768 / 131072 bytes), skip
   keyword (suggest `#nostate`).
7. **Ship:** manual review `local` or `staging`, deploy command, monitor command (`null` = not used).
8. **Git:** main branch name, merge method `local` or `pr`.
9. **Allow rules** (guide section "Allow rules for the project's commands"): show the exact rule for each
   configured command and ask: shared `.claude/settings.json`, personal `.claude/settings.local.json`, or
   none. For each rule, name the file that decides what the command runs; if `paths.protected` doesn't
   cover it, **warn** (an allowed command is only safe if builders can't change what it runs) and suggest
   adding it.

## 3. Confirm, then write
Restate every value in one table (the allow rules and their file included) and wait for the user's
confirmation. Then:
1. Add a short section to the project's `CLAUDE.md` (create it if missing): in plain words, that this
   project uses hold-my-dev-specs, where the settings live, and that specs live in `specs/`. Link to
   the settings file; don't copy its values.
2. If the user chose allow rules: add them to the chosen file as the guide says (read it first, keep
   everything else).
3. Write `.claude/hold-my-dev-specs.json` **last** — its existence switches the plugin's hooks on.
   Claude Code asks the user's permission for files in `.claude/` (and the hook does too if the file
   already exists); that is expected.
4. **Commit both files** (and `.claude/settings.json` if the rules went there; never
   `.claude/settings.local.json`) without committing to the main branch directly: create `chore/setup`
   from the main branch, commit (`chore(setup): add hold-my-dev-specs settings`, no AI attribution lines),
   then merge it into the main branch as `git.merge` says (`local`: fast-forward; `pr`: ask the user
   before opening a pull request). Tell the user first that the merge may ask for permission once if
   their own safety rules guard the main branch; that is expected. Ask the user first if the repo isn't
   a git repository or has uncommitted work.
5. Check: the next message's workflow-state note must not say "settings are unfinished / broken".

## 4. Offer the spec-miner (only for existing code)
Only if the repo already has code and there is no `specs/baseline/` yet, offer it in a few plain lines,
as an offer the user may decline:
- **What it does:** a helper (`spec-miner`) reads the existing code and writes down what it does today,
  as baseline specs in `specs/baseline/<area>.md`, with evidence and uncertain points marked. New specs
  then link to those baseline criteria instead of guessing what the code does.
- **What it costs:** one helper run per area, on the `strongest` tier; propose the areas (main folders
  or modules) so the user can pick some, all, or none.
- **No** → nothing happens; it can be done later.
- **Yes** → per chosen area, start `spec-miner` with the area and a short file name; afterwards show
  the user `specs/baseline/index.md` and the uncertain points, and commit the baseline files the same
  way as in step 4 of section 3 (own branch, then merge).

End with the report: done · how it was checked · what's left · next step (usually the `feature` skill).
