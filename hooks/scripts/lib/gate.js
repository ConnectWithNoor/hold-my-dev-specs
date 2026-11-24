'use strict';
// PreToolUse decisions for file writes: settings protection, verifier integrity, ledger rules,
// approved-document locks, plan gate.
// Rules: guides/artifacts.md ("Who may write what") and guides/ledger.md ("Rules the hooks enforce").
// Returns a deny or ask output, or undefined to let Claude Code's normal permission flow decide.
const fs = require('fs');
const path = require('path');
const { projectRoot, loadConfig, REPAIR_PATHS, SPECS_DIR, CONFIG_REL } = require('./project');
const { loadActiveLedger, parseHeader, approvalsChanged, gateOpen, isApproved } = require('./ledger');
const { isHookEnabled } = require('./profile');
const { whoIsCalling } = require('./agents');
const { matchesAny, realProjectPath } = require('./paths');
const { bashWrites, gitCalls } = require('./bash-writes');
const { deny, ask } = require('./output');

const FILE_TOOLS = { Write: 'file_path', Edit: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };
const LEDGER = /^specs\/([^/]+)\/ledger\.md$/;
const LOCKABLE = /^specs\/([^/]+)\/(spec|rubric|plan)\.md$/;
// Files that change what Claude Code may do: allow rules let a command run without asking, and
// .mcp.json adds tool servers.
const PERMISSION_FILES = ['.claude/settings.json', '.claude/settings.local.json', '.mcp.json'];
// Never written by helpers or other agents, in any profile and whatever paths.protected says: Claude Code
// configuration, instructions every later session reads, and git's own folder (its hooks run on commit).
const GUARDED = ['.claude/**', '.mcp.json', '**/CLAUDE.md', '.git/**'];

// Own report names per helper, inside the active feature's reports/ folder.
const REPORTS = {
  implementer: /^T\d{2,}-impl\.md$/,
  'test-author': /^T\d{2,}-tests\.md$/,
  verifier: /^T\d{2,}-verify-\d+(-[a-z][a-z0-9-]*)?\.md$/, // optional lens: T01-verify-1-security.md
  explorer: /^explore-[a-z0-9][a-z0-9-]*\.md$/,
  shipper: /^ship\.md$/,
};

// Absolute paths the tool call would write. `via` tells whether the content is known (tool) or not (bash);
// `kind` is "mkdir" when a shell command only creates that folder, else "write".
function writeTargets(input) {
  const ti = input.tool_input || {};
  const cwd = input.cwd || process.cwd();
  const field = FILE_TOOLS[input.tool_name];
  if (field) {
    if (typeof ti[field] !== 'string' || !ti[field]) throw new Error(`${input.tool_name} call has no ${field}`);
    return [{ abs: path.resolve(cwd, ti[field]), via: 'tool', kind: 'write' }];
  }
  if (input.tool_name === 'Bash') {
    return resolveOnDisk(bashWrites(ti.command), cwd).map((w) => ({ ...w, via: 'bash' }));
  }
  return [];
}

// Bounds for looking below a folder; past them nobody can tell what a command changes.
const WALK = { maxDepth: 12, maxFiles: 2000, skip: ['node_modules', '.git'] };

// Files below an absolute folder (bounded). Folders in WALK.skip are listed, not entered.
// → { files: [abs], overflow: boolean }
function filesBelow(dir) {
  const files = [];
  const queue = [[dir, 0]];
  while (queue.length) {
    const [d, depth] = queue.shift();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const abs = path.join(d, e.name);
      if (e.isDirectory() && !WALK.skip.includes(e.name)) {
        if (depth + 1 > WALK.maxDepth) return { files, overflow: true };
        queue.push([abs, depth + 1]);
      } else {
        files.push(abs);
        if (files.length > WALK.maxFiles) return { files, overflow: true };
      }
    }
  }
  return { files, overflow: false };
}

const isDir = (abs) => { try { return fs.statSync(abs).isDirectory(); } catch { return false; } };

