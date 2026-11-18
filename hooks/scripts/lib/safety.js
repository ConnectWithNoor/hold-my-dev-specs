'use strict';
// Safety copy (profile standard / strict): the Never do / Ask first rules, for users without their own
// safety hooks. Never do → deny. Ask first → ask, with a note on what the user should have been told.
// Same rules, patterns and wording as the author's personal safety hook, so the two don't drift
// (test cases: tests/lib/safety.test.js). Off when HOLD_MY_DEV_SPECS_SAFETY=off, in the minimal profile,
// or when "safety" is in disabledHooks; inert in projects without the settings file.
// Secret reads (Read / Grep) are checked in the fail-open Read entry (read-call.js), the rest in the
// blocking tool-call entry (tool-call.js).
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { projectRoot, loadConfig } = require('./project');
const { isHookEnabled, SAFETY_SWITCH } = require('./profile');

const HOME = os.homedir();
const ASK_NOTE = 'Before approving, Claude should have told you: what exactly changes or gets deleted, how to undo it, and which instruction of yours led here.';

// ---------- Paths and secrets ----------

function expandHome(p) {
  if (p === '~') return HOME;
  if (p.startsWith('~/')) return path.join(HOME, p.slice(2));
  return p.replace(/^\$HOME(?=\/|$)/, HOME).replace(/^\$\{HOME\}(?=\/|$)/, HOME);
}

const resolveFrom = (cwd, p) => path.resolve(cwd || process.cwd(), expandHome(p));

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Secret files: .env (not templates), private keys, credential stores.
const SECRET_PATH_RES = [
  /(^|\/)\.env(\.(?!example$|sample$|template$|dist$)[^/\s]+)?$/i,
  /(^|\/)\.envrc$/i,
  /\.(pem|key|p12|pfx|keystore|jks)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
  /(^|\/)\.ssh\//,
  /(^|\/)\.aws\//,
  /(^|\/)\.gnupg\//,
  /(^|\/)\.claude\/\.credentials\.json$/,
  /(^|\/)\.git-credentials$/,
  /(^|\/)\.netrc$/,
  /(^|\/)\.config\/gh\/hosts\.yml$/,
  /(^|\/)\.docker\/config\.json$/,
  /(^|\/)credentials\.json$/i,
];

function isSecretPath(p) {
  if (!p) return false;
  const full = expandHome(p);
  return SECRET_PATH_RES.some((re) => re.test(full));
}

