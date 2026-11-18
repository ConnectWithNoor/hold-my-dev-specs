'use strict';
// Attempts to get around the gate the way a careless agent might (from the S4 review).
// Every attempt must end denied — or, for the master changing the settings, with a permission prompt.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { decideToolCall } = require('../../hooks/scripts/lib/gate');
const { validConfig, ledgerText, makeProject } = require('../helpers');

const T = '2026-11-18T19:20:00Z';
const H = (name) => `hold-my-dev-specs:${name}`;

function call(root, tool, toolInput, who) {
  const input = { tool_name: tool, tool_input: toolInput, cwd: root, ...(who ? { agent_type: who } : {}) };
  return decideToolCall(input, { CLAUDE_PROJECT_DIR: root });
}
const decision = (out) => (out ? out.hookSpecificOutput.permissionDecision : 'allow');
const put = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
const writeTo = (root, rel, content, who) => call(root, 'Write', { file_path: path.join(root, rel), content }, who);
const edit = (root, rel, from, to, who) => call(root, 'Edit', { file_path: path.join(root, rel), old_string: from, new_string: to }, who);

// 001: finished long ago, both approved. 002: new work, nothing approved yet.
function scene() {
  const root = makeProject({ active: '002-new', ledger: ledgerText({ feature: '002-new' }) });
  put(root, 'specs/001-old/ledger.md', ledgerText({ feature: '001-old', stage: 'done', spec_approved: T, plan_approved: T }));
  put(root, 'specs/002-new/spec.md', '# Spec\n');
  put(root, 'specs/002-new/rubric.md', '# Rubric\n');
  put(root, 'specs/002-new/plan.md', '# Plan\n');
  put(root, 'specs/002-new/tasks.md', '# Tasks\n');
  return root;
}
const approve002 = (root, values = {}) =>
  put(root, 'specs/002-new/ledger.md', ledgerText({ feature: '002-new', stage: 'build', spec_approved: T, plan_approved: T, ...values }));

test('baseline: master edits src before approval → deny', () => {
  assert.equal(decision(writeTo(scene(), 'src/a.js', 'x')), 'deny');
});

// ── A1: the settings file ────────────────────────────────────────────────
const disabled = JSON.stringify(validConfig({ disabledHooks: ['verifier-integrity', 'plan-gate'] }));

test('A1 implementer turns off integrity in the settings file → deny', () => {
  assert.equal(decision(writeTo(scene(), '.claude/hold-my-dev-specs.json', disabled, H('implementer'))), 'deny');
});

test('A1 every helper and other agents → deny; also through the shell', () => {
  const root = scene();
  for (const who of ['test-author', 'verifier', 'explorer', 'shipper', 'spec-miner']) {
    assert.equal(decision(writeTo(root, '.claude/hold-my-dev-specs.json', disabled, H(who))), 'deny', who);
  }
  assert.equal(decision(writeTo(root, '.claude/hold-my-dev-specs.json', disabled, 'general-purpose')), 'deny');
  assert.equal(decision(call(root, 'Bash', { command: `echo '${disabled}' > .claude/hold-my-dev-specs.json` }, H('implementer'))), 'deny');
});

test('A1 master changing the settings → permission prompt, in every profile', () => {
  for (const profile of ['minimal', 'standard', 'strict']) {
    const root = makeProject({ config: validConfig({ profile }) });
    assert.equal(decision(writeTo(root, '.claude/hold-my-dev-specs.json', disabled)), 'ask', profile);
  }
  const off = makeProject({ config: validConfig({ disabledHooks: ['plan-gate', 'verifier-integrity'] }) });
  assert.equal(decision(writeTo(off, '.claude/hold-my-dev-specs.json', '{}')), 'ask', 'even with hooks disabled');
});

test('A1 a deny elsewhere in the same command wins over the prompt', () => {
  assert.equal(decision(call(scene(), 'Bash', { command: 'echo {} > .claude/hold-my-dev-specs.json; echo x > src/a.js' })), 'deny');
});

// ── A2 / A4: old approvals ───────────────────────────────────────────────
test('A2 master points ACTIVE at the old approved feature: allowed, but src stays closed', () => {
  const root = scene();
  assert.equal(decision(writeTo(root, 'specs/ACTIVE', '001-old\n')), 'allow'); // switching features can be legitimate
  put(root, 'specs/ACTIVE', '001-old\n');
  assert.equal(decision(writeTo(root, 'src/a.js', 'x')), 'deny');
});

test('A4 master sets a done feature back to build → deny', () => {
  assert.equal(decision(edit(scene(), 'specs/001-old/ledger.md', 'stage: done', 'stage: build')), 'deny');
});

test('A4 other edits of a done ledger stay possible (e.g. the log)', () => {
  assert.equal(decision(edit(scene(), 'specs/001-old/ledger.md', '## Log\n', '## Log\n- note\n')), 'allow');
});

// ── A3: approved documents are locked ────────────────────────────────────
test('A3 master rewrites the approved spec → deny, with the revoke hint', () => {
  const root = scene();
  approve002(root);
  const out = edit(root, 'specs/002-new/spec.md', '# Spec', '# Spec (weaker)');
  assert.equal(decision(out), 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /type "revoke"/);
});

