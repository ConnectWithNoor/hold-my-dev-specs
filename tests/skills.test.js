'use strict';
// The skills and guides must point at files that exist and use the phrases the hooks accept.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PHRASES } = require('../hooks/scripts/lib/approvals');

const ROOT = path.join(__dirname, '..');
const SKILLS = ['setup', 'feature', 'retro'];

function parse(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${file}: frontmatter`);
  const meta = Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
  return { meta, body: m[2] };
}

for (const name of SKILLS) {
  const file = path.join(ROOT, 'skills', name, 'SKILL.md');
  const { meta, body } = parse(file);

  test(`${name}: name matches its folder`, () => assert.equal(meta.name, name));

  test(`${name}: description is for software projects only (D56)`, () => {
    assert.match(meta.description, /hold-my-dev-specs/);
    assert.match(meta.description, /Software projects only/);
  });

  test(`${name}: the agent may start it itself (B2)`, () => {
    assert.equal(meta['disable-model-invocation'], undefined);
    assert.equal(meta['user-invocable'], undefined);
  });

  test(`${name}: every ../../guides or ../../templates file it names exists`, () => {
    for (const [, rel] of body.matchAll(/`(\.\.\/\.\.\/(?:guides|templates)\/[^`]+\.(?:md|json))`/g)) {
      assert.ok(fs.existsSync(path.join(path.dirname(file), rel)), rel);
    }
  });

  test(`${name}: no model names`, () => assert.doesNotMatch(body, /\b(opus|sonnet|haiku|fable)\b/i));
}

test('feature skill names exactly the phrases the approval hook accepts', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'feature', 'SKILL.md'));
  for (const phrase of Object.keys(PHRASES)) assert.ok(body.includes(`\`${phrase}\``), phrase);
});

test('S8 playbook lines: real timestamps, Write/Edit for specs and ledger, Read tool for reading', () => {
  const text = fs.readFileSync(path.join(ROOT, 'guides', 'lifecycle.md'), 'utf8');
  assert.match(text, /date -u \+%Y-%m-%dT%H:%M:%SZ/);
  assert.match(text, /never estimate/);
  assert.match(text, /Write specs and the ledger with Write \/ Edit\*\*, never through shell redirection/);
  assert.match(text, /Read with the Read tool\*\*, not shell `cat`/);
  for (const skill of ['setup', 'feature']) {
    assert.match(parse(path.join(ROOT, 'skills', skill, 'SKILL.md')).body, /\*\*Read tool\*\*, not\s+shell `cat`/, skill);
  }
});

test('setup commits its files on a chore/setup branch, never directly on main', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'setup', 'SKILL.md'));
  assert.match(body, /Commit both files/);
  assert.match(body, /chore\/setup/);
  assert.match(body, /without committing to the main branch directly/);
});

test('verifier computes the weighted score with a command and uses only that value', () => {
  const text = fs.readFileSync(path.join(ROOT, 'agents', 'verifier.md'), 'utf8');
  assert.match(text, /with a one-line command, never in your head/);
  assert.match(text, /Use the computed value only/);
});

test('S11 (b): verifier scores with prompt-free shell arithmetic in tenths, no node -e', () => {
  const text = fs.readFileSync(path.join(ROOT, 'agents', 'verifier.md'), 'utf8');
  assert.match(text, /`echo \$\(\( \(40\*10 \+ 20\*9 \+ 20\*10 \+ 10\*10 \+ 10\*10\) \/ 10 \)\)` prints `98`, meaning 9\.8/);
  assert.match(text, /compute \*\*tenths\*\*/);
  assert.doesNotMatch(text, /node -e/);
});

