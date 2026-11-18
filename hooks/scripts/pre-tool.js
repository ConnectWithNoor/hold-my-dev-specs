#!/usr/bin/env node
'use strict';
// PreToolUse dispatcher (one per event). Blocks on any error.
const { main } = require('./lib/run');
const { decideToolCall } = require('./lib/gate');

main((input, env) => decideToolCall(input, env), { onError: 'block' });
