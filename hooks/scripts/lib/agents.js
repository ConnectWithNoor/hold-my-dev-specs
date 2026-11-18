'use strict';
// Who made the tool call? From the hook input's `agent_type`:
// - missing          → the master (the main conversation)
// - one of our helpers, with or without the plugin prefix → that helper's name
// - anything else    → another agent (not from this plugin)

const PLUGIN = 'hold-my-dev-specs';
const HELPERS = ['explorer', 'test-author', 'implementer', 'verifier', 'shipper', 'spec-miner'];

function whoIsCalling(input) {
  const type = input && input.agent_type;
  if (type === undefined || type === null || type === '') return { kind: 'master' };
  if (typeof type !== 'string') throw new Error('agent_type is not a string');
  const name = type.startsWith(`${PLUGIN}:`) ? type.slice(PLUGIN.length + 1) : type;
  if (HELPERS.includes(name)) return { kind: 'helper', name };
  return { kind: 'other', name: type };
}

module.exports = { PLUGIN, HELPERS, whoIsCalling };
