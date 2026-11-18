'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { whoIsCalling, HELPERS } = require('../../hooks/scripts/lib/agents');

test('no agent_type → master', () => {
  assert.deepEqual(whoIsCalling({}), { kind: 'master' });
  assert.deepEqual(whoIsCalling({ agent_type: '' }), { kind: 'master' });
});

for (const name of HELPERS) {
  test(`${name}: prefixed and bare forms both match`, () => {
    assert.deepEqual(whoIsCalling({ agent_type: `hold-my-dev-specs:${name}` }), { kind: 'helper', name });
    assert.deepEqual(whoIsCalling({ agent_type: name }), { kind: 'helper', name });
  });
}

test('other agents are "other", keeping their full type', () => {
  assert.deepEqual(whoIsCalling({ agent_type: 'general-purpose' }), { kind: 'other', name: 'general-purpose' });
  assert.deepEqual(whoIsCalling({ agent_type: 'other-plugin:implementer' }), { kind: 'other', name: 'other-plugin:implementer' });
  assert.deepEqual(whoIsCalling({ agent_type: 'hold-my-dev-specs:unknown' }), { kind: 'other', name: 'hold-my-dev-specs:unknown' });
});

test('non-string agent_type throws (wrapper then blocks)', () => {
  assert.throws(() => whoIsCalling({ agent_type: 42 }));
});
