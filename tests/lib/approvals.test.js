'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { handlePrompt } = require('../../hooks/scripts/lib/approvals');
const { parseHeader } = require('../../hooks/scripts/lib/ledger');
const { validConfig, ledgerText, makeProject } = require('../helpers');

const NOW = new Date('2026-11-18T19:20:00Z');
const T0 = '2026-11-18T18:00:00Z';

function say(root, prompt) {
  return handlePrompt({ hook_event_name: 'UserPromptSubmit', cwd: root, prompt }, { CLAUDE_PROJECT_DIR: root }, NOW);
}
const ledgerOf = (root) => fs.readFileSync(path.join(root, 'specs/001-login/ledger.md'), 'utf8');
const headerOf = (root) => parseHeader(ledgerOf(root)).header;

test('exact phrase while awaiting → recorded, confirmation shown, log line added', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'spec' }) });
  const out = say(root, 'approve spec');
  assert.match(out.systemMessage, /^✅ Spec approved \d\d:\d\d$/);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  const h = headerOf(root);
  assert.equal(h.spec_approved, '2026-11-18T19:20:00Z');
  assert.equal(h.awaiting, 'none');
  assert.equal(h.plan_approved, 'no');
  assert.match(ledgerOf(root), /- 2026-11-18T19:20:00Z — spec approved \(approval phrase received\)\n$/);
});

test('trimmed and case-insensitive', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'spec' }) });
  say(root, '  Approve SPEC \n');
  assert.equal(headerOf(root).spec_approved, '2026-11-18T19:20:00Z');
});

test('phrase with extra text → ignored entirely', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'plan', spec_approved: T0 }) });
  const before = ledgerOf(root);
  assert.equal(say(root, 'approve plan, but change X'), undefined);
  assert.equal(say(root, 'please approve plan'), undefined);
  assert.equal(say(root, 'approve  plan'), undefined);
  assert.equal(ledgerOf(root), before);
});

test('phrase while not awaiting → not recorded, says why', () => {
  const root = makeProject();
  const before = ledgerOf(root);
  assert.match(say(root, 'approve spec').systemMessage, /not waiting for an approval/);
  assert.equal(ledgerOf(root), before);
});

test('wrong stage → not recorded', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'spec' }) });
  const before = ledgerOf(root);
  assert.match(say(root, 'approve plan').systemMessage, /waiting for "approve spec"/);
  assert.equal(ledgerOf(root), before);
});

test('approve plan before the spec is approved → not recorded, gate stays closed', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'plan' }) });
  assert.match(say(root, 'approve plan').systemMessage, /spec must be approved first/);
  assert.equal(headerOf(root).plan_approved, 'no');
});

test('approve plan after spec approval → recorded', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'plan', spec_approved: T0 }) });
  assert.match(say(root, 'approve plan').systemMessage, /^✅ Plan approved/);
  assert.equal(headerOf(root).plan_approved, '2026-11-18T19:20:00Z');
  assert.equal(headerOf(root).spec_approved, T0);
});

test('approve both while awaiting both → both recorded', () => {
  const root = makeProject({ ledger: ledgerText({ lane: 'quick', awaiting: 'both' }) });
  assert.match(say(root, 'approve both').systemMessage, /^✅ Spec and plan approved/);
  const h = headerOf(root);
  assert.equal(h.spec_approved, '2026-11-18T19:20:00Z');
  assert.equal(h.plan_approved, '2026-11-18T19:20:00Z');
});

test('approve both while awaiting only the spec → not recorded', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'spec' }) });
  say(root, 'approve both');
  assert.equal(headerOf(root).spec_approved, 'no');
});

test('revoke at any time → approvals cleared, gate closed, confirmation', () => {
  const root = makeProject({ ledger: ledgerText({ spec_approved: T0, plan_approved: T0, stage: 'build' }) });
  assert.match(say(root, 'revoke').systemMessage, /^↩ Approvals revoked/);
  const h = headerOf(root);
  assert.equal(h.spec_approved, 'no');
  assert.equal(h.plan_approved, 'no');
  assert.equal(h.stage, 'build'); // the master moves the stage back itself
});

test('ordinary messages are untouched and produce no output', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'spec' }) });
  assert.equal(say(root, 'looks good to me'), undefined);
  assert.equal(say(root, 'yes'), undefined);
});

test('plugin off → nothing, even for an approval phrase', () => {
  assert.equal(say(makeProject({ config: null }), 'approve spec'), undefined);
});

test('unfinished settings, no active feature, broken ledger → warning, nothing recorded', () => {
  assert.match(say(makeProject({ config: validConfig({ profile: null }) }), 'approve spec').systemMessage, /settings are unfinished/);
  assert.match(say(makeProject({ active: null }), 'approve spec').systemMessage, /no active feature/);
  assert.match(say(makeProject({ ledger: '# broken' }), 'approve spec').systemMessage, /nothing recorded/);
});

test('plan gate disabled → approval recorder is off too', () => {
  const root = makeProject({ config: validConfig({ disabledHooks: ['plan-gate'] }), ledger: ledgerText({ awaiting: 'spec' }) });
  assert.equal(say(root, 'approve spec'), undefined);
  assert.equal(headerOf(root).spec_approved, 'no');
});
