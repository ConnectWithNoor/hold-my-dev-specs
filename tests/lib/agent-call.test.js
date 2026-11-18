'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decideAgentCall, TIER } = require('../../hooks/scripts/lib/agent-call');
const { HELPERS } = require('../../hooks/scripts/lib/agents');
const { validConfig, makeProject } = require('../helpers');

const MODELS = { strongest: 'strong-model', mid: 'mid-model' };
const project = (overrides = {}) => makeProject({ config: validConfig({ models: MODELS, ...overrides }) });

function spawn(root, subagent, model) {
  const ti = { description: 'd', prompt: 'Do the work.', subagent_type: subagent };
  if (model !== undefined) ti.model = model;
  return decideAgentCall({ tool_name: 'Agent', cwd: root, tool_input: ti }, { CLAUDE_PROJECT_DIR: root });
}
const updated = (out) => out.hookSpecificOutput.updatedInput;

test('every helper the hooks know has a tier', () => {
  assert.deepEqual(Object.keys(TIER).sort(), [...HELPERS].sort());
});

test('missing model → filled per tier, both name forms', () => {
  const root = project();
  const expected = {
    verifier: 'strong-model', 'test-author': 'strong-model', 'spec-miner': 'strong-model',
    implementer: 'mid-model', explorer: 'mid-model', shipper: 'mid-model',
  };
  for (const [name, model] of Object.entries(expected)) {
    for (const form of [`hold-my-dev-specs:${name}`, name]) {
      const out = spawn(root, form);
      assert.equal(out.hookSpecificOutput.permissionDecision, 'allow', form);
      assert.equal(updated(out).model, model, form);
      assert.equal(updated(out).subagent_type, form);
      assert.equal(updated(out).description, 'd');
    }
  }
});

test('given model equal to the tier → nothing extra', () => {
  const root = project({ profile: 'minimal' });
  assert.equal(spawn(root, 'hold-my-dev-specs:implementer', 'mid-model'), undefined);
});

test('given model different from the tier → kept, with a note in the brief', () => {
  const root = project({ profile: 'minimal' });
  const out = spawn(root, 'hold-my-dev-specs:implementer', 'strong-model');
  assert.equal(updated(out).model, 'strong-model');
  assert.match(updated(out).prompt, /started with model "strong-model" instead of the mid tier's "mid-model"/);
});

test('other (non-roster) agents are untouched', () => {
  const root = project({ profile: 'minimal' });
  assert.equal(spawn(root, 'general-purpose'), undefined);
  assert.equal(spawn(root, 'Explore'), undefined);
  assert.equal(spawn(root, 'other-plugin:implementer'), undefined);
});

test('minimal profile (no context manifest) → model still filled', () => {
  const out = spawn(project({ profile: 'minimal' }), 'hold-my-dev-specs:verifier');
  assert.equal(updated(out).model, 'strong-model');
  assert.equal(updated(out).prompt, 'Do the work.'); // no manifest notice in minimal
});

test('standard profile: model filled and manifest notice added together', () => {
  const out = spawn(project(), 'hold-my-dev-specs:explorer');
  assert.equal(updated(out).model, 'mid-model');
  assert.match(updated(out).prompt, /^Do the work\.\n\nhold-my-dev-specs: no "hmds-task/);
});

test('plugin off or settings not ok → untouched', () => {
  assert.equal(spawn(makeProject({ config: null }), 'hold-my-dev-specs:verifier'), undefined);
  assert.equal(spawn(makeProject({ config: '{ nope' }), 'hold-my-dev-specs:verifier'), undefined);
});
