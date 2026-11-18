'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { handleStop } = require('../../hooks/scripts/lib/stop-checks');
const { validConfig, ledgerText, makeProject } = require('../helpers');

const T = '2026-11-18T19:20:00Z';
const BUILDING = ledgerText({ stage: 'build', spec_approved: T, plan_approved: T });
const strict = (commands) => validConfig({ profile: 'strict', commands: { test: 'npm test', lint: null, format: null, typecheck: null, ...commands } });

// A committed git project; by default the active feature is approved and in the build stage.
function gitProject(config, ledger = BUILDING) {
  const root = makeProject({ config, ledger });
  const g = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  g('init', '-q');
  g('config', 'user.email', 't@example.com');
  g('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'keep.js'), 'k');
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  return root;
}
const put = (root, rel, text = 'x') => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};

// One plugin data folder per test project, kept across calls (it holds the last fingerprint).
const dataDirs = new Map();
function stop(root, { run, active = false } = {}) {
  if (!dataDirs.has(root)) dataDirs.set(root, fs.mkdtempSync(path.join(os.tmpdir(), 'hmds-data-')));
  const env = { CLAUDE_PROJECT_DIR: root, CLAUDE_PLUGIN_DATA: dataDirs.get(root) };
  return handleStop({ cwd: root, stop_hook_active: active }, env, run);
}
// Records the commands it was asked to run; "fail" names a check that should fail.
function fakeRunner(fail = []) {
  const calls = [];
  const run = (cmd) => { calls.push(cmd); return fail.some((f) => cmd.includes(f)) ? { code: 1, out: 'line1\nERROR here' } : { code: 0, out: '' }; };
  return { calls, run };
}

test('nothing changed → no checks run', () => {
  const root = gitProject(strict({ lint: 'eslint .' }));
  const r = fakeRunner();
  assert.equal(stop(root, { run: r.run }), undefined);
  assert.deepEqual(r.calls, []);
});

test('source change in build stage → checks run; same tree again → skipped', () => {
  const root = gitProject(strict({ format: 'prettier -w {files}', lint: 'eslint .', typecheck: 'tsc' }));
  put(root, 'src/a.js');
  const r = fakeRunner();
  stop(root, { run: r.run });
  assert.deepEqual(r.calls, ["prettier -w 'src/a.js'", 'eslint .', 'tsc']);
  stop(root, { run: r.run });
  assert.equal(r.calls.length, 3, 'unchanged tree → not run again');
  put(root, 'src/a.js', 'xy');
  stop(root, { run: r.run });
  assert.equal(r.calls.length, 6, 'changed again → run again');
});

test('validate stage → checks run too', () => {
  const root = gitProject(strict({ lint: 'eslint .' }), ledgerText({ stage: 'validate', spec_approved: T, plan_approved: T }));
  put(root, 'src/a.js');
  const r = fakeRunner();
  stop(root, { run: r.run });
  assert.equal(r.calls.length, 1);
});

test('spec-only change → nothing runs', () => {
  const root = gitProject(strict({ lint: 'eslint .' }));
  put(root, 'specs/001-login/spec.md', 'changed');
  put(root, 'docs/notes.md');
  const r = fakeRunner(['eslint']);
  assert.equal(stop(root, { run: r.run }), undefined);
  assert.deepEqual(r.calls, []);
});

test('test, protected or settings changes alone → nothing runs', () => {
  const root = gitProject(strict({ lint: 'eslint .' }));
  put(root, 'tests/a.test.js');
  put(root, '.eslintrc.json', '{}');
  put(root, '.claude/hold-my-dev-specs.json', JSON.stringify(strict({ lint: 'eslint .' })));
  const r = fakeRunner();
  assert.equal(stop(root, { run: r.run }), undefined);
  assert.deepEqual(r.calls, []);
});

test('spec change after a source check → not run again (only source changes count)', () => {
  const root = gitProject(strict({ lint: 'eslint .' }));
  put(root, 'src/a.js');
  const r = fakeRunner();
  stop(root, { run: r.run });
  put(root, 'specs/001-login/notes.md');
  stop(root, { run: r.run });
  assert.equal(r.calls.length, 1);
});

