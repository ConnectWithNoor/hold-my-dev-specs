'use strict';
// Which hooks run for this project. Table: guides/project-config.md ("Profiles").

const MINIMAL = ['approval-recorder', 'plan-gate', 'verifier-integrity'];
const STANDARD = [...MINIMAL, 'safety', 'context-manifest', 'workflow-state'];
const STRICT = [...STANDARD, 'stop-checks', 'master-config-lock'];
const PROFILE_HOOKS = { minimal: MINIMAL, standard: STANDARD, strict: STRICT };

// Machine-wide switch for machines that run their own safety hooks.
const SAFETY_SWITCH = 'HOLD_MY_DEV_SPECS_SAFETY';

function isHookEnabled(hook, config, env = {}) {
  const inProfile = PROFILE_HOOKS[config.profile];
  if (!inProfile) throw new Error(`unknown profile: ${config.profile}`);
  // The approval recorder follows the plan gate: without it the gate could never open.
  if (hook === 'approval-recorder') return isHookEnabled('plan-gate', config, env);
  if (!inProfile.includes(hook)) return false;
  if ((config.disabledHooks || []).includes(hook)) return false;
  if (hook === 'safety' && env[SAFETY_SWITCH] === 'off') return false;
  return true;
}

module.exports = { PROFILE_HOOKS, SAFETY_SWITCH, isHookEnabled };
