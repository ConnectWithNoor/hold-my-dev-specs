'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { decideToolCall } = require('../../hooks/scripts/lib/gate');
const { validConfig, ledgerText, makeProject } = require('../helpers');

const T = '2026-11-18T19:20:00Z';
const APPROVED = { spec_approved: T, plan_approved: T, stage: 'build' };

// Runs the decision for one tool call. `who` = undefined (master) or an agent_type string.
function decide(root, tool, toolInput, who) {
  const input = { hook_event_name: 'PreToolUse', cwd: root, tool_name: tool, tool_input: toolInput };
  if (who) input.agent_type = who;
  return decideToolCall(input, { CLAUDE_PROJECT_DIR: root });
}
const write = (root, rel, who, content = 'x') => decide(root, 'Write', { file_path: path.join(root, rel), content }, who);
const bash = (root, command, who) => decide(root, 'Bash', { command }, who);
const denied = (out) => !!out && out.hookSpecificOutput.permissionDecision === 'deny';
const reason = (out) => out.hookSpecificOutput.permissionDecisionReason;
const H = (name) => `hold-my-dev-specs:${name}`;

// ── Plugin off / not a write ─────────────────────────────────────────────
test('no settings file → plugin is inert', () => {
  assert.equal(write(makeProject({ config: null }), 'src/a.js'), undefined);
});

test('non-writing tools and commands pass', () => {
  const root = makeProject();
  assert.equal(decide(root, 'Read', { file_path: path.join(root, 'src/a.js') }), undefined);
  assert.equal(bash(root, 'git status && npm test'), undefined);
});

test('writes outside the project are left to the personal safety hooks', () => {
  assert.equal(write(makeProject(), '../elsewhere.txt'), undefined);
});

// ── Plan gate ────────────────────────────────────────────────────────────
test('gate closed: source edit denied, open paths and specs allowed', () => {
  const root = makeProject();
  assert.ok(denied(write(root, 'src/a.js')));
  assert.match(reason(write(root, 'src/a.js')), /Plan gate is closed/);
  assert.equal(write(root, 'docs/notes.md'), undefined);
  assert.equal(write(root, 'specs/001-login/spec.md'), undefined);
});

test('gate needs BOTH approvals', () => {
  assert.ok(denied(write(makeProject({ ledger: ledgerText({ spec_approved: T }) }), 'src/a.js')));
  assert.ok(denied(write(makeProject({ ledger: ledgerText({ plan_approved: T }) }), 'src/a.js')));
  assert.equal(write(makeProject({ ledger: ledgerText(APPROVED) }), 'src/a.js'), undefined);
});

test('no active feature → source edit denied', () => {
  assert.match(reason(write(makeProject({ active: null }), 'src/a.js')), /no active feature/);
});

test('broken ledger → source edit denied, specs still editable for repair', () => {
  const root = makeProject({ ledger: '# broken' });
  assert.match(reason(write(root, 'src/a.js')), /ledger has a problem/);
  assert.equal(write(root, 'specs/001-login/spec.md'), undefined);
});

test('shell writes go through the gate (best effort)', () => {
  const root = makeProject();
  assert.ok(denied(bash(root, 'echo x > src/a.js')));
  assert.ok(denied(bash(root, 'sed -i s/a/b/ src/a.js')));
  assert.equal(bash(root, 'echo x > docs/n.md'), undefined);
});

// ── Unfinished / broken settings ─────────────────────────────────────────
const asked = (out) => !!out && out.hookSpecificOutput.permissionDecision === 'ask';

test('required setting still null → gated edits blocked, specs editable, settings with a prompt', () => {
  const root = makeProject({ config: validConfig({ models: { strongest: null, mid: 'sonnet' } }) });
  assert.match(reason(write(root, 'src/a.js')), /settings are unfinished/);
  assert.equal(write(root, 'specs/001-login/spec.md'), undefined);
  assert.ok(asked(write(root, '.claude/hold-my-dev-specs.json', undefined, '{}')));
});

