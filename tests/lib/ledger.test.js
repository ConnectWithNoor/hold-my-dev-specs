'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../hooks/scripts/lib/ledger');
const { ledgerText, makeProject } = require('../helpers');

const T = '2026-11-18T19:20:00Z';

test('the shipped template parses once its placeholder feature name is filled in', () => {
  const template = fs.readFileSync(path.join(__dirname, '../../templates/ledger.md'), 'utf8');
  assert.equal(L.parseHeader(template).ok, false); // NNN-short-name is a placeholder
  const filled = template.replace(/NNN-short-name/g, '001-login');
  const r = L.parseHeader(filled);
  assert.equal(r.ok, true);
  assert.equal(r.header.awaiting, 'none');
});

test('valid header, also with Windows line endings', () => {
  assert.equal(L.parseHeader(ledgerText()).ok, true);
  assert.equal(L.parseHeader(ledgerText().replace(/\n/g, '\r\n')).ok, true);
});

for (const [name, text] of [
  ['no header block', '# Ledger\n'],
  ['header not at the top', `\n${ledgerText()}`],
  ['unknown key', ledgerText().replace('lane: full', 'lane: full\ncolor: red')],
  ['duplicate key', ledgerText().replace('lane: full', 'lane: full\nlane: quick')],
  ['missing key', ledgerText().replace('active_task: none\n', '')],
  ['bad stage', ledgerText({ stage: 'dreaming' })],
  ['bad awaiting', ledgerText({ awaiting: 'everything' })],
  ['approval not a UTC time', ledgerText({ spec_approved: 'yes' })],
  ['approval with local offset', ledgerText({ spec_approved: '2026-11-18T19:20:00+01:00' })],
  ['bad task id', ledgerText({ active_task: 'task-3' })],
  ['line without "key: value"', ledgerText().replace('lane: full', 'lane full')],
]) {
  test(`${name} → broken`, () => assert.equal(L.parseHeader(text).ok, false));
}

test('gateOpen needs both approvals', () => {
  const h = (s, p) => L.parseHeader(ledgerText({ spec_approved: s, plan_approved: p })).header;
  assert.equal(L.gateOpen(h('no', 'no')), false);
  assert.equal(L.gateOpen(h(T, 'no')), false);
  assert.equal(L.gateOpen(h('no', T)), false);
  assert.equal(L.gateOpen(h(T, T)), true);
});

test('approvalsChanged: only approval values count', () => {
  const a = L.parseHeader(ledgerText()).header;
  const sameApprovals = L.parseHeader(ledgerText({ stage: 'build', active_task: 'T02' })).header;
  const changed = L.parseHeader(ledgerText({ plan_approved: T })).header;
  assert.equal(L.approvalsChanged(a, sameApprovals), false);
  assert.equal(L.approvalsChanged(a, changed), true);
});

test('setHeaderValues changes only the named values and keeps the body', () => {
  const before = ledgerText({ awaiting: 'spec' });
  const after = L.setHeaderValues(before, { spec_approved: T, awaiting: 'none' });
  const h = L.parseHeader(after).header;
  assert.equal(h.spec_approved, T);
  assert.equal(h.awaiting, 'none');
  assert.equal(h.plan_approved, 'no');
  assert.equal(after.split('---\n')[2], before.split('---\n')[2]);
});

test('setHeaderValues refuses invalid values and broken headers', () => {
  assert.throws(() => L.setHeaderValues(ledgerText(), { spec_approved: 'yes' }));
  assert.throws(() => L.setHeaderValues(ledgerText(), { colour: 'red' }));
  assert.throws(() => L.setHeaderValues('# no header', { awaiting: 'spec' }));
});

test('setHeaderValues never touches a body line that looks like a header line', () => {
  const text = `${ledgerText()}awaiting: spec\n`;
  const after = L.setHeaderValues(text, { awaiting: 'plan' });
  assert.ok(after.endsWith('awaiting: spec\n'));
});

test('readActive: missing / empty → none; invalid name → broken', () => {
  assert.equal(L.readActive(makeProject({ active: null })).status, 'none');
  const root = makeProject();
  fs.writeFileSync(path.join(root, 'specs', 'ACTIVE'), '\n');
  assert.equal(L.readActive(root).status, 'none');
  fs.writeFileSync(path.join(root, 'specs', 'ACTIVE'), '../etc\n');
  assert.equal(L.readActive(root).status, 'broken');
});

test('loadActiveLedger: ok, missing ledger, broken header, feature mismatch', () => {
  assert.equal(L.loadActiveLedger(makeProject()).status, 'ok');
  assert.equal(L.loadActiveLedger(makeProject({ ledger: null })).status, 'broken');
  assert.equal(L.loadActiveLedger(makeProject({ ledger: '# none' })).status, 'broken');
  assert.equal(L.loadActiveLedger(makeProject({ ledger: ledgerText({ feature: '002-other' }) })).status, 'broken');
  assert.equal(L.loadActiveLedger(makeProject({ active: null })).status, 'none');
});
