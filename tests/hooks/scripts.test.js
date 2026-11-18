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
  // Only the write/Agent hook blocks on failure; Read, message and Stop hooks must not.
  const [writes, reads] = cfg.hooks.PreToolUse;
  assert.equal(writes.hooks[0].onFailure, 'block');
  assert.match(writes.matcher, /\bAgent\b/);
  assert.doesNotMatch(writes.matcher, /\bRead\b/);
  assert.equal(reads.matcher, 'Read');
  assert.equal(reads.hooks[0].onFailure, undefined);
  assert.match(reads.hooks[0].command, /pre-read\.js/);
  assert.equal(cfg.hooks.UserPromptSubmit[0].hooks[0].onFailure, undefined);
  assert.equal(cfg.hooks.Stop[0].hooks[0].onFailure, undefined);
});

test('pre-read: the plugin\'s own guide → allow', () => {
  const file = path.join(__dirname, '../../guides/lifecycle.md');
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'pre-read.js')], {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: file } }),
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: path.join(__dirname, '../..') },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'allow');
});

test('pre-read: garbled input or a crash → never blocks (exit 0, no output)', () => {
  for (const input of ['{"tool_name": "Re', '', '[1]']) {
    const r = runScript('pre-read.js', input, makeProject());
    assert.equal(r.code, 0, JSON.stringify(input));
    assert.equal(r.stdout, '');
  }
});

test('pre-read: a project file → no decision (normal permission flow)', () => {
  const root = makeProject();
  const r = runScript('pre-read.js', JSON.stringify({ cwd: root, tool_name: 'Read', tool_input: { file_path: path.join(root, 'specs/ACTIVE') } }), root);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('pre-tool: Agent call is routed to the context manifest', () => {
  const root = makeProject();
  const input = JSON.stringify({ cwd: root, tool_name: 'Agent', tool_input: { prompt: 'x', subagent_type: 'hold-my-dev-specs:explorer' } });
  const r = runScript('pre-tool.js', input, root);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'allow');
});

test('prompt-submit: ordinary message → workflow-state note for Claude', () => {
  const root = makeProject();
  const r = runScript('prompt-submit.js', JSON.stringify({ cwd: root, prompt: 'hi' }), root);
  assert.equal(r.code, 0);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /<workflow-state>/);
});

test('stop: garbled input or a crash → Claude still stops (exit 0) with a ⚠ warning', () => {
  const r = runScript('stop.js', '{"oops', makeProject());
  assert.equal(r.code, 0);
  assert.match(JSON.parse(r.stdout).systemMessage, /^⚠ hold-my-dev-specs/);
  const crash = runScript('stop.js', JSON.stringify({ cwd: '' }), '');
  assert.equal(crash.code, 0);
  assert.match(JSON.parse(crash.stdout).systemMessage, /^⚠ hold-my-dev-specs/);
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
