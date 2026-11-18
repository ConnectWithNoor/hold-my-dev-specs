'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadConfig, checkConfig, projectRoot, FIELDS } = require('../../hooks/scripts/lib/project');
const { validConfig, makeProject } = require('../helpers');

test('projectRoot prefers CLAUDE_PROJECT_DIR, falls back to cwd, throws without either', () => {
  assert.equal(projectRoot({ cwd: '/b' }, { CLAUDE_PROJECT_DIR: '/a' }), '/a');
  assert.equal(projectRoot({ cwd: '/b' }, {}), '/b');
  assert.throws(() => projectRoot({}, {}));
});

test('no settings file → absent (plugin off)', () => {
  assert.deepEqual(loadConfig(makeProject({ config: null })), { status: 'absent' });
});

test('valid settings → ok', () => {
  const r = loadConfig(makeProject());
  assert.equal(r.status, 'ok');
  assert.equal(r.config.profile, 'standard');
});

test('the shipped template (all null) → unfinished, listing every required field', () => {
  const template = JSON.parse(fs.readFileSync(path.join(__dirname, '../../templates/hold-my-dev-specs.json'), 'utf8'));
  const r = checkConfig(template);
  assert.equal(r.status, 'unfinished');
  const required = FIELDS.filter(([, , nullable]) => !nullable).length;
  assert.equal(r.problems.length, required);
});

test('one required field null → unfinished', () => {
  const r = checkConfig(validConfig({ models: { strongest: null, mid: 'sonnet' } }));
  assert.equal(r.status, 'unfinished');
  assert.deepEqual(r.problems, ['models.strongest is not set yet']);
});

test('nullable fields may stay null', () => {
  assert.equal(checkConfig(validConfig()).status, 'ok'); // fixture has commands.lint etc. null
});

test('empty lists are allowed', () => {
  assert.equal(checkConfig(validConfig({ disabledHooks: [], paths: { open: [], protected: [], tests: [] } })).status, 'ok');
});

for (const [name, override] of [
  ['unknown profile', { profile: 'loose' }],
  ['unknown disabled hook', { disabledHooks: ['approval-recorder'] }],
  ['threshold out of range', { verification: { ...validConfig().verification, passThreshold: 11 } }],
  ['maxRounds not an integer', { fixLoop: { maxRounds: 2.5 } }],
  ['open paths not a list', { paths: { open: 'specs/**', protected: [], tests: [] } }],
  ['unknown signal', { verification: { ...validConfig().verification, signals: ['telepathy'] } }],
]) {
  test(`${name} → broken`, () => assert.equal(checkConfig(validConfig(override)).status, 'broken'));
}

test('wrong schemaVersion, invalid JSON, non-object → broken', () => {
  assert.equal(checkConfig(validConfig({ schemaVersion: 2 })).status, 'broken');
  assert.equal(checkConfig([]).status, 'broken');
  assert.equal(loadConfig(makeProject({ config: '{"schemaVersion": 1,' })).status, 'broken');
});

test('wrong value beats missing value: broken, not unfinished', () => {
  assert.equal(checkConfig(validConfig({ profile: 'loose', models: { strongest: null, mid: null } })).status, 'broken');
});
