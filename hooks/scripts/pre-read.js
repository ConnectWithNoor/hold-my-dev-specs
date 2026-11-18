#!/usr/bin/env node
'use strict';
// PreToolUse on Read / Grep (its own entry, without onFailure: block): blocks secret reads while the
// safety copy is on, and allows the plugin's own docs. Any problem here lets the read go through the
// normal permission flow — this entry never blocks because of an error.
const { main } = require('./lib/run');
const { decideRead } = require('./lib/read-call');

main((input, env) => decideRead(input, env), { onError: 'pass' });