test('broken settings → same: only repair paths editable', () => {
  const root = makeProject({ config: '{ nope' });
  assert.match(reason(write(root, 'docs/a.md')), /settings are broken/);
  assert.ok(asked(write(root, '.claude/hold-my-dev-specs.json', undefined, '{}')));
});

test('S11: Claude Code permission files — master passes to its own prompt, even without an active feature', () => {
  for (const rel of ['.claude/settings.json', '.claude/settings.local.json']) {
    assert.equal(write(makeProject({ active: null }), rel, undefined, '{}'), undefined, rel);
    assert.equal(write(makeProject({ config: validConfig({ models: { strongest: null, mid: 'sonnet' } }) }), rel, undefined, '{}'), undefined, `${rel} unfinished settings`);
  }
});

test('S11: helpers and other agents may never change the permission files, even after approval', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  for (const rel of ['.claude/settings.json', '.claude/settings.local.json']) {
    for (const who of [H('implementer'), H('test-author'), H('verifier'), 'general-purpose']) {
      assert.match(reason(write(root, rel, who, '{}')), /Only the master may change/, `${who} ${rel}`);
    }
    assert.ok(denied(bash(root, `echo {} > ${rel}`, H('implementer'))), `${rel} via shell`);
  }
});

// ── Approval values ──────────────────────────────────────────────────────
const LEDGER = 'specs/001-login/ledger.md';
const editLedger = (root, from, to, who) =>
  decide(root, 'Edit', { file_path: path.join(root, LEDGER), old_string: from, new_string: to }, who);

test('master rewrite of the ledger with approvals unchanged → allowed', () => {
  const root = makeProject();
  assert.equal(editLedger(root, 'stage: spec', 'stage: plan'), undefined);
  assert.equal(write(root, LEDGER, undefined, ledgerText({ stage: 'plan', awaiting: 'spec' })), undefined);
});

test('master changing an approval value → denied (Edit, Write, MultiEdit)', () => {
  const root = makeProject();
  assert.match(reason(editLedger(root, 'plan_approved: no', `plan_approved: ${T}`)), /set only by the user/);
  assert.ok(denied(write(root, LEDGER, undefined, ledgerText({ spec_approved: T }))));
  const multi = decide(root, 'MultiEdit', {
    file_path: path.join(root, LEDGER),
    edits: [{ old_string: 'stage: spec', new_string: 'stage: plan' }, { old_string: 'spec_approved: no', new_string: `spec_approved: ${T}` }],
  });
  assert.ok(denied(multi));
});

test('revoking by editing is also an approval change → denied', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  assert.ok(denied(editLedger(root, `spec_approved: ${T}`, 'spec_approved: no')));
});

test('ledger through the shell → denied', () => {
  const root = makeProject();
  assert.match(reason(bash(root, `sed -i s/x/y/ ${LEDGER}`)), /only be changed with Edit or Write/);
});

test('edit that breaks the header → denied', () => {
  assert.match(reason(editLedger(makeProject(), 'lane: full', 'lane: sideways')), /break the ledger header/);
});

test('new or repaired ledger must start unapproved', () => {
  const fresh = makeProject({ ledger: null });
  assert.equal(write(fresh, LEDGER, undefined, ledgerText()), undefined);
  assert.ok(denied(write(fresh, LEDGER, undefined, ledgerText({ spec_approved: T }))));
  const broken = makeProject({ ledger: '# broken' });
  assert.ok(denied(write(broken, LEDGER, undefined, ledgerText(APPROVED))));
  assert.equal(write(broken, LEDGER, undefined, ledgerText()), undefined);
});

test('edit whose old text is missing is left to the tool (it fails by itself)', () => {
  assert.equal(editLedger(makeProject(), 'not in the file', 'x'), undefined);
});

// ── Verifier integrity: who may write what ──────────────────────────────
const REPORTS = 'specs/001-login/reports';

