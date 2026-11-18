'use strict';
// End-to-end: run the real hook scripts as separate processes, the way Claude Code does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ledgerText, makeProject } = require('../helpers');

const SCRIPTS = path.join(__dirname, '../../hooks/scripts');

function runScript(name, stdin, root) {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, name)], {
    input: stdin,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root || '' },
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('hooks.json is valid and points at existing scripts', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../hooks/hooks.json'), 'utf8'));
  for (const groups of Object.values(cfg.hooks)) {
    for (const g of groups) {
      for (const h of g.hooks) {
        const rel = h.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)/)[1];
        assert.ok(fs.existsSync(path.join(__dirname, '../..', rel)), rel);
      }
    }
  }
  // Only tool-call hooks block on failure; message hooks must not.
  assert.equal(cfg.hooks.PreToolUse[0].hooks[0].onFailure, 'block');
  assert.equal(cfg.hooks.UserPromptSubmit[0].hooks[0].onFailure, undefined);
});

test('pre-tool: closed gate → deny JSON, exit 0', () => {
  const root = makeProject();
  const input = JSON.stringify({ cwd: root, tool_name: 'Write', tool_input: { file_path: path.join(root, 'src/a.js'), content: 'x' } });
  const r = runScript('pre-tool.js', input, root);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('pre-tool: garbled input → exit 2 (blocked)', () => {
  const r = runScript('pre-tool.js', '{"tool_name": "Wri', makeProject());
  assert.equal(r.code, 2);
  assert.match(r.stderr, /blocked to stay safe/);
});

test('prompt-submit: approval recorded end-to-end', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'spec' }) });
  const r = runScript('prompt-submit.js', JSON.stringify({ cwd: root, prompt: 'approve spec' }), root);
  assert.equal(r.code, 0);
  assert.match(JSON.parse(r.stdout).systemMessage, /^✅ Spec approved/);
});

test('prompt-submit: garbled input → message passes (exit 0) with a ⚠ warning', () => {
  const r = runScript('prompt-submit.js', 'not json', makeProject());
  assert.equal(r.code, 0);
  assert.match(JSON.parse(r.stdout).systemMessage, /^⚠ hold-my-dev-specs/);
});

test('prompt-submit: crash while writing the ledger → message passes, nothing recorded, ⚠ shown',
  { skip: process.getuid && process.getuid() === 0 ? 'root ignores folder permissions' : false }, () => {
    const root = makeProject({ ledger: ledgerText({ awaiting: 'spec' }) });
    const dir = path.join(root, 'specs', '001-login');
    const before = fs.readFileSync(path.join(dir, 'ledger.md'), 'utf8');
    fs.chmodSync(dir, 0o555); // folder read-only: the atomic write fails
    try {
      const r = runScript('prompt-submit.js', JSON.stringify({ cwd: root, prompt: 'approve spec' }), root);
      assert.equal(r.code, 0);
      assert.match(JSON.parse(r.stdout).systemMessage, /^⚠ hold-my-dev-specs: .* — nothing was changed$/);
      assert.equal(fs.readFileSync(path.join(dir, 'ledger.md'), 'utf8'), before);
    } finally {
      fs.chmodSync(dir, 0o755);
    }
  });
