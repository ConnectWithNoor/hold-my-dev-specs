'use strict';
// PreToolUse for tool calls (the blocking entry): Agent calls → model by tier + context manifest;
// everything else → the safety copy and the gate together. A deny from either wins; an ask from either
// is passed on (both reasons when both ask).
const { decideToolCall } = require('./gate');
const { decideAgentCall } = require('./agent-call');
const { decideSafety } = require('./safety');
const { deny, ask } = require('./output');

const decision = (out) => (out ? out.hookSpecificOutput.permissionDecision : null);
const reason = (out) => out.hookSpecificOutput.permissionDecisionReason;

// Read / Grep are not routed here: they have the fail-open entry (read-call.js).
function decide(input, env) {
  if (input.tool_name === 'Agent') return decideAgentCall(input, env);

  const safety = decideSafety(input, env);
  if (safety && safety.deny) return deny(`hold-my-dev-specs safety: ${safety.deny}`);

  const gate = decideToolCall(input, env);
  if (decision(gate) === 'deny') return gate;
  if (safety && safety.ask) {
    const extra = decision(gate) === 'ask' ? ` Also: ${reason(gate)}` : '';
    return ask(`hold-my-dev-specs safety: ${safety.ask}${extra}`);
  }
  return gate;
}

module.exports = { decide };