test('S11 (b): verifier stays read-only — project tests for behaviour, one command per call, no check or /tmp files', () => {
  const text = fs.readFileSync(path.join(ROOT, 'agents', 'verifier.md'), 'utf8');
  assert.match(text, /with exactly the commands\s+from the settings/);
  assert.match(text, /For behaviour, rely on the project's tests/);
  assert.match(text, /accept that\s+such a try may ask the user's permission/);
  assert.match(text, /\*\*one command per\s+call\*\*/);
  assert.match(text, /Write\s+no check files and nothing in \`\/tmp\` or anywhere else/);
});

// ── Retro break-loop (D65, D43) ──────────────────────────────────────────
test('retro: break-loop runs on the two triggers, and its description lets the agent start it', () => {
  const { meta, body } = parse(path.join(ROOT, 'skills', 'retro', 'SKILL.md'));
  assert.match(meta.description, /fix-round cap was hit/);
  assert.match(meta.description, /bug got past the verifier/);
  assert.match(body, /\*\*fix-round cap\*\* was hit/);
  assert.match(body, /\*\*bug got past the verifier\*\*/);
  assert.match(body, /Without either trigger, skip straight to part B/);
});

test('retro: the analysis covers all five root-cause categories and the four questions', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'retro', 'SKILL.md'));
  for (const category of ['missing spec', 'cross-layer contract', 'change propagation', 'test gap', 'implicit assumption']) {
    assert.ok(body.includes(`- ${category} —`), category);
  }
  for (const field of ['Root cause:', 'Why the earlier fixes failed:', 'Prevention:', 'Similar places:']) {
    assert.ok(body.includes(field), field);
  }
  assert.match(body, /Pick exactly one root cause/);
});

test('retro: nothing is written without the user\'s yes; locked specs go through revoke', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'retro', 'SKILL.md'));
  assert.match(body, /\*\*Nothing is written without the user's yes\*\*/);
  assert.match(body, /Write nothing the user didn't say yes to/);
  assert.match(body, /the user types `revoke` first/);
  assert.match(body, /you don't fix code here/);
});

test('retro: an active feature changes its spec via revoke; a done feature stays as it is and gets a new feature', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'retro', 'SKILL.md'));
  assert.match(body, /\*\*Feature still active:\*\* approved documents are locked, so the user types `revoke` first/);
  assert.match(body, /\*\*Feature already done:\*\* its spec, rubric and plan stay exactly as they are/);
  assert.match(body, /a finished feature is\s+a record and stays locked/);
  assert.match(body, /The correction becomes a \*\*new feature\*\*, whose spec names the old\s+criterion it replaces/);
});

test('playbook offers the break-loop at both trigger moments', () => {
  const text = fs.readFileSync(path.join(ROOT, 'guides', 'lifecycle.md'), 'utf8');
  assert.match(text, /fixLoop.maxRounds` failed rounds[\s\S]{0,200}break-loop analysis/);
  assert.match(text, /\*\*got past the verifier\*\*: offer the `retro` skill's break-loop/);
});

test('the break-loop report name is in the write-rights table', () => {
  const text = fs.readFileSync(path.join(ROOT, 'guides', 'artifacts.md'), 'utf8');
  assert.match(text, /`break-loop-<task>\.md` \(retro, only after the user's yes\)/);
});

// ── Spec-miner and baseline files ────────────────────────────────────────
test('setup offers the spec-miner only for existing code without a baseline, and it can be declined', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'setup', 'SKILL.md'));
  assert.match(body, /## 4\. Offer the spec-miner \(only for existing code\)/);
  assert.match(body, /Only if the repo already has code and there is no `specs\/baseline\/` yet/);
  assert.match(body, /as an offer the user may decline/);
  assert.match(body, /\*\*No\*\* → nothing happens/);
});

test('features link to baseline criteria and never copy or edit them', () => {
  const lifecycle = fs.readFileSync(path.join(ROOT, 'guides', 'lifecycle.md'), 'utf8');
  assert.match(lifecycle, /The spec \*\*links\*\* to the baseline criteria it changes/);
  assert.match(lifecycle, /never copies them; baseline\s+files are a record and are never edited by a feature/);
  const spec = fs.readFileSync(path.join(ROOT, 'templates', 'spec.md'), 'utf8');
  assert.match(spec, /## Baseline it changes/);
  assert.match(spec, /as links — never copied/);
  const artifacts = fs.readFileSync(path.join(ROOT, 'guides', 'artifacts.md'), 'utf8');
  assert.match(artifacts, /\*\*A record of what existing code does today\*\*/);
  assert.match(artifacts, /Features \*\*link\*\* to these ids/);
});

test('setup skill offers models the Agent tool accepts, or tests other names first', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'setup', 'SKILL.md'));
  assert.match(body, /aliases listed in that tool's description/);
  assert.match(body, /test it once before writing it/);
});

test('feature skill sends the master to the playbook', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'feature', 'SKILL.md'));
  assert.match(body, /Read `\.\.\/\.\.\/guides\/lifecycle\.md` now/);
});

