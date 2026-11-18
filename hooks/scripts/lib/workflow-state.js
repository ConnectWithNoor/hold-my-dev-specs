'use strict';
// UserPromptSubmit: a 2–3 line status note for Claude (not shown to the user), from the active ledger.
// Skipped when the message contains the project's skip keyword (default #nostate).
const { projectRoot, loadConfig } = require('./project');
const { loadActiveLedger, isApproved } = require('./ledger');
const { isHookEnabled } = require('./profile');

const NEXT = {
  spec: 'write spec.md + rubric.md with the user; when open questions are empty, set awaiting: spec and ask for review',
  plan: 'write plan.md; then set awaiting: plan and ask the user for review',
  tasks: 'write tasks.md and one context manifest per task; then start building',
  build: 'dispatch and monitor the next task; verify each one',
  validate: 'run the final check against the rubric; write reports/final-check.md',
  review: 'ask the user to check the result (manual review)',
  ship: 'ship and monitor as the project settings say',
  done: 'this feature is finished; new work needs a new feature',
};

const wrap = (lines) => `<workflow-state>\n${lines.join('\n')}\n</workflow-state>`;

function taskRow(text, task) {
  const m = text.match(new RegExp(`^\\|\\s*${task}\\s*\\|\\s*([a-z-]+)\\s*\\|\\s*(\\d*)\\s*\\|`, 'm'));
  return m ? { status: m[1], round: m[2] } : null;
}

function nextStep(h) {
  if (h.awaiting !== 'none') return `waiting for the user to type "approve ${h.awaiting}" — don't build until then`;
  const gateNeeded = ['build', 'validate', 'review', 'ship'].includes(h.stage);
  if (gateNeeded && !(isApproved(h.spec_approved) && isApproved(h.plan_approved))) {
    return 'approvals are missing (revoked?): stop dispatching, report finished tasks, go back to spec review';
  }
  return NEXT[h.stage];
}

function stateNote(input, env) {
  const root = projectRoot(input, env);
  const cfg = loadConfig(root);
  if (cfg.status === 'absent') return undefined;
  if (cfg.status !== 'ok') return wrap([`hold-my-dev-specs: project settings are ${cfg.status} — finish setup first.`]);
  if (!isHookEnabled('workflow-state', cfg.config, env)) return undefined;
  if (typeof input.prompt === 'string' && input.prompt.includes(cfg.config.workflowState.skipKeyword)) return undefined;

  const ledger = loadActiveLedger(root);
  if (ledger.status === 'none') return wrap(['hold-my-dev-specs: no active feature.']);
  if (ledger.status === 'broken') return wrap([`hold-my-dev-specs: ${ledger.reason} — repair the ledger first.`]);

  const h = ledger.header;
  const mark = (v) => (isApproved(v) ? '✓' : '✗');
  const lines = [`feature ${h.feature} (${h.lane} lane) · stage ${h.stage} · spec ${mark(h.spec_approved)} plan ${mark(h.plan_approved)}`];
  if (h.active_task !== 'none') {
    const row = taskRow(ledger.text, h.active_task);
    lines.push(`task ${h.active_task}${row ? ` · ${row.status}${row.round ? ` · round ${row.round}` : ''}` : ''}`);
  }
  lines.push(`next: ${nextStep(h)}`);
  return wrap(lines);
}

module.exports = { stateNote };
