'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isHookEnabled } = require('../../hooks/scripts/lib/profile');
const { validConfig } = require('../helpers');

// Expected table from guides/project-config.md ("Profiles").
const TABLE = {
  'approval-recorder': [true, true, true],
  'plan-gate': [true, true, true],
  'verifier-integrity': [true, true, true],
  safety: [false, true, true],
  'context-manifest': [false, true, true],
  'workflow-state': [false, true, true],
  'stop-checks': [false, false, true],
  'master-config-lock': [false, false, true],
};
['minimal', 'standard', 'strict'].forEach((profile, i) => {
  for (const [hook, expected] of Object.entries(TABLE)) {
    test(`${profile}: ${hook} is ${expected[i] ? 'on' : 'off'}`, () => {
      assert.equal(isHookEnabled(hook, validConfig({ profile })), expected[i]);
    });
  }
});

test('disabledHooks switches a single hook off', () => {
  const c = validConfig({ disabledHooks: ['workflow-state'] });
  assert.equal(isHookEnabled('workflow-state', c), false);
  assert.equal(isHookEnabled('context-manifest', c), true);
});

test('approval recorder follows the plan gate', () => {
  assert.equal(isHookEnabled('approval-recorder', validConfig({ disabledHooks: ['plan-gate'] })), false);
});

test('machine-wide switch turns only the safety copy off', () => {
  const env = { HOLD_MY_DEV_SPECS_SAFETY: 'off' };
  assert.equal(isHookEnabled('safety', validConfig(), env), false);
  assert.equal(isHookEnabled('plan-gate', validConfig(), env), true);
  assert.equal(isHookEnabled('safety', validConfig(), { HOLD_MY_DEV_SPECS_SAFETY: 'on' }), true);
});

test('unknown profile throws (wrapper then blocks)', () => {
  assert.throws(() => isHookEnabled('plan-gate', { profile: 'loose' }));
});