test('guides: every relative link points at a file that exists', () => {
  const dir = path.join(ROOT, 'guides');
  for (const g of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(dir, g), 'utf8');
    for (const [, rel] of text.matchAll(/\]\(([^)#:]+\.(?:md|json))\)/g)) {
      assert.ok(fs.existsSync(path.join(dir, rel)), `${g} → ${rel}`);
    }
  }
});

test('playbook covers the agreed rules', () => {
  const text = fs.readFileSync(path.join(ROOT, 'guides', 'lifecycle.md'), 'utf8');
  for (const must of [
    'hmds-task:', 'approve spec', 'approve plan', 'approve both', 'revoke',
    'fixLoop.maxRounds', 'mode: lens:', 'mode: convergence', 'final-check.md',
    'fresh** implementer', 'one commit', 'no AI attribution', 'Revoke during the build',
    'Parallel: yes', 'one per task,\none at a time', 'Add `T01` to the ledger',
  ]) {
    assert.ok(text.includes(must), must);
  }
});

// ── S11 sample-run decisions ─────────────────────────────────────────────
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

test('S11 (a): every helper with a shell, and the master, stop at a refused command instead of trying variants', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'agents'))) {
    const text = read('agents', f);
    if (/^tools:.*\bBash\b/m.test(text)) assert.match(text, /\*\*A refused command → no variants\.\*\*/, f);
  }
  assert.match(read('guides', 'lifecycle.md'), /\*\*A refused command → no variants\.\*\*/);
});