// Shell targets → absolute targets, resolved against the disk: a path that must exist is dropped when
// it doesn't (a branch name), a folder that is deleted, moved or restored adds every file below it, and
// a copy into a folder adds <folder>/<source name> (and the files of a copied folder). A pattern or a
// folder too big to check becomes { unknown } — which files it touches can't be told.
function resolveOnDisk(writes, cwd) {
  const out = [];
  const addFolder = (srcDir, destDir) => {
    if (WALK.skip.includes(path.basename(srcDir))) return; // listed, not entered
    const below = filesBelow(srcDir);
    if (below.overflow) out.push({ abs: destDir, kind: 'write', unknown: true });
    for (const file of below.files) out.push({ abs: path.join(destDir, path.relative(srcDir, file)), kind: 'write' });
  };
  for (const w of writes) {
    const abs = path.resolve(cwd, w.path);
    if (w.pattern) { out.push({ abs: cwd, kind: 'write', unknown: true }); continue; }
    if (w.ifExists && !fs.existsSync(abs)) continue;
    out.push({ abs, kind: w.kind });
    if (w.walk && isDir(abs)) addFolder(abs, abs);
    for (const s of w.into || []) {
      const src = path.resolve(cwd, s);
      const into = isDir(abs) ? (s.endsWith('/') ? abs : path.join(abs, path.basename(src))) : abs;
      if (into !== abs) out.push({ abs: into, kind: 'write' });
      if (isDir(src)) addFolder(src, into);
    }
  }
  return out;
}

// Only the master commits and changes branches: helpers and other agents may not run git commands
// that replace the working files wholesale. → deny reason or null
function helperGitRule(command, cwd) {
  for (const { sub, args, dir } of gitCalls(command)) {
    const where = path.resolve(cwd, dir);
    const branchSwitch = sub === 'switch' || (sub === 'checkout' && isBranchCheckout(args, where));
    if (sub === 'stash' || (sub === 'reset' && args.includes('--hard')) || ['merge', 'cherry-pick', 'revert'].includes(sub) || branchSwitch) {
      return `Only the master commits and changes branches; helpers and other agents may not run "git ${sub}". Say in your reply what you need.`;
    }
  }
  return null;
}

