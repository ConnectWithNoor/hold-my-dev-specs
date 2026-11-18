'use strict';
// Reads and updates the active feature's ledger header. Format rules: guides/ledger.md.
const fs = require('fs');
const path = require('path');
const { SPECS_DIR } = require('./project');

const APPROVAL = /^(no|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/;
const FEATURE = /^\d{3}-[a-z0-9][a-z0-9-]*$/;

const KEYS = {
  feature: (v) => FEATURE.test(v),
  lane: (v) => ['full', 'quick'].includes(v),
  stage: (v) => ['spec', 'plan', 'tasks', 'build', 'validate', 'review', 'ship', 'done'].includes(v),
  awaiting: (v) => ['none', 'spec', 'plan', 'both'].includes(v),
  spec_approved: (v) => APPROVAL.test(v),
  plan_approved: (v) => APPROVAL.test(v),
  active_task: (v) => v === 'none' || /^T\d{2,}$/.test(v),
};

const HEADER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// → { ok: true, header } or { ok: false, reason }
function parseHeader(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'ledger is not text' };
  const m = text.match(HEADER);
  if (!m) return { ok: false, reason: 'ledger has no header block between --- lines' };
  const header = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+): (.+)$/);
    if (!kv) return { ok: false, reason: `ledger header line is not "key: value": ${JSON.stringify(line)}` };
    const [, key, value] = kv;
    if (!(key in KEYS)) return { ok: false, reason: `unknown ledger key: ${key}` };
    if (key in header) return { ok: false, reason: `ledger key appears twice: ${key}` };
    if (!KEYS[key](value.trim())) return { ok: false, reason: `invalid value for ${key}: ${value}` };
    header[key] = value.trim();
  }
  const missing = Object.keys(KEYS).filter((k) => !(k in header));
  if (missing.length) return { ok: false, reason: `ledger header is missing: ${missing.join(', ')}` };
  return { ok: true, header };
}

const isApproved = (value) => typeof value === 'string' && value !== 'no' && APPROVAL.test(value);
const gateOpen = (header) => isApproved(header.spec_approved) && isApproved(header.plan_approved);
const approvalsChanged = (before, after) =>
  before.spec_approved !== after.spec_approved || before.plan_approved !== after.plan_approved;

// Replaces header values, keeping every other line exactly as it was. Throws on a broken header.
function setHeaderValues(text, changes) {
  const parsed = parseHeader(text);
  if (!parsed.ok) throw new Error(parsed.reason);
  for (const [key, value] of Object.entries(changes)) {
    if (!(key in KEYS) || !KEYS[key](value)) throw new Error(`invalid ledger change: ${key}=${value}`);
  }
  return text.replace(HEADER, (block) =>
    block.replace(/^([a-z_]+): .+$/gm, (line, key) => (key in changes ? `${key}: ${changes[key]}` : line)));
}

// The active feature from specs/ACTIVE.
// → { status: 'none' } · { status: 'ok', feature } · { status: 'broken', reason }
function readActive(root) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, SPECS_DIR, 'ACTIVE'), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { status: 'none' };
    return { status: 'broken', reason: `cannot read specs/ACTIVE: ${err.code || err.message}` };
  }
  const feature = text.trim();
  if (!feature) return { status: 'none' };
  if (!FEATURE.test(feature)) return { status: 'broken', reason: `specs/ACTIVE names an invalid folder: ${feature}` };
  return { status: 'ok', feature };
}

// → { status: 'none' } · { status: 'ok', feature, file, text, header } · { status: 'broken', reason }
function loadActiveLedger(root) {
  const active = readActive(root);
  if (active.status !== 'ok') return active;
  const rel = path.posix.join(SPECS_DIR, active.feature, 'ledger.md');
  const file = path.join(root, rel);
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (err) {
    return { status: 'broken', reason: `cannot read ${rel}: ${err.code || err.message}` };
  }
  const parsed = parseHeader(text);
  if (!parsed.ok) return { status: 'broken', reason: `${rel}: ${parsed.reason}` };
  if (parsed.header.feature !== active.feature) {
    return { status: 'broken', reason: `${rel}: feature is ${parsed.header.feature}, but specs/ACTIVE says ${active.feature}` };
  }
  return { status: 'ok', feature: active.feature, file, rel, text, header: parsed.header };
}

module.exports = { KEYS, parseHeader, isApproved, gateOpen, approvalsChanged, setHeaderValues, readActive, loadActiveLedger };
