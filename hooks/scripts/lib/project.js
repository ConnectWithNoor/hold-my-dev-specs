'use strict';
// Finds the project and loads its settings file (.claude/hold-my-dev-specs.json).
// Field rules: guides/project-config.md.
const fs = require('fs');
const path = require('path');

const CONFIG_REL = '.claude/hold-my-dev-specs.json';
const SPECS_DIR = 'specs';

const PROFILES = ['minimal', 'standard', 'strict'];
const DISABLEABLE = ['plan-gate', 'verifier-integrity', 'safety', 'context-manifest', 'workflow-state', 'stop-checks'];
const SIGNALS = ['browser', 'screenshot', 'logs', 'code-only'];
const LENSES = ['silent-failure', 'security'];

const isString = (v) => typeof v === 'string' && v.length > 0;
const isStringArray = (v) => Array.isArray(v) && v.every(isString);
const subsetOf = (allowed) => (v) => Array.isArray(v) && v.every((x) => allowed.includes(x));
const oneOf = (allowed) => (v) => allowed.includes(v);
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

// [field path, check, may stay null by design]
const FIELDS = [
  ['profile', oneOf(PROFILES), false],
  ['disabledHooks', subsetOf(DISABLEABLE), false],
  ['models.strongest', isString, false],
  ['models.mid', isString, false],
  ['paths.open', isStringArray, false],
  ['paths.protected', isStringArray, false],
  ['commands.test', isString, true],
  ['commands.lint', isString, true],
  ['commands.format', isString, true],
  ['commands.typecheck', isString, true],
  ['verification.signals', subsetOf(SIGNALS), false],
  ['verification.tools', isStringArray, true],
  ['verification.passThreshold', (v) => typeof v === 'number' && v >= 1 && v <= 10, false],
  ['verification.lenses', subsetOf(LENSES), false],
  ['verification.highRiskAreas', isStringArray, true],
  ['fixLoop.maxRounds', isPositiveInt, false],
  ['contextManifest.maxFileBytes', isPositiveInt, false],
  ['contextManifest.maxTotalBytes', isPositiveInt, false],
  ['workflowState.skipKeyword', isString, false],
  ['ship.manualReview', oneOf(['local', 'staging']), false],
  ['ship.deploy', isString, true],
  ['ship.monitor', isString, true],
  ['git.mainBranch', isString, false],
  ['git.merge', oneOf(['local', 'pr']), false],
];

function get(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

function projectRoot(input, env) {
  const root = (env && env.CLAUDE_PROJECT_DIR) || (input && input.cwd);
  if (!isString(root)) throw new Error('cannot tell the project folder (no CLAUDE_PROJECT_DIR or cwd)');
  return root;
}

// Checks a parsed settings object. Returns { status: 'ok' | 'unfinished' | 'broken', problems }.
function checkConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { status: 'broken', problems: ['settings are not a JSON object'] };
  }
  if (config.schemaVersion !== 1) return { status: 'broken', problems: ['schemaVersion must be 1'] };
  const missing = [];
  const wrong = [];
  for (const [field, check, nullable] of FIELDS) {
    const value = get(config, field);
    if (value === null || value === undefined) {
      if (!nullable) missing.push(field);
    } else if (!check(value)) {
      wrong.push(field);
    }
  }
  if (wrong.length) return { status: 'broken', problems: wrong.map((f) => `${f} has an invalid value`) };
  if (missing.length) return { status: 'unfinished', problems: missing.map((f) => `${f} is not set yet`) };
  return { status: 'ok', problems: [] };
}

// { status: 'absent' } — plugin is off for this project.
// { status: 'ok', config } · { status: 'unfinished' | 'broken', problems }
function loadConfig(root) {
  const file = path.join(root, CONFIG_REL);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { status: 'absent' };
    return { status: 'broken', problems: [`cannot read ${CONFIG_REL}: ${err.code || err.message}`] };
  }
  let config;
  try { config = JSON.parse(text); } catch { return { status: 'broken', problems: [`${CONFIG_REL} is not valid JSON`] }; }
  const result = checkConfig(config);
  return result.status === 'ok' ? { status: 'ok', config } : result;
}

// Paths that stay editable even when the settings or the ledger are broken or unfinished,
// so the user can always repair them. (Hooks still apply their other rules, e.g. approval values.)
const REPAIR_PATHS = [`${SPECS_DIR}/**`, CONFIG_REL];

module.exports = { CONFIG_REL, SPECS_DIR, REPAIR_PATHS, PROFILES, DISABLEABLE, FIELDS, projectRoot, checkConfig, loadConfig };
