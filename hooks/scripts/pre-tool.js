#!/usr/bin/env node
'use strict';
// PreToolUse dispatcher for writes and Agent calls. Blocks on any error.
// Agent → model by tier + context manifest; file writes → gate and integrity.
// (Read has its own entry, pre-read.js, which never blocks.)
const { main } = require('./lib/run');
const { decideToolCall } = require('./lib/gate');
const { decideAgentCall } = require('./lib/agent-call');

main((input, env) => (input.tool_name === 'Agent' ? decideAgentCall(input, env) : decideToolCall(input, env)), { onError: 'block' });
