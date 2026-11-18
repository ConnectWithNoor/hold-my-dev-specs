#!/usr/bin/env node
'use strict';
// Stop dispatcher (one per event): strict-profile checks. On any error Claude still stops
// (exit 2 here would keep it going) and the user sees a ⚠ warning.
const { main } = require('./lib/run');
const { handleStop } = require('./lib/stop-checks');

main((input, env) => handleStop(input, env), { onError: 'warn' });
