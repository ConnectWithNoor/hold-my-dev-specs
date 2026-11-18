#!/usr/bin/env node
'use strict';
// PreToolUse dispatcher (one per event). Blocks on any error.
// Agent calls → model by tier + context manifest; file writes → gate and integrity.
const { main } = require('./lib/run');
const { decideToolCall } = require('./lib/gate');
const { decideAgentCall } = require('./lib/agent-call');

main((input, env) => (input.tool_name === 'Agent' ? decideAgentCall(input, env) : decideToolCall(input, env)), { onError: 'block' });
