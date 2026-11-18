'use strict';
// PreToolUse on Read: the master needs the plugin's own guides and templates, which live outside the
// project, so Claude Code would ask permission for every read. This answers "allow" for exactly those
// files — real path inside the plugin's guides/, templates/, skills/ or agents/ — and stays silent for
// everything else. Runs in every project, settings or not (setup reads the guides before they exist).
// Never throws: reading is not something this plugin gates, so a problem here must not block reads.
const fs = require('fs');
const path = require('path');
const { allow } = require('./output');

const DOC_FOLDERS = ['guides', 'templates', 'skills', 'agents'];

function decidePluginRead(input, env) {
  try {
    const root = env.CLAUDE_PLUGIN_ROOT;
    const file = input.tool_input && input.tool_input.file_path;
    if (!root || typeof file !== 'string' || !file) return undefined;
    const realRoot = fs.realpathSync(root);
    const realFile = fs.realpathSync(path.resolve(input.cwd || realRoot, file)); // must exist
    const rel = path.relative(realRoot, realFile);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
    const top = rel.split(path.sep)[0];
    if (!DOC_FOLDERS.includes(top) || !fs.statSync(realFile).isFile()) return undefined;
    return allow('hold-my-dev-specs: reading the plugin\'s own docs');
  } catch {
    return undefined;
  }
}

module.exports = { DOC_FOLDERS, decidePluginRead };
