'use strict';
// PreToolUse on Agent — two rules, while the project settings are ok:
// 1. Model by tier (always on, every profile): one of our helpers started without a model gets the
//    model of its tier from the settings; a different model is kept (the master may escalate) and
//    noted in the brief.
// 2. Context manifest (profile standard / strict): pastes the task's listed files into the brief.
// Returns allow + updatedInput when something changed, deny for a broken manifest, or undefined.
const { projectRoot, loadConfig } = require('./project');
const { isHookEnabled } = require('./profile');
const { whoIsCalling } = require('./agents');
const { manifestFor } = require('./manifest');
const { allow, deny } = require('./output');

const TIER = {
  verifier: 'strongest', 'test-author': 'strongest', 'spec-miner': 'strongest',
  implementer: 'mid', explorer: 'mid', shipper: 'mid',
};

function decideAgentCall(input, env) {
  const root = projectRoot(input, env);
  const cfg = loadConfig(root);
  if (cfg.status !== 'ok') return undefined;
  const config = cfg.config;
  const ti = input.tool_input || {};
  if (typeof ti.prompt !== 'string') throw new Error('Agent call has no prompt');

  const caller = whoIsCalling({ agent_type: ti.subagent_type });
  const helper = caller.kind === 'helper' ? caller.name : null;
  const updated = { ...ti };
  const notes = [];
  let changed = false;

  if (helper && TIER[helper]) {
    const tier = TIER[helper];
    const expected = config.models[tier];
    if (!ti.model) {
      updated.model = expected;
      changed = true;
    } else if (ti.model !== expected) {
      notes.push(`hold-my-dev-specs: started with model "${ti.model}" instead of the ${tier} tier's "${expected}" (escalated by the master). Mention this in your report.`);
    }
  }

  if (isHookEnabled('context-manifest', config, env)) {
    const m = manifestFor(ti.prompt, !!helper, root, config);
    if (m && m.deny) return deny(m.deny);
    if (m && m.note) notes.push(m.note);
  }

  if (notes.length) {
    updated.prompt = `${ti.prompt}\n\n${notes.join('\n\n')}`;
    changed = true;
  }
  return changed ? allow(undefined, { updatedInput: updated }) : undefined;
}

module.exports = { TIER, decideAgentCall };
