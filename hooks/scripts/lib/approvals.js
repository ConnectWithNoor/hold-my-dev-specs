'use strict';
// UserPromptSubmit: records the user's approvals in the active ledger. Rules: guides/ledger.md.
// This hook also fires for helper reports, /loop, other sessions — the exact-phrase + awaiting rules
// and the visible confirmation are what make it safe.
const fs = require('fs');
const path = require('path');
const { projectRoot, loadConfig } = require('./project');
const { loadActiveLedger, setHeaderValues, isApproved } = require('./ledger');
const { isHookEnabled } = require('./profile');

const PHRASES = { 'approve spec': 'spec', 'approve plan': 'plan', 'approve both': 'both', revoke: 'revoke' };

const utcStamp = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const localTime = (d) => d.toTimeString().slice(0, 5);
const notice = (text) => ({ systemMessage: text });

function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// A short message that starts with "approve" but isn't an exact phrase ("approve spec.", "Approve the
// plan") records nothing; the user gets a hint with the exact phrase instead of silence.
function nearMiss(text, input, env) {
  if (!text.startsWith('approve') || text.length >= 30) return undefined;
  const root = projectRoot(input, env);
  const cfg = loadConfig(root);
  if (cfg.status !== 'ok' || !isHookEnabled('approval-recorder', cfg.config, env)) return undefined;
  const ledger = loadActiveLedger(root);
  const awaiting = ledger.status === 'ok' && ledger.header.awaiting !== 'none' ? ledger.header.awaiting : null;
  const exact = awaiting ? `"approve ${awaiting}"` : '"approve spec", "approve plan" or "approve both"';
  return notice(`ℹ hold-my-dev-specs: not recorded — an approval must be exactly ${exact}, nothing else in the message.`);
}

function handlePrompt(input, env, now = new Date()) {
  const said = typeof input.prompt === 'string' ? input.prompt.trim().toLowerCase() : '';
  const phrase = PHRASES[said];
  if (!phrase) return nearMiss(said, input, env);
  const root = projectRoot(input, env);
  const cfg = loadConfig(root);
  if (cfg.status === 'absent') return undefined;
  if (cfg.status !== 'ok') return notice(`⚠ hold-my-dev-specs: project settings are ${cfg.status} — nothing recorded. Finish setup first.`);
  if (!isHookEnabled('approval-recorder', cfg.config, env)) return undefined;

  const ledger = loadActiveLedger(root);
  if (ledger.status === 'none') return notice('ℹ hold-my-dev-specs: no active feature — nothing recorded.');
  if (ledger.status === 'broken') return notice(`⚠ hold-my-dev-specs: ${ledger.reason} — nothing recorded.`);
  const h = ledger.header;
  const stamp = utcStamp(now);

  let changes;
  let done;
  if (phrase === 'revoke') {
    changes = { spec_approved: 'no', plan_approved: 'no', awaiting: 'none' };
    done = 'Approvals revoked — the plan gate is closed';
  } else if (h.awaiting !== phrase) {
    const waiting = h.awaiting === 'none' ? 'is not waiting for an approval' : `is waiting for "approve ${h.awaiting}"`;
    return notice(`ℹ hold-my-dev-specs: not recorded — the ledger ${waiting}.`);
  } else if (phrase === 'plan' && !isApproved(h.spec_approved)) {
    return notice('ℹ hold-my-dev-specs: not recorded — the spec must be approved first.');
  } else if (phrase === 'spec') {
    changes = { spec_approved: stamp, awaiting: 'none' };
    done = 'Spec approved';
  } else if (phrase === 'plan') {
    changes = { plan_approved: stamp, awaiting: 'none' };
    done = 'Plan approved';
  } else {
    changes = { spec_approved: stamp, plan_approved: stamp, awaiting: 'none' };
    done = 'Spec and plan approved';
  }

  let text = setHeaderValues(ledger.text, changes);
  if (!text.endsWith('\n')) text += '\n';
  text += `- ${stamp} — ${done.toLowerCase()} (approval phrase received)\n`;
  writeAtomic(ledger.file, text);

  const icon = phrase === 'revoke' ? '↩' : '✅';
  return {
    systemMessage: `${icon} ${done} ${localTime(now)}`,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `hold-my-dev-specs: recorded "${input.prompt.trim().toLowerCase()}" in ${ledger.rel} at ${stamp}.`,
    },
  };
}

module.exports = { PHRASES, handlePrompt };