// "git checkout" that changes the branch: a new branch, "-", or only names that aren't existing paths.
function isBranchCheckout(args, where) {
  if (args.some((a) => ['-b', '-B', '--orphan', '-'].includes(a))) return true;
  const dash = args.indexOf('--');
  const before = (dash === -1 ? args : args.slice(0, dash)).filter((a) => !a.startsWith('-'));
  if (dash !== -1) return false; // "<rev> -- <paths>" restores files
  if (!before.length) return false;
  return before.every((a) => a !== '.' && !/[*?[]/.test(a) && !fs.existsSync(path.resolve(where, a)));
}

// The file's content after an Edit / Write / MultiEdit, or null when it can't be worked out
// (then Claude Code's own tool fails too, so nothing is written).
function contentAfter(input, oldText) {
  const ti = input.tool_input;
  if (input.tool_name === 'Write') return typeof ti.content === 'string' ? ti.content : null;
  const edits = input.tool_name === 'MultiEdit' ? ti.edits : [ti];
  if (!Array.isArray(edits)) return null;
  let text = oldText;
  for (const e of edits) {
    if (!e || typeof e.old_string !== 'string' || typeof e.new_string !== 'string') return null;
    if (text === null) {
      if (e.old_string !== '') return null;
      text = e.new_string;
    } else if (!text.includes(e.old_string) || e.old_string === '') {
      return null;
    } else {
      text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
    }
  }
  return text;
}

// Header of a feature's ledger, or null when it is missing or broken.
function featureHeader(root, feature) {
  try {
    const parsed = parseHeader(fs.readFileSync(path.join(root, SPECS_DIR, feature, 'ledger.md'), 'utf8'));
    return parsed.ok ? parsed.header : null;
  } catch {
    return null;
  }
}

// Ledger edits: approval values only via the approval hook, `done` is final,
// a new or repaired ledger starts unapproved, never via the shell.
function ledgerRule(rel, via, input, root) {
  if (!LEDGER.test(rel)) return null;
  if (via === 'bash' || input.tool_name === 'NotebookEdit') {
    return `${rel} can only be changed with Edit or Write, so the approval values can be checked.`;
  }
  const file = path.join(root, rel);
  const oldText = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const newText = contentAfter(input, oldText);
  if (newText === null) return null;
  const after = parseHeader(newText);
  if (!after.ok) return `This edit would break the ledger header of ${rel}: ${after.reason}. Format: guides/ledger.md.`;
  const before = oldText === null ? { ok: false } : parseHeader(oldText);
  if (before.ok) {
    if (approvalsChanged(before.header, after.header)) {
      return 'Approval values are set only by the user typing "approve spec", "approve plan", "approve both" or "revoke". Leave spec_approved and plan_approved unchanged.';
    }
    if (before.header.stage === 'done' && after.header.stage !== 'done') {
      return `${rel}: a finished feature stays done. Start a new feature for new work.`;
    }
  } else if (after.header.spec_approved !== 'no' || after.header.plan_approved !== 'no') {
    return `A new or repaired ledger must start with spec_approved: no and plan_approved: no (${rel}).`;
  }
  return null;
}

// Approved documents are locked: spec + rubric after the spec approval, plan after the plan approval.
function lockRule(rel, root) {
  const m = rel.match(LOCKABLE);
  if (!m) return null;
  const header = featureHeader(root, m[1]);
  if (!header) return null;
  const approval = m[2] === 'plan' ? header.plan_approved : header.spec_approved;
  if (!isApproved(approval)) return null;
  return `${rel} was approved. Ask the user to type "revoke", make the change, then ask for approval again.`;
}

function integrityRule(rel, kind, caller, config, active, env) {
  const isTest = matchesAny(rel, config.paths.tests);
  const inSpecs = rel === SPECS_DIR || rel.startsWith(`${SPECS_DIR}/`);
  const isProtected = isTest || inSpecs || matchesAny(rel, config.paths.protected);
  const reportsDir = active.status === 'ok' ? `${SPECS_DIR}/${active.feature}/reports/` : null;
  const ownReport = (name) =>
    REPORTS[name] && reportsDir && rel.startsWith(reportsDir) && REPORTS[name].test(rel.slice(reportsDir.length));

  if (caller.kind === 'master') {
    if (isProtected && !inSpecs && isHookEnabled('master-config-lock', config, env)) {
      return `Strict profile: the master may not change protected or test paths (${rel}). Delegate tests to the test author.`;
    }
    return null;
  }
  if (caller.kind === 'other') {
    return isProtected ? `${caller.name} is not part of this plugin's team and may not change protected paths (${rel}).` : null;
  }
  const who = caller.name;
  if (ownReport(who)) return null;
  // Creating the active feature's reports/ folder (mkdir -p) is fine for every helper.
  if (kind === 'mkdir' && reportsDir && rel === reportsDir.slice(0, -1)) return null;
  switch (who) {
    case 'implementer':
      return isProtected ? `The implementer may not change protected paths (${rel}): tests, quality configs, specs, CI and guardrails stay as they are. Report a disagreement instead.` : null;
    case 'test-author':
      return isTest && !inSpecs ? null : `The test author may write only test paths and its own report (${rel}).`;
    case 'spec-miner':
      return rel === `${SPECS_DIR}/baseline` || rel.startsWith(`${SPECS_DIR}/baseline/`) ? null : `The spec-miner may write only specs/baseline/ (${rel}).`;
    default: // verifier, explorer, shipper
      return `The ${who} may write only its own report in the active feature's reports/ folder (${rel}).`;
  }
}

function gateRule(rel, config, active) {
  if (matchesAny(rel, config.paths.open) || matchesAny(rel, REPAIR_PATHS)) return null;
  if (active.status === 'none') {
    return `Plan gate: no active feature, so ${rel} can't be changed yet. Start a feature and get the spec and plan approved first.`;
  }
  if (active.status === 'broken') return `Plan gate: the ledger has a problem (${active.reason}). Repair it first.`;
  if (active.header.stage === 'done') {
    return `Plan gate: the active feature ${active.feature} is done, so its old approvals don't open the gate. Start a new feature.`;
  }
  if (!gateOpen(active.header)) {
    const s = active.header.spec_approved === 'no' ? 'not approved' : 'approved';
    const p = active.header.plan_approved === 'no' ? 'not approved' : 'approved';
    return `Plan gate is closed for ${rel} (spec ${s}, plan ${p}). Ask the user to review and type "approve spec" / "approve plan".`;
  }
  return null;
}

// → { deny: reason } · { ask: reason } · null
function checkTarget(rel, via, kind, input, root, cfg, caller, active, env) {
  // The settings file switches the protections on and off: helpers never touch it, the master asks the user.
  if (rel === CONFIG_REL) {
    return caller.kind === 'master'
      ? { ask: 'hold-my-dev-specs: this changes the project settings that control the plugin\'s protections. Allow only if you asked for this change.' }
      : { deny: `Only the master may change ${CONFIG_REL}, and only with the user's permission.` };
  }
  // Setup writes allow rules there (also when re-run). Claude Code always asks for .claude/ files; for
  // .mcp.json it may not, so the hook asks the user itself.
  if (caller.kind !== 'master' && !PERMISSION_FILES.includes(rel) && matchesAny(rel, GUARDED)) {
    return { deny: `Only the master may change ${rel}: Claude Code configuration, CLAUDE.md and .git/ are guarded for every helper and agent.` };
  }
  if (PERMISSION_FILES.includes(rel)) {
    if (caller.kind !== 'master') return { deny: `Only the master may change ${rel}, and only with the user's permission.` };
    return rel === '.mcp.json'
      ? { ask: 'hold-my-dev-specs: this changes .mcp.json, the tool servers Claude may use. Allow only if you asked for this change.' }
      : null;
  }
  if (cfg.status !== 'ok') {
    if (caller.kind !== 'master') return { deny: `Project settings are ${cfg.status}; only the master may repair them.` };
    if (!matchesAny(rel, REPAIR_PATHS)) {
      return { deny: `Project settings are ${cfg.status} (${cfg.problems.join('; ')}), so ${rel} can't be changed. Finish setup or repair ${CONFIG_REL} first.` };
    }
    const r = ledgerRule(rel, via, input, root) || lockRule(rel, root);
    return r ? { deny: r } : null;
  }
  const config = cfg.config;
  const on = (hook) => isHookEnabled(hook, config, env);
  const r = (on('verifier-integrity') && integrityRule(rel, kind, caller, config, active, env))
    || (on('plan-gate') && (ledgerRule(rel, via, input, root) || lockRule(rel, root) || gateRule(rel, config, active)))
    || null;
  return r ? { deny: r } : null;
}

function decideToolCall(input, env) {
  const root = projectRoot(input, env);
  const cfg = loadConfig(root);
  if (cfg.status === 'absent') return undefined;
  const caller = whoIsCalling(input);
  const helper = caller.kind !== 'master';
  // Before the write targets: "git stash" or "git merge" name no file but replace many.
  if (helper && input.tool_name === 'Bash' && (cfg.status !== 'ok' || isHookEnabled('verifier-integrity', cfg.config, env))) {
    const git = helperGitRule(String((input.tool_input || {}).command || ''), input.cwd || root);
    if (git) return deny(`hold-my-dev-specs: ${git}`);
  }
  const targets = writeTargets(input);
  if (!targets.length) return undefined;
  const active = loadActiveLedger(root);

  let askReason = null;
  for (const { abs, via, kind, unknown } of targets) {
    if (unknown) {
      if (helper) return deny(`hold-my-dev-specs: this command may change files that can't be checked (a pattern, or too many files below ${path.relative(root, abs) || '.'}). Name the files instead.`);
      continue;
    }
    const rel = realProjectPath(root, abs);
    if (rel === null) continue; // outside the project: personal safety hooks decide
    const result = checkTarget(rel, via, kind, input, root, cfg, caller, active, env);
    if (result && result.deny) return deny(`hold-my-dev-specs: ${result.deny}`);
    if (result && result.ask) askReason = result.ask;
  }
  return askReason ? ask(askReason) : undefined; // any deny wins over ask
}

module.exports = { REPORTS, writeTargets, contentAfter, decideToolCall };
