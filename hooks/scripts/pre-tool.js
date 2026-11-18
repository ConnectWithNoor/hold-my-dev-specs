#!/usr/bin/env node
'use strict';
// PreToolUse dispatcher for writes, shell commands and Agent calls. Blocks on any error.
// (Read / Grep have their own entry, pre-read.js, which never blocks: secret reads + plugin docs.)
const { main } = require('./lib/run');
const { decide } = require('./lib/tool-call');

main((input, env) => decide(input, env), { onError: 'block' });