test('implementer: source after approval yes; tests, configs, specs, CI no; own report yes', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  const who = H('implementer');
  assert.equal(write(root, 'src/a.js', who), undefined);
  for (const p of ['tests/a.test.js', 'src/b.test.js', '.eslintrc.json', '.github/workflows/ci.yml', 'specs/001-login/spec.md', LEDGER]) {
    assert.ok(denied(write(root, p, who)), p);
  }
  assert.equal(write(root, `${REPORTS}/T01-impl.md`, who), undefined);
  assert.ok(denied(write(root, `${REPORTS}/T01-verify-1.md`, who)));
  assert.ok(denied(bash(root, 'echo hack > tests/a.test.js', who)));
});

test('implementer: bare agent name gets the same rules', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  assert.ok(denied(write(root, 'tests/a.test.js', 'implementer')));
});

test('implementer: source still needs the gate', () => {
  assert.ok(denied(write(makeProject(), 'src/a.js', H('implementer'))));
});

test('test author: test paths only (gated) + own report', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  const who = H('test-author');
  assert.equal(write(root, 'tests/a.test.js', who), undefined);
  assert.equal(write(root, `${REPORTS}/T01-tests.md`, who), undefined);
  for (const p of ['src/a.js', '.eslintrc.json', 'specs/001-login/spec.md']) assert.ok(denied(write(root, p, who)), p);
  assert.ok(denied(write(makeProject(), 'tests/a.test.js', who)), 'gate closed');
});

test('verifier, explorer, shipper: own report only', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  const own = { verifier: 'T01-verify-2.md', explorer: 'explore-auth-flow.md', shipper: 'ship.md' };
  for (const [who, name] of Object.entries(own)) {
    assert.equal(write(root, `${REPORTS}/${name}`, H(who)), undefined, who);
    assert.ok(denied(write(root, `${REPORTS}/T01-impl.md`, H(who))), `${who} other report`);
    assert.ok(denied(write(root, 'src/a.js', H(who))), `${who} source`);
    assert.ok(denied(write(root, 'docs/x.md', H(who))), `${who} docs`);
  }
  assert.ok(denied(bash(root, 'npm test > src/out.txt', H('verifier'))));
  assert.equal(write(root, `${REPORTS}/T01-verify-2-security.md`, H('verifier')), undefined, 'lens report');
  assert.equal(write(root, `${REPORTS}/T01-verify-1-silent-failure.md`, H('verifier')), undefined, 'lens report');
  assert.ok(denied(write(root, `${REPORTS}/T01-verify-2-Security.md`, H('verifier'))), 'lens name lowercase only');
  assert.ok(denied(write(root, `${REPORTS}/T01-verify-2-security.md`, H('implementer'))), 'not the implementer');
  assert.equal(bash(root, 'npm test', H('verifier')), undefined);
});

test('S8: helpers may create the active reports/ folder, never delete it or create others', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  for (const who of ['test-author', 'verifier', 'explorer', 'shipper', 'implementer']) {
    assert.equal(bash(root, `npm test 2>&1 | head -30; mkdir -p ${REPORTS}`, H(who)), undefined, `${who} mkdir`);
    assert.ok(denied(bash(root, `rm -rf ${REPORTS}`, H(who))), `${who} rm`);
    assert.ok(denied(bash(root, 'mkdir -p specs/002-other/reports', H(who))), `${who} other feature`);
  }
  assert.ok(denied(bash(root, `mkdir -p ${REPORTS}/sub`, H('verifier'))), 'sub-folder is not the reports folder');
  assert.ok(denied(bash(root, `mkdir -p ${REPORTS}`, 'general-purpose')), 'other agents write no reports');
});

test('S8: verifier writing its own report through a heredoc → allowed', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  const cmd = `cat > ${REPORTS}/T01-verify-2.md <<'EOF'\n# Verify\nscore 9.6 > 7 · ss, and more\nEOF`;
  assert.equal(bash(root, cmd, H('verifier')), undefined);
});