// Same idea for paths mentioned inside a shell command (tokens, not whole strings).
const SECRET_TOKEN_RES = [
  // bare or path-like: .env, ./.env, $DIR/.env, <.env
  /(^|[\s=\/(<>])\.env(\.(?!example\b|sample\b|template\b|dist\b)[A-Za-z0-9_-]+)?(?=$|[\s'";|&)<>])/,
  // quoted on its own: '.env', ".env.local" (not text inside a longer quote such as jq '.env // x')
  /(['"])\.env(\.(?!example\b|sample\b|template\b|dist\b)[A-Za-z0-9_-]+)?\1/,
  // direnv files: .envrc (bare, path-like or quoted)
  /(^|[\s=\/(<>'"])\.envrc(?=$|[\s'";|&)<>])/,
  /\b[\w.\/-]+\.(pem|key|p12|pfx|keystore|jks)\b/,
  /\bid_(rsa|dsa|ecdsa|ed25519)\b(?!\.pub)/,
  /(~|\$HOME|\/home\/[^\/\s]+)\/\.(ssh|aws|gnupg)\b/,
  /\.claude\/\.credentials\.json/,
  /\.git-credentials\b/,
  /(~|\$HOME|\/home\/[^\/\s]+)\/\.netrc\b/,
  /\.config\/gh\/hosts\.yml/,
  /\.docker\/config\.json/,
];

function mentionsSecretPath(cmd) {
  // Empty quote pairs vanish in the shell (.e""nv runs as .env), so drop them before checking.
  const normalized = cmd.replace(/""|''/g, '');
  return SECRET_TOKEN_RES.some((re) => re.test(normalized));
}

// High-confidence secret value patterns (low false-positive rate).
const SECRET_VALUE_RES = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI API key', /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe live key', /\b[sr]k_live_[0-9A-Za-z]{20,}/],
];

function findSecretValues(text) {
  const found = [];
  for (const [name, re] of SECRET_VALUE_RES) if (re.test(text)) found.push(name);
  return found;
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
  } catch {
    return '';
  }
}

// ---------- Bash: Never do ----------

function checkRemotePipe(cmd) {
  const pipeToShell = /\b(curl|wget)\b[^;&\n]*\|\s*(sudo\s+)?(\S+=\S+\s+)*(env\s+)?((ba|z|da|k|fi)?sh|python[\d.]*|perl|ruby|node)\b/;
  const procSubst = /\b((ba|z)?sh|source|\.)\s+<\(\s*(curl|wget)\b/;
  const cmdSubst = /\b(ba|z)?sh\s+-c\s+["']?\$\(\s*(curl|wget)\b/;
  if (pipeToShell.test(cmd) || procSubst.test(cmd) || cmdSubst.test(cmd)) {
    return 'Never do: running a script straight from the internet (download piped into a shell). Download it, show it to the user, then run it only with approval.';
  }
  return null;
}

function checkDiskWipe(cmd) {
  if (/\b(mkfs(\.\w+)?|wipefs|fdisk|sfdisk|parted|sgdisk)\b/.test(cmd)
    || /\bdd\b[^;&|\n]*\bof=\/dev\//.test(cmd)
    || /\bshred\b[^;&|\n]*\/dev\//.test(cmd)
    || />\s*\/dev\/(sd|nvme|vd|hd|mmcblk)/.test(cmd)) {
    return 'Never do: disk or partition tools can wipe drives.';
  }
  return null;
}

const stripQuotes = (t) => t.replace(/^['"]|['"]$/g, '');

// Finds every rm invocation (also inside sh -c, sudo, subshells, xargs) and classifies it.
function checkRm(cmd, cwd) {
  const re = /(?:^|[\s;&|(`'"]|\$\()rm\s+([^;&|)`\n]*)/g;
  let m;
  let sawRm = false;
  while ((m = re.exec(cmd)) !== null) {
    sawRm = true;
    const tokens = m[1].trim().split(/\s+/).map(stripQuotes).filter(Boolean);
    const flags = tokens.filter((t) => t.startsWith('-'));
    const targets = tokens.filter((t) => !t.startsWith('-'));
    const recursive = flags.some((f) => f === '--recursive' || /^-[a-zA-Z]*[rR]/.test(f));
    if (flags.includes('--no-preserve-root')) return { deny: 'Never do: rm with --no-preserve-root.' };
    if (!recursive) continue;
    for (const t of targets) {
      if (/^\$(?!HOME\b|\{HOME\})/.test(t)) continue; // unknown variable -> falls to Ask first
      const resolved = resolveFrom(cwd, t.replace(/\/\*$/, ''));
      if (resolved === '/' || resolved === HOME || !isInside(resolved, cwd)) {
        return { deny: `Never do: recursive delete outside the project (${t}).` };
      }
    }
  }
  return sawRm ? { ask: 'Ask first: deleting files.' } : null;
}

function checkPush(cmd, cwd) {
  const segs = cmd.split(/&&|\|\||;|\n|\|/).filter((s) => /\bgit\b.*\bpush\b/.test(s));
  if (!segs.length) return null;
  for (const s of segs) {
    const force = /\s(--force(-with-lease)?(=\S+)?|-[a-zA-Z]*f[a-zA-Z]*|--mirror)(\s|$)/.test(s) || /\s\+\S+/.test(s);
    const deletesMain = /\s(--delete|-d)\b[^\n]*\b(main|master)\b/.test(s) || /\s:(main|master)\b/.test(s);
    const namesMain = /\b(main|master)\b/.test(s);
    const afterPush = s.split(/\bpush\b/)[1] || '';
    const hasRefspec = afterPush.trim().split(/\s+/).filter((t) => t && !t.startsWith('-')).length >= 2;
    const onMain = !hasRefspec && /^(main|master)$/.test(git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).trim());
    if (deletesMain || (force && (namesMain || onMain))) {
      return { deny: 'Never do: force-push to, or delete, main/master (rewrites shared history).' };
    }
  }
  return { ask: 'Ask first: pushing to a remote (leaves this machine).' };
}

function checkCommitSecrets(cmd, cwd) {
  if (!/\bgit\b[^;&|\n]*\bcommit\b/.test(cmd)) return null;
  const all = /\bcommit\b[^;&|\n]*\s(-a|--all|-[a-zA-Z]*a[a-zA-Z]*)(\s|$)/.test(cmd);
  const addsToo = /\bgit\b[^;&|\n]*\badd\b/.test(cmd);
  const names = git(['diff', '--cached', '--name-only'], cwd).split('\n');
  let diff = git(['diff', '--cached', '-U0'], cwd);
  if (all || addsToo) {
    names.push(...git(['diff', '--name-only'], cwd).split('\n'));
    diff += git(['diff', '-U0'], cwd);
  }
  if (addsToo) {
    for (const f of git(['ls-files', '--others', '--exclude-standard'], cwd).split('\n').filter(Boolean)) {
      names.push(f);
      try {
        const full = path.join(cwd, f);
        if (fs.statSync(full).size < 200000) diff += `\n+${fs.readFileSync(full, 'utf8')}`;
      } catch { /* unreadable -> skip */ }
    }
  }
  const badFiles = names.filter((n) => n && isSecretPath(n));
  const added = diff.split('\n').filter((l) => l.startsWith('+')).join('\n');
  const kinds = findSecretValues(added);
  if (badFiles.length || kinds.length) {
    const what = [...badFiles.map((f) => `file ${f}`), ...kinds].join(', ');
    return { deny: `Never do: this commit would include secrets (${what}). Remove them, or add the file to .gitignore.` };
  }
  return null;
}

// ---------- Bash: Ask first ----------

const ASK_RULES = [
  [/\bgh\s+(pr\s+(create|merge|close|comment|review)|release\s+create|repo\s+(create|delete|edit)|issue\s+(create|comment|close)|gist\s+create|api\b)/, 'Ask first: GitHub action that changes something online.'],
  [/\b(npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b|\bgem\s+push\b|\bdocker\s+push\b/, 'Ask first: publishing a package or image.'],
  [/\b(vercel|netlify\s+deploy|fly\s+deploy|flyctl\s+deploy|railway\s+up|heroku\b|kubectl\s+(apply|delete|create|replace|rollout)|terraform\s+(apply|destroy)|pulumi\s+(up|destroy)|serverless\s+deploy|firebase\s+deploy|wrangler\s+(deploy|publish))\b/, 'Ask first: deploying or changing live infrastructure.'],
  [/\b(scp|sftp)\b|\brsync\b[^;&|\n]*\s\S+:/, 'Ask first: copying files to another machine.'],
  [/\bcurl\b[^;&|\n]*\s(-X\s*(POST|PUT|PATCH|DELETE)|--data\b|-d\s|--data-\w+|-F\s|--form\b|-T\s|--upload-file\b)/i, 'Ask first: sending data to an online service.'],
  [/\b(sendmail|mailx?|mutt)\b/, 'Ask first: sending email.'],
  [/\bgit\s+(reset\s+--hard|clean\s+-[a-zA-Z]*f|checkout\s+--\s|restore\s+(?!--staged)|stash\s+(drop|clear)|branch\s+-[dD]\b|filter-branch|filter-repo)/, 'Ask first: git action that can lose work or rewrite history.'],
  [/\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE?|DELETE\s+FROM)\b/i, 'Ask first: deleting database data.'],
  [/\b(prisma\s+migrate|alembic\s+(upgrade|downgrade)|db:migrate|manage\.py\s+migrate|knex\s+migrate|sequelize\s+db:migrate|flyway\s+migrate|dbmate\s+(up|down|migrate))\b/, 'Ask first: database migration.'],
  [/\bfind\b[^;&|\n]*\s(-delete|-exec\s+rm)\b/, 'Ask first: deleting files.'],
  [/(^|[\s;&|(])sudo\s/, 'Ask first: running with administrator rights (sudo).'],
  [/\bchmod\b[^;&|\n]*(\s0?777\b|\s[ugoa]*a[ugoa]*\+rwx\b|\s-R\b[^;&|\n]*\s0?777\b)/, 'Ask first: chmod 777 removes all protection (anyone can read, change, or run it).'],
  [/\b(pacman|yay|paru)\s+-(S|R|U)/, 'Ask first: installing or removing system packages.'],
  [/\b(npm|pnpm)\s+(i|install|add|ci)\b|\byarn\s+(add|install)\b|\byarn\s*$|\bbun\s+(add|install|i)\b|\bpip3?\s+install\b|\buv\s+(add|pip\s+install|tool\s+install)\b|\bpoetry\s+add\b|\bpipx\s+install\b|\bcargo\s+(add|install)\b|\bgo\s+(get|install)\b|\bgem\s+install\b|\bcomposer\s+(require|install)\b|\bnpx\s+(-y\s+)?[^-\s]|\bbunx\s/, 'Ask first: installing a package/library (say whether the approved plan lists it).'],
  [/(~|\$HOME|\/home\/[^\/\s]+)\/\.claude\/(settings|hooks|CLAUDE\.md|guides|agents|skills)|(^|[\s'"])\.claude\/(settings|hooks|agents|skills)/, 'Ask first: changing Claude configuration.'],
];

function analyzeBash(cmd, cwd) {
  if (mentionsSecretPath(cmd)) {
    return { deny: 'Never do: this command touches a secret file (.env, keys, ~/.ssh, ~/.aws, credentials). Templates like .env.example are fine.' };
  }
  for (const check of [checkRemotePipe, checkDiskWipe]) {
    const r = check(cmd);
    if (r) return { deny: r };
  }
  const rm = checkRm(cmd, cwd);
  if (rm && rm.deny) return rm;
  const push = checkPush(cmd, cwd);
  if (push && push.deny) return push;
  const commit = checkCommitSecrets(cmd, cwd);
  if (commit) return commit;
  if (/\bgit\b[^;&|\n]*\bcommit\b/.test(cmd) && /^(main|master)$/.test(git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).trim())) {
    return { ask: 'Ask first: committing directly on main/master (work belongs on a feature branch).' };
  }
  if (rm) return rm;
  if (push) return push;
  for (const [re, reason] of ASK_RULES) if (re.test(cmd)) return { ask: reason };
  return null;
}

// ---------- File tools ----------

const CONFIG_EXEMPT = ['projects', 'plans', 'state'].map((d) => path.join(HOME, '.claude', d));

function isClaudeConfigPath(p) {
  const full = path.resolve(p);
  const userClaude = path.join(HOME, '.claude');
  if (isInside(full, userClaude)) return !CONFIG_EXEMPT.some((d) => isInside(full, d));
  return /\/\.claude\//.test(full);
}

function analyzeFileTool(tool, input, cwd) {
  const p = input.file_path || input.notebook_path || input.path || '';
  const full = p ? resolveFrom(cwd, p) : '';
  if (tool === 'Read' || tool === 'Grep') {
    if (full && isSecretPath(full)) return { deny: 'Never do: reading a secret file. Templates like .env.example are fine.' };
    return null;
  }
  if (full && isSecretPath(full)) return { ask: 'Ask first: writing to a secret file.' };
  if (full && isClaudeConfigPath(full)) return { ask: 'Ask first: changing Claude configuration.' };
  return null;
}

const FILE_TOOLS = ['Read', 'Grep', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

// The rules alone, for one tool call → { deny } · { ask } (reason incl. the note) · null.
function analyze(input) {
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  const cwd = input.cwd || process.cwd();
  let r = null;
  if (tool === 'Bash') r = analyzeBash(String(ti.command || ''), cwd);
  else if (FILE_TOOLS.includes(tool)) r = analyzeFileTool(tool, ti, cwd);
  if (r && r.ask) return { ask: `${r.ask} ${ASK_NOTE}` };
  return r;
}

// Whether the safety copy is on for this call. Broken or unfinished settings keep it on (safe side).
function safetyOn(input, env) {
  if (env[SAFETY_SWITCH] === 'off') return false;
  const cfg = loadConfig(projectRoot(input, env));
  if (cfg.status === 'absent') return false;
  if (cfg.status !== 'ok') return true;
  return isHookEnabled('safety', cfg.config, env);
}

const decideSafety = (input, env) => (safetyOn(input, env) ? analyze(input) : null);

module.exports = { HOME, ASK_NOTE, isSecretPath, mentionsSecretPath, findSecretValues, analyze, safetyOn, decideSafety };