test('S11 (a): setup offers allow rules, asks shared or personal, and warns about unprotected definition files', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'setup', 'SKILL.md'));
  assert.match(body, /\*\*Allow rules\*\* \(guide section "Allow rules for the project's commands"\)/);
  assert.match(body, /shared `\.claude\/settings\.json`, personal `\.claude\/settings\.local\.json`, or\s+none/);
  assert.match(body, /\*\*warn\*\* \(an allowed command is only safe if builders can't change what it runs\)/);
  assert.match(body, /never\s+`\.claude\/settings\.local\.json`/);
  const guide = read('guides', 'project-config.md');
  assert.match(guide, /## Allow rules for the project's commands \(optional\)/);
  assert.match(guide, /in the form `Bash\(<command> \*\)`/);
  assert.match(guide, /`prettier --write \{files\}` → `Bash\(prettier --write \*\)`/);
  assert.match(guide, /git check-ignore -q \.claude\/settings\.local\.json/);
  assert.match(guide, /\*\*An allowed command is only safe if builders can't change what it runs\.\*\*/);
  assert.match(guide, /`package\.json` for `npm test`/);
  assert.match(guide, /If that file isn't covered by `paths\.protected`, \*\*warn\*\*/);
  assert.doesNotMatch(guide, /Bash\([^)]*:\*\)/);
});

test('S11 (c): setup and feature look with file tools; the feature skill names every template it needs', () => {
  for (const skill of ['setup', 'feature']) {
    assert.match(parse(path.join(ROOT, 'skills', skill, 'SKILL.md')).body, /Glob, Grep and\s+Read, not shell `ls` \/ `find` \/\s*`cat`/, skill);
  }
  const { body } = parse(path.join(ROOT, 'skills', 'feature', 'SKILL.md'));
  for (const name of ['ledger.md', 'spec.md', 'rubric.md', 'plan.md', 'tasks.md', 'spec-quick.md']) {
    assert.ok(body.includes(`\`../../templates/${name}\``), name);
  }
});

test('S11 (d): merging into main may ask once — said in setup, ship, retro and the README', () => {
  const said = /merge may ask for permission once|merging into the main branch may ask for permission once|Merging into the main branch\*\*\s+may ask once/;
  assert.match(parse(path.join(ROOT, 'skills', 'setup', 'SKILL.md')).body, said);
  assert.match(parse(path.join(ROOT, 'skills', 'retro', 'SKILL.md')).body, said);
  assert.match(read('guides', 'lifecycle.md'), said);
  assert.match(read('README.md'), said);
});

test('S11 (e): after revoke with nothing to change, the approvals are asked for again right away', () => {
  assert.match(read('guides', 'lifecycle.md'), /\*\*After `revoke`\*\* \(at any stage\), ask what should change\. Nothing/);
  assert.match(read('guides', 'lifecycle.md'), /set `awaiting: spec` \(quick lane: `both`\) and ask for `approve spec` \(`approve both`\) right away/);
  assert.match(parse(path.join(ROOT, 'skills', 'feature', 'SKILL.md')).body, /ask for the approvals again right away/);
});

test('S11 cost #1: one ledger update per event, one clock read per event (chained to git or alone)', () => {
  const text = read('guides', 'lifecycle.md');
  assert.match(text, /\*\*One ledger update per event\*\*/);
  assert.match(text, /in \*\*one\*\* Write of the whole file, or one Edit when\s+only one place changes/);
  assert.match(text, /after the user types an approval phrase or\s+`revoke`, the hook has changed it, so Read it again first/);
  assert.match(text, /`git commit … && date -u \+%Y-%m-%dT%H:%M:%SZ`/);
  assert.match(text, /otherwise run `date -u \+%Y-%m-%dT%H:%M:%SZ` on its own/);
});

test('S11 (f): the retro runs no tests and commits what it wrote, or says clearly what is uncommitted', () => {
  const { body } = parse(path.join(ROOT, 'skills', 'retro', 'SKILL.md'));
  assert.match(body, /\*\*don't run the tests or the project's commands\*\*/);
  assert.match(body, /## C\. Commit what was written/);
  assert.match(body, /create `chore\/retro-<feature>` from the main branch/);
  assert.match(body, /never directly on the main branch/);
  assert.match(body, /say\s+clearly which files are \*\*uncommitted\*\*/);
  assert.match(body, /committed \(branch\) or uncommitted \(which files\)/);
});

test('S12 A4: test author fingerprints its test files; the verifier recomputes them and fails on a mismatch', () => {
  const author = read('agents', 'test-author.md');
  assert.match(author, /with its SHA-256 fingerprint in your report \("Test files"\)/);
  assert.match(author, /## Test files\n`sha256sum <every test file you wrote or changed>`/);
  const verifier = read('agents', 'verifier.md');
  assert.match(verifier, /recompute them with one command \(`sha256sum <files>`\)/);
  assert.match(verifier, /if a listed test file's fingerprint differs, or if any\s+other test, spec, rubric/);
  assert.match(read('guides', 'lifecycle.md'), /lists each test file it wrote with a SHA-256 fingerprint, which the\s+verifier checks/);
});

test('S12 A5: the done record is committed on a branch before or after shipping, never directly on main', () => {
  const text = read('guides', 'lifecycle.md');
  assert.match(text, /\*\*Without `ship\.deploy`:\*\* on the feature branch, set `stage: done`/);
  assert.match(text, /commit \(`docs\(specs\): mark <feature> done`\); then merge as\s+`git\.merge` says/);
  assert.match(text, /\*\*With `ship\.deploy`:\*\* the shipper writes its report into the active feature/);
  assert.match(text, /create `chore\/<feature>-done` from the main branch, set `stage: done`/);
  assert.match(text, /never directly on the main branch/);
});

test('S12 group B: the README names exactly the approval phrases the hook accepts, and how to install', () => {
  const readme = read('README.md');
  for (const phrase of Object.keys(PHRASES)) assert.ok(readme.includes(`| \`${phrase}\` |`), phrase);
  assert.match(readme, /\/plugin marketplace add ConnectWithNoor\/hold-my-dev-specs\n\/plugin install hold-my-dev-specs@connectwithnoor/);
  assert.equal(JSON.parse(read('.claude-plugin', 'marketplace.json')).name, 'connectwithnoor');
  assert.doesNotMatch(readme, /Not ready to use yet/);
  assert.match(readme, /`strict` \| \+ format \/ lint \/ typecheck \*\*run automatically\*\*/);
});

test('S12 R16 / R8: setup tests a model without writes; explorer writes nothing without an active feature; format without {files} is warned', () => {
  const setup = parse(path.join(ROOT, 'skills', 'setup', 'SKILL.md')).body;
  assert.match(setup, /the brief "answer only, write nothing"/);
  assert.match(setup, /A format command\s+without `\{files\}` reformats the whole project/);
  assert.match(read('agents', 'explorer.md'), /\*\*No active feature\*\* \(no `hmds-task:` line, e\.g\. during setup\) → answer in your reply only and write\s+nothing/);
});

test('S12: the shipper runs ship.deploy exactly as configured, alone, and reads the result from the tool output', () => {
  const text = read('agents', 'shipper.md');
  assert.match(text, /`ship\.deploy` \(then `ship\.monitor`\)\s+\*\*as written, alone, one per call\*\*: no `cd` in front, no `;` \/ `&&` chains, no added\s+`echo "exit=\$\?"`/);
  assert.match(text, /Read the result \(output and exit code\) from the tool output/);
  assert.match(text, /\*\*A refused command → no variants\.\*\*/);
});