test('cd can\'t hide a protected write: implementer "cd tests && …" → denied', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  assert.ok(denied(bash(root, 'cd tests && echo hack > a.test.js', H('implementer'))));
  assert.ok(denied(bash(root, 'cd specs/001-login && sed -i s/a/b/ spec.md', H('implementer'))));
  assert.equal(bash(root, 'cd src && echo x > a.js', H('implementer')), undefined, 'ordinary source after approval');
});

test('cd into specs/baseline: the spec-miner\'s own files are allowed', () => {
  const root = makeProject({ active: null });
  assert.equal(bash(root, `mkdir -p specs/baseline && cd specs/baseline && cat > a.md <<'EOF'\n# x\nEOF`, H('spec-miner')), undefined);
});

test('spec-miner may create specs/baseline itself', () => {
  assert.equal(bash(makeProject({ active: null }), 'mkdir -p specs/baseline', H('spec-miner')), undefined);
});

test('reports only in the ACTIVE feature', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  assert.ok(denied(write(root, 'specs/002-other/reports/T01-impl.md', H('implementer'))));
});

test('spec-miner: specs/baseline/** only', () => {
  const root = makeProject({ active: null });
  assert.equal(write(root, 'specs/baseline/auth.md', H('spec-miner')), undefined);
  assert.equal(write(root, 'specs/baseline/index.md', H('spec-miner')), undefined);
  assert.ok(denied(write(root, 'specs/001-login/spec.md', H('spec-miner'))));
  assert.ok(denied(write(root, 'src/a.js', H('spec-miner'))));
});

test('other agents (not from this plugin): no protected paths, no reports, source through the gate', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  assert.match(reason(write(root, 'tests/a.test.js', 'general-purpose')), /not part of this plugin's team/);
  assert.ok(denied(write(root, `${REPORTS}/T01-impl.md`, 'general-purpose')));
  assert.equal(write(root, 'src/a.js', 'general-purpose'), undefined);
  assert.ok(denied(write(makeProject(), 'src/a.js', 'general-purpose')), 'gate closed');
});

// ── Profiles ─────────────────────────────────────────────────────────────
test('strict: master locked out of protected and test paths, specs excepted', () => {
  const root = makeProject({ config: validConfig({ profile: 'strict' }), ledger: ledgerText(APPROVED) });
  assert.ok(denied(write(root, 'tests/a.test.js')));
  assert.ok(denied(write(root, '.eslintrc.json')));
  assert.equal(write(root, 'specs/001-login/tasks.md'), undefined); // plan.md is locked once approved
  assert.equal(write(root, 'src/a.js'), undefined);
});

test('standard: master may change protected paths after approval', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  assert.equal(write(root, '.eslintrc.json'), undefined);
});

test('disabled plan-gate and integrity → nothing is checked', () => {
  const root = makeProject({ config: validConfig({ disabledHooks: ['plan-gate', 'verifier-integrity'] }) });
  assert.equal(write(root, 'src/a.js'), undefined);
  assert.equal(write(root, 'tests/a.test.js', H('implementer')), undefined);
});

// ── Symlinks ─────────────────────────────────────────────────────────────
test('a symlink inside the project pointing at a protected file → denied', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'tests', 'a.test.js'), '');
  fs.mkdirSync(path.join(root, 'src'));
  fs.symlinkSync(path.join(root, 'tests', 'a.test.js'), path.join(root, 'src', 'innocent.js'));
  assert.ok(denied(write(root, 'src/innocent.js', H('implementer'))));
});

test('a symlinked folder pointing into protected paths → denied for new files too', () => {
  const root = makeProject({ ledger: ledgerText(APPROVED) });
  fs.mkdirSync(path.join(root, 'tests'));
  fs.symlinkSync(path.join(root, 'tests'), path.join(root, 'lib'));
  assert.ok(denied(write(root, 'lib/new.test.js', H('implementer'))));
});

// ── Malformed tool input → throws (wrapper blocks) ──────────────────────
test('Write without file_path throws', () => {
  assert.throws(() => decide(makeProject(), 'Write', { content: 'x' }));
});
