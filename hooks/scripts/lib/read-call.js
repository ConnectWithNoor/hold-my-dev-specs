'use strict';
// PreToolUse on Read / Grep (the fail-open entry): the safety copy's secret-read rule first, then the
// plugin's own docs. A problem in the safety check never blocks a read (user decision: a broken script
// must not stop every read in every session); native deny rules are the recommended hard line (README).
const { decideSafety } = require('./safety');
const { decidePluginRead } = require('./plugin-docs');
const { deny } = require('./output');

function decideRead(input, env) {
  let safety = null;
  try { safety = decideSafety(input, env); } catch { safety = null; }
  if (safety && safety.deny) return deny(`hold-my-dev-specs safety: ${safety.deny}`);
  return decidePluginRead(input, env);
}

module.exports = { decideRead };
