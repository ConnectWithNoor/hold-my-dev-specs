'use strict';
// Builders for the JSON that hooks print. Formats: docs/research/verification.md.

function preToolUse(decision, reason, extra = {}) {
  const out = { hookEventName: 'PreToolUse', permissionDecision: decision, ...extra };
  if (reason) out.permissionDecisionReason = reason;
  return { hookSpecificOutput: out };
}

const deny = (reason) => preToolUse('deny', reason);
const ask = (reason) => preToolUse('ask', reason);
const allow = (reason, extra) => preToolUse('allow', reason, extra);

// A one-line notice the user sees (e.g. "✅ Plan approved 19:20").
const userNotice = (text) => ({ systemMessage: text });

module.exports = { preToolUse, deny, ask, allow, userNotice };
