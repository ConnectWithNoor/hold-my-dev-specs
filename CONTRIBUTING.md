# Contributing

Thank you for helping. Issues and pull requests are welcome: bug reports, unclear docs, rules that
block the wrong thing or miss the right one.

**For a big change** (a new hook rule, a new skill or helper, a change to the lifecycle), please
**open an issue first** and describe the problem. That saves you work if the change doesn't fit the
plugin's decisions ([docs/adr/](docs/adr/README.md)).

## Set up
- **Node.js 22 or newer.** The plugin uses Node's built-ins only, so there is nothing to install.
- **Claude Code 2.1.295 or newer.**
- Run the tests: `npm test` (Node's built-in test runner; it takes a few seconds).
- Check the plugin's structure: `claude plugin validate .`
- Try your copy in a real session: start Claude Code in a throwaway project with
  `claude --plugin-dir /path/to/your/hold-my-dev-specs`. That loads the plugin straight from your folder,
  so your changes take effect at the next session start.

## Making a change
- **One branch per change**, from `main` (e.g. `fix/gate-folder-move`).
- **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/):
  `type(scope): summary`, e.g. `fix(hooks): check files below a moved folder`. Common types: `feat`,
  `fix`, `docs`, `test`, `chore`.
- **Every behaviour change comes with tests** in `tests/`: a hook rule gets cases that must be allowed
  and cases that must be denied; a change to skill or agent wording that the hooks rely on gets a test
  that pins the wording.
- **Keep the docs true:** when behaviour changes, update the guide that states the rule
  (`guides/`), and the README or [docs/how-it-works.md](docs/how-it-works.md) if they describe it.
  Each fact lives in one place; link to it instead of copying it.
- **New lasting decisions get an ADR** in `docs/adr/` (next number, same sections, listed in the
  index). A replaced ADR stays, marked "Superseded by ADR-n".

## Evals
The skill-trigger evals (`npm run eval`) start 18 short Claude sessions and **cost real usage, about
$1.60 per run**. You don't need to run them for a pull request; maintainers run them before each
release (three runs, each 18/18). If your change touches a skill's description, say so in the pull
request.

## Privacy
Never commit private data: secrets, keys or `.env` files, email addresses, paths from your own machine
(`/home/<you>/…`), or transcripts of your sessions. Use `example.com` addresses and made-up names in tests.

## License
By contributing you agree that your contribution is licensed under the [MIT license](LICENSE).
