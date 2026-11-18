'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { decidePluginRead } = require('../../hooks/scripts/lib/plugin-docs');

const PLUGIN = path.join(__dirname, '..', '..');
const read = (file, env = { CLAUDE_PLUGIN_ROOT: PLUGIN }, cwd = os.tmpdir()) =>
  decidePluginRead({ tool_name: 'Read', cwd, tool_input: { file_path: file } }, env);
const allowed = (out) => !!out && out.hookSpecificOutput.permissionDecision === 'allow';

test('the plugin\'s guides, templates, skills and agents → allow', () => {
  for (const rel of ['guides/lifecycle.md', 'templates/spec.md', 'templates/hold-my-dev-specs.json', 'skills/feature/SKILL.md', 'agents/verifier.md']) {
    assert.ok(allowed(read(path.join(PLUGIN, rel))), rel);
  }
});

test('relative paths from a skill folder resolve and are allowed', () => {
  assert.ok(allowed(read('../../guides/ledger.md', undefined, path.join(PLUGIN, 'skills', 'setup'))));
});

test('other plugin files and anything outside → no decision', () => {
  for (const rel of ['hooks/scripts/lib/gate.js', 'package.json', '.claude-plugin/plugin.json', 'README.md']) {
    assert.equal(read(path.join(PLUGIN, rel)), undefined, rel);
  }
  assert.equal(read('/etc/hostname'), undefined);
  assert.equal(read(path.join(PLUGIN, 'guides', '..', 'package.json')), undefined);
});

test('a symlink inside the plugin docs pointing outside → no decision', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hmds-plugin-'));
  fs.mkdirSync(path.join(tmp, 'guides'));
  fs.writeFileSync(path.join(tmp, 'secret.txt'), 's');
  fs.symlinkSync(path.join(tmp, 'secret.txt'), path.join(tmp, 'guides', 'innocent.md'));
  fs.writeFileSync(path.join(tmp, 'guides', 'real.md'), 'r');
  const env = { CLAUDE_PLUGIN_ROOT: tmp };
  assert.equal(read(path.join(tmp, 'guides', 'innocent.md'), env), undefined);
  assert.ok(allowed(read(path.join(tmp, 'guides', 'real.md'), env)));
});

test('a folder, a missing file, no plugin root, odd input → no decision, never throws', () => {
  assert.equal(read(path.join(PLUGIN, 'guides')), undefined);
  assert.equal(read(path.join(PLUGIN, 'guides', 'nope.md')), undefined);
  assert.equal(read(path.join(PLUGIN, 'guides', 'lifecycle.md'), {}), undefined);
  assert.equal(decidePluginRead({ tool_name: 'Read', tool_input: {} }, { CLAUDE_PLUGIN_ROOT: PLUGIN }), undefined);
  assert.equal(decidePluginRead({}, { CLAUDE_PLUGIN_ROOT: PLUGIN }), undefined);
});

test('works without any project settings (setup reads the guides first)', () => {
  // decidePluginRead never looks at the project: no CLAUDE_PROJECT_DIR needed
  assert.ok(allowed(read(path.join(PLUGIN, 'guides', 'project-config.md'))));
});
