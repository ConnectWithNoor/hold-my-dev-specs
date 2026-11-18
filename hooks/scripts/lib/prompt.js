'use strict';
// UserPromptSubmit: approval recorder first (it may update the ledger), then the workflow-state note.
const { handlePrompt } = require('./approvals');
const { stateNote } = require('./workflow-state');

function onPrompt(input, env, now) {
  const approval = handlePrompt(input, env, now);
  const note = stateNote(input, env);
  if (!approval && !note) return undefined;
  const out = { ...(approval || {}) };
  const context = [approval && approval.hookSpecificOutput && approval.hookSpecificOutput.additionalContext, note]
    .filter(Boolean).join('\n');
  if (context) out.hookSpecificOutput = { hookEventName: 'UserPromptSubmit', additionalContext: context };
  return out;
}

module.exports = { onPrompt };
