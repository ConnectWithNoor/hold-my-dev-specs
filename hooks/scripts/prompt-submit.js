#!/usr/bin/env node
'use strict';
// UserPromptSubmit dispatcher (one per event). On any error: the message goes through,
// nothing is recorded, and the user sees a ⚠ warning.
const { main } = require('./lib/run');
const { handlePrompt } = require('./lib/approvals');

main((input, env) => handlePrompt(input, env), { onError: 'warn' });
