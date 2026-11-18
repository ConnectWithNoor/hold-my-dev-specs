'use strict';
// Shared test fixtures: a temporary project folder with valid settings and ledger.
const fs = require('fs');
const os = require('os');
const path = require('path');

function validConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    profile: 'standard',
    disabledHooks: [],
    models: { strongest: 'opus', mid: 'sonnet' },
    paths: { open: ['specs/**', 'docs/**'], protected: ['.eslintrc.json', '.github/**'], tests: ['tests/**', '**/*.test.js'] },
    commands: { test: 'npm test', lint: null, format: null, typecheck: null },
    verification: { signals: ['code-only'], tools: null, passThreshold: 7, lenses: [], highRiskAreas: null },
    fixLoop: { maxRounds: 3 },
    contextManifest: { maxFileBytes: 32768, maxTotalBytes: 131072 },
    workflowState: { skipKeyword: '#nostate' },
    ship: { manualReview: 'local', deploy: null, monitor: null },
    git: { mainBranch: 'main', merge: 'local' },
    ...overrides,
  };
}

function ledgerText(values = {}) {
  const h = {
    feature: '001-login', lane: 'full', stage: 'spec', awaiting: 'none',
    spec_approved: 'no', plan_approved: 'no', active_task: 'none', ...values,
  };
  const header = Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${header}\n---\n# Ledger — ${h.feature}\n\n## Tasks\n\n## Log\n- 2026-11-18T19:00:00Z — created\n`;
}

// Creates a temp project. Pass config: null to leave the settings file out.
function makeProject({ config = validConfig(), active = '001-login', ledger = ledgerText() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hmds-test-'));
  if (config !== null) {
    fs.mkdirSync(path.join(root, '.claude'));
    const text = typeof config === 'string' ? config : JSON.stringify(config, null, 2);
    fs.writeFileSync(path.join(root, '.claude', 'hold-my-dev-specs.json'), text);
  }
  if (active !== null) {
    fs.mkdirSync(path.join(root, 'specs', active), { recursive: true });
    fs.writeFileSync(path.join(root, 'specs', 'ACTIVE'), `${active}\n`);
    if (ledger !== null) fs.writeFileSync(path.join(root, 'specs', active, 'ledger.md'), ledger);
  }
  return root;
}

module.exports = { validConfig, ledgerText, makeProject };
