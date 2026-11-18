'use strict';
// Stop (strict profile): runs the project's format / lint / typecheck commands after a reply.
// Only while building (gate open, stage build or validate) and only when **source** files changed
// since the last run — specs, docs, open paths, tests, protected paths and the settings file don't count
// and are never passed in {files}, so a formatter can't touch locked or protected files that way.
// On failure Claude gets one more turn to fix it (decision: block); if it still fails, the user sees
// one ⚠ line and Claude stops.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { projectRoot, loadConfig, REPAIR_PATHS } = require('./project');
const { loadActiveLedger, gateOpen } = require('./ledger');
const { isHookEnabled } = require('./profile');
const { matchesAny } = require('./paths');

const CHECKS = ['format', 'lint', 'typecheck'];
const BUILD_STAGES = ['build', 'validate'];
const COMMAND_TIMEOUT_MS = 120000;
const TAIL_LINES = 30;

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

// Source files = everything the checks may look at: not open paths, specs, settings, tests or protected.
function sourceFilter(config) {
  const excluded = [...REPAIR_PATHS, ...config.paths.open, ...config.paths.tests, ...config.paths.protected];
  return (rel) => !matchesAny(rel, excluded);
}

// Changed source files (not deleted) and a fingerprint of all changed source files (deleted included);
// null when not a git repo.
function workingTree(root, isSource) {
  // -z: names exactly as they are (no quoting of spaces); a rename is followed by its old name.
  const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (status === null) return null;
  const changed = [];
  const fields = status.split('\0').filter(Boolean);
  for (let i = 0; i < fields.length; i++) {
    const code = fields[i].slice(0, 2);
    const name = fields[i].slice(3);
    if (code[0] === 'R' || code[0] === 'C') {
      const old = fields[++i];
      if (old && isSource(old)) changed.push({ name: old, deleted: true }); // moved away = gone from here
    }
    if (isSource(name)) changed.push({ name, deleted: code.includes('D') });
  }
  const hash = crypto.createHash('sha256');
  for (const { name, deleted } of changed.sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update(`${name}\0`);
    if (deleted) { hash.update('deleted\0'); continue; }
    try { hash.update(fs.readFileSync(path.join(root, name))); } catch { hash.update('unreadable\0'); }
  }
  return { changed, files: changed.filter((c) => !c.deleted).map((c) => c.name), fingerprint: hash.digest('hex') };
}

function stateFile(root, env) {
  const dir = path.join(env.CLAUDE_PLUGIN_DATA || os.tmpdir(), 'stop-checks');
  const key = crypto.createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 16);
  return { dir, file: path.join(dir, `${key}.json`) };
}

function lastFingerprint(root, env) {
  try { return JSON.parse(fs.readFileSync(stateFile(root, env).file, 'utf8')).fingerprint; } catch { return null; }
}

function saveFingerprint(root, env, fingerprint) {
  const { dir, file } = stateFile(root, env);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ fingerprint }));
}

const quote = (f) => `'${f.replace(/'/g, "'\\''")}'`;

function defaultRun(command, root) {
  const r = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', timeout: COMMAND_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.error && r.error.code === 'ETIMEDOUT') return { code: null, out: `${out}\n(timed out after ${COMMAND_TIMEOUT_MS / 1000}s)` };
  return { code: r.status, out };
}

function handleStop(input, env, run = defaultRun) {
  const root = projectRoot(input, env);
  const cfg = loadConfig(root);
  if (cfg.status !== 'ok' || !isHookEnabled('stop-checks', cfg.config, env)) return undefined;
  const config = cfg.config;
  const commands = CHECKS.map((name) => [name, config.commands[name]]).filter(([, c]) => c);
  if (!commands.length) return undefined;

  // Only while building: before approval Claude may not fix source code anyway.
  const ledger = loadActiveLedger(root);
  if (ledger.status !== 'ok' || !gateOpen(ledger.header) || !BUILD_STAGES.includes(ledger.header.stage)) return undefined;

  const isSource = sourceFilter(config);
  const tree = workingTree(root, isSource);
  if (tree) {
    if (!tree.changed.length) return undefined; // no source file changed at all
    if (tree.fingerprint === lastFingerprint(root, env)) return undefined; // nothing new since the last run
  }

  const failures = [];
  for (const [name, command] of commands) {
    let cmd = command;
    if (cmd.includes('{files}')) {
      const files = tree ? tree.files : [];
      if (!files.length) continue;
      cmd = cmd.split('{files}').join(files.map(quote).join(' '));
    }
    const r = run(cmd, root);
    if (r.code !== 0) {
      const tail = r.out.trim().split('\n').slice(-TAIL_LINES).join('\n');
      failures.push({ name, command, code: r.code, tail });
    }
  }

  // Remember the tree after the commands ran (a formatter may have changed files itself).
  const after = workingTree(root, isSource);
  if (after) saveFingerprint(root, env, after.fingerprint);

  if (!failures.length) return undefined;
  if (input.stop_hook_active) {
    const names = failures.map((f) => f.name).join(', ');
    return { systemMessage: `⚠ hold-my-dev-specs: ${names} still failing after one fix attempt — check before continuing.` };
  }
  const report = failures.map((f) => `${f.name}: \`${f.command}\` failed (exit ${f.code === null ? 'timeout' : f.code})\n${f.tail}`).join('\n\n');
  return {
    decision: 'block',
    reason: `hold-my-dev-specs (strict): the project's checks failed after your changes. Fix these, then finish.\n\n${report}`,
  };
}

module.exports = { workingTree, handleStop };