test('source change while the gate is closed or the stage is not build/validate → nothing runs', () => {
  for (const ledger of [
    ledgerText({ stage: 'spec' }),
    ledgerText({ stage: 'build', spec_approved: T }),
    ledgerText({ stage: 'tasks', spec_approved: T, plan_approved: T }),
    ledgerText({ stage: 'done', spec_approved: T, plan_approved: T }),
  ]) {
    const root = gitProject(strict({ lint: 'eslint .' }), ledger);
    put(root, 'src/a.js');
    const r = fakeRunner(['eslint']);
    assert.equal(stop(root, { run: r.run }), undefined);
    assert.deepEqual(r.calls, []);
  }
});

test('no active feature or broken ledger → nothing runs', () => {
  const r = fakeRunner();
  const none = makeProject({ config: strict({ lint: 'eslint .' }), active: null });
  assert.equal(stop(none, { run: r.run }), undefined);
  const broken = gitProject(strict({ lint: 'eslint .' }), '# broken');
  put(broken, 'src/a.js');
  assert.equal(stop(broken, { run: r.run }), undefined);
  assert.deepEqual(r.calls, []);
});

test('{files} never contains spec, test, protected or settings paths', () => {
  const root = gitProject(strict({ lint: 'eslint {files}' }));
  put(root, 'src/new file.js');
  put(root, 'specs/001-login/spec.md');
  put(root, 'tests/a.test.js');
  put(root, 'src/b.test.js');
  put(root, '.github/workflows/ci.yml');
  put(root, '.eslintrc.json', '{}');
  put(root, 'docs/n.md');
  fs.rmSync(path.join(root, 'src', 'keep.js'));
  const r = fakeRunner();
  stop(root, { run: r.run });
  assert.deepEqual(r.calls, ["eslint 'src/new file.js'"]);
});

test('a deleted source file counts as a change, but is not passed in {files}', () => {
  const root = gitProject(strict({ lint: 'eslint {files}', typecheck: 'tsc' }));
  fs.rmSync(path.join(root, 'src', 'keep.js'));
  const r = fakeRunner();
  stop(root, { run: r.run });
  assert.deepEqual(r.calls, ['tsc']); // {files} would be empty → lint skipped
});

test('{files} after a rename lists only the new name', () => {
  const root = gitProject(strict({ lint: 'eslint {files}' }));
  spawnSync('git', ['mv', 'src/keep.js', 'src/moved.js'], { cwd: root });
  const r = fakeRunner();
  stop(root, { run: r.run });
  assert.deepEqual(r.calls, ["eslint 'src/moved.js'"]);
});

test('failure → block once with the error tail for Claude', () => {
  const root = gitProject(strict({ lint: 'eslint .' }));
  put(root, 'src/a.js');
  const out = stop(root, { run: fakeRunner(['eslint']).run });
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /lint: `eslint \.` failed \(exit 1\)\nline1\nERROR here/);
});

test('still failing on the retry (stop_hook_active) → one ⚠ line, Claude stops', () => {
  const root = gitProject(strict({ lint: 'eslint .' }));
  put(root, 'src/a.js');
  const out = stop(root, { run: fakeRunner(['eslint']).run, active: true });
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /^⚠ hold-my-dev-specs: lint still failing after one fix attempt/);
});

test('a formatter changing files itself does not trigger another run', () => {
  const root = gitProject(strict({ format: 'fmt {files}' }));
  put(root, 'src/a.js');
  let n = 0;
  const run = () => { n++; put(root, 'src/a.js', `formatted ${n}`); return { code: 0, out: '' }; };
  stop(root, { run });
  stop(root, { run });
  assert.equal(n, 1);
});

test('real commands: exit code and output are used', () => {
  const root = gitProject(strict({ lint: `"${process.execPath}" -e "console.error('real failure'); process.exit(3)"` }));
  put(root, 'src/a.js');
  const out = stop(root);
  assert.match(out.reason, /exit 3\)\nreal failure/);
});

test('not strict, no commands, or plugin off → nothing', () => {
  const r = fakeRunner();
  for (const config of [validConfig({ commands: { test: null, lint: 'eslint .', format: null, typecheck: null } }), strict({}), null]) {
    const root = gitProject(config);
    put(root, 'src/a.js');
    assert.equal(stop(root, { run: r.run }), undefined);
  }
  assert.deepEqual(r.calls, []);
});

test('not a git repository → checks run every time while building (changes can\'t be told)', () => {
  const root = makeProject({ config: strict({ lint: 'eslint .' }), ledger: BUILDING });
  const r = fakeRunner();
  stop(root, { run: r.run });
  stop(root, { run: r.run });
  assert.equal(r.calls.length, 2);
});