test('A3 rubric locked with the spec; plan locked only after the plan approval', () => {
  const root = scene();
  approve002(root, { plan_approved: 'no', stage: 'plan' });
  assert.equal(decision(edit(root, 'specs/002-new/rubric.md', '# Rubric', '# Easier')), 'deny');
  assert.equal(decision(edit(root, 'specs/002-new/plan.md', '# Plan', '# Plan v2')), 'allow');
  approve002(root);
  assert.equal(decision(edit(root, 'specs/002-new/plan.md', '# Plan', '# Plan v2')), 'deny');
});

test('A3 tasks.md stays editable for the master after approval', () => {
  const root = scene();
  approve002(root);
  assert.equal(decision(edit(root, 'specs/002-new/tasks.md', '# Tasks', '# Tasks v2')), 'allow');
});

test('A3 locks also hold through the shell and for deleting', () => {
  const root = scene();
  approve002(root);
  assert.equal(decision(call(root, 'Bash', { command: 'sed -i s/Spec/X/ specs/002-new/spec.md' })), 'deny');
  assert.equal(decision(call(root, 'Bash', { command: 'rm specs/002-new/plan.md' })), 'deny');
});

test('A3 before approval and after revoke, the spec is editable', () => {
  const root = scene();
  assert.equal(decision(edit(root, 'specs/002-new/spec.md', '# Spec', '# Spec v2')), 'allow');
  approve002(root);
  approve002(root, { spec_approved: 'no', plan_approved: 'no' }); // what "revoke" leaves behind
  assert.equal(decision(edit(root, 'specs/002-new/spec.md', '# Spec', '# Spec v2')), 'allow');
});

test('A3 quick lane: spec.md (holding the plan) locked after approve both', () => {
  const root = scene();
  approve002(root, { lane: 'quick' });
  assert.equal(decision(edit(root, 'specs/002-new/spec.md', '# Spec', '# Spec v2')), 'deny');
});

test('A3 the lock follows each feature’s own ledger, not only the active one', () => {
  const root = scene();
  put(root, 'specs/001-old/spec.md', '# Old\n');
  assert.equal(decision(edit(root, 'specs/001-old/spec.md', '# Old', '# Rewritten')), 'deny');
});

// ── Review 2: moving or deleting counts as changing ──────────────────────
test('master mv of an approved spec.md → deny', () => {
  const root = scene();
  approve002(root);
  assert.equal(decision(call(root, 'Bash', { command: 'mv specs/002-new/spec.md specs/002-new/old.md' })), 'deny');
});

test('master git rm of an approved rubric.md → deny', () => {
  const root = scene();
  approve002(root);
  assert.equal(decision(call(root, 'Bash', { command: 'git rm specs/002-new/rubric.md' })), 'deny');
});

test('git mv / rsync --remove-source-files of an approved plan → deny', () => {
  const root = scene();
  approve002(root);
  assert.equal(decision(call(root, 'Bash', { command: 'git mv specs/002-new/plan.md docs/plan.md' })), 'deny');
  assert.equal(decision(call(root, 'Bash', { command: 'rsync --remove-source-files specs/002-new/plan.md /tmp/' })), 'deny');
});

test('git global options don\'t hide the subcommand: -C, -c → deny', () => {
  const root = scene();
  approve002(root);
  assert.equal(decision(call(root, 'Bash', { command: 'git -C . rm specs/002-new/spec.md' })), 'deny');
  assert.equal(decision(call(root, 'Bash', { command: 'git -c x=y mv specs/002-new/plan.md p.md' })), 'deny');
  assert.equal(decision(call(root, 'Bash', { command: 'git -C specs/002-new rm rubric.md' })), 'deny');
});

test('mv src/a.js src/b.js before approval → deny', () => {
  assert.equal(decision(call(scene(), 'Bash', { command: 'mv src/a.js src/b.js' })), 'deny');
});

// ── A5 / A6 (already denied before the review; kept as regression tests) ─
test('A5 implementer edits a test → deny', () => {
  const root = scene();
  approve002(root);
  put(root, 'tests/a.test.js', 'a');
  assert.equal(decision(edit(root, 'tests/a.test.js', 'a', 'b', H('implementer'))), 'deny');
});

test('A6 implementer changes approval values → deny', () => {
  const root = scene();
  approve002(root);
  assert.equal(decision(edit(root, 'specs/002-new/ledger.md', `plan_approved: ${T}`, 'plan_approved: no', H('implementer'))), 'deny');
});

// ── Point 4: only the master repairs broken settings ─────────────────────
test('broken settings: helpers may not touch even the repair paths', () => {
  const root = makeProject({ config: '{ nope' });
  assert.equal(decision(writeTo(root, 'specs/001-login/spec.md', 'x', H('implementer'))), 'deny');
  assert.equal(decision(writeTo(root, 'specs/baseline/a.md', 'x', H('spec-miner'))), 'deny');
  assert.equal(decision(writeTo(root, 'specs/001-login/spec.md', 'x')), 'allow');
});

// ── Folder-wide shell writes (tar, unzip, patch…) ────────────────────────
test('extracting an archive into the project root is gated like any source edit', () => {
  const root = scene();
  assert.equal(decision(call(root, 'Bash', { command: 'tar xzf vendor.tgz' })), 'deny');
  approve002(root);
  assert.equal(decision(call(root, 'Bash', { command: 'tar xzf vendor.tgz' })), 'allow');
  assert.equal(decision(call(root, 'Bash', { command: 'unzip x.zip' }, H('verifier'))), 'deny');
});
