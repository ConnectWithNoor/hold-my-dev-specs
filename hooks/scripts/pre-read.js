#!/usr/bin/env node
'use strict';
// PreToolUse on Read (its own entry, without onFailure: block): allows the plugin's own docs.
// This plugin gates no reads, so any problem here lets the read go through the normal flow.
const { main } = require('./lib/run');
const { decidePluginRead } = require('./lib/plugin-docs');

main((input, env) => decidePluginRead(input, env), { onError: 'pass' });
