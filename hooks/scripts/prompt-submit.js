#!/usr/bin/env node
'use strict';
// UserPromptSubmit dispatcher (one per event): approval recorder, then the workflow-state note.
// On any error: the message goes through, nothing is recorded, and the user sees a ⚠ warning.
const { main } = require('./lib/run');
const { onPrompt } = require('./lib/prompt');

main((input, env) => onPrompt(input, env), { onError: 'warn' });
