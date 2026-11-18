'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stateNote } = require('../../hooks/scripts/lib/workflow-state');
const { onPrompt } = require('../../hooks/scripts/lib/prompt');
const { validConfig, ledgerText, makeProject } = require('../helpers');

const T = '2026-11-18T19:20:00Z';
const note = (root, prompt = 'hello') => stateNote({ cwd: root, prompt }, { CLAUDE_PROJECT_DIR: root });

test('2–3 lines: feature + stage + approvals, active task with status, next step', () => {
  const ledger = ledgerText({ stage: 'build', spec_approved: T, plan_approved: T, active_task: 'T02' })
    .replace('## Tasks\n', '## Tasks\n| Task | Status | Round | Report |\n|---|---|---|---|\n| T01 | verified | 1 | r |\n| T02 | fixing | 2 | r |\n');
  const out = note(makeProject({ ledger }));
  assert.equal(out, [
    '<workflow-state>',
    'feature 001-login (full lane) · stage build · spec ✓ plan ✓',
    'task T02 · fixing · round 2',
    'next: dispatch and monitor the next task; verify each one',
    '</workflow-state>',
  ].join('\n'));
});

test('waiting for an approval → says so, and not to build', () => {
  assert.match(note(makeProject({ ledger: ledgerText({ awaiting: 'plan', spec_approved: T, stage: 'plan' }) })), /waiting for the user to type "approve plan"/);
});

test('approvals missing while building (after revoke) → stop and go back to spec review', () => {
  assert.match(note(makeProject({ ledger: ledgerText({ stage: 'build' }) })), /stop dispatching, report finished tasks, go back to spec review/);
});

test('skip keyword anywhere in the message → no note', () => {
  const root = makeProject();
  assert.equal(note(root, 'quick question #nostate'), undefined);
  const custom = makeProject({ config: validConfig({ workflowState: { skipKeyword: '!quiet' } }) });
  assert.equal(note(custom, '!quiet please'), undefined);
  assert.ok(note(custom, '#nostate'));
});

test('no feature, broken ledger, unfinished settings → one line about it', () => {
  assert.match(note(makeProject({ active: null })), /no active feature/);
  assert.match(note(makeProject({ ledger: '# broken' })), /repair the ledger first/);
  assert.match(note(makeProject({ config: validConfig({ profile: null }) })), /settings are unfinished/);
});

test('plugin off, minimal profile, disabled → nothing', () => {
  assert.equal(note(makeProject({ config: null })), undefined);
  assert.equal(note(makeProject({ config: validConfig({ profile: 'minimal' }) })), undefined);
  assert.equal(note(makeProject({ config: validConfig({ disabledHooks: ['workflow-state'] }) })), undefined);
});

test('combined with an approval: ✅ for the user, both contexts for Claude, note shows the new state', () => {
  const root = makeProject({ ledger: ledgerText({ awaiting: 'spec' }) });
  const out = onPrompt({ cwd: root, prompt: 'approve spec' }, { CLAUDE_PROJECT_DIR: root }, new Date(T));
  assert.match(out.systemMessage, /^✅ Spec approved/);
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.match(ctx, /recorded "approve spec"/);
  assert.match(ctx, /spec ✓ plan ✗/);
});

test('ordinary message → only the note', () => {
  const root = makeProject();
  const out = onPrompt({ cwd: root, prompt: 'hi' }, { CLAUDE_PROJECT_DIR: root });
  assert.equal(out.systemMessage, undefined);
  assert.match(out.hookSpecificOutput.additionalContext, /^<workflow-state>/);
});

test('plugin off → onPrompt returns nothing', () => {
  const root = makeProject({ config: null });
  assert.equal(onPrompt({ cwd: root, prompt: 'approve spec' }, { CLAUDE_PROJECT_DIR: root }), undefined);
});
