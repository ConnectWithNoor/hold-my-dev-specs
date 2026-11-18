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
