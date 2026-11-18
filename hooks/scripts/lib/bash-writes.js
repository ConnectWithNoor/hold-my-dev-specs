'use strict';
// Best-effort list of files a shell command would write, change or delete.
// Covers redirections (> >>), tee, sed -i, cp/mv/install/ln targets, rm/touch/truncate/mkdir/…, dd of=,
// curl -o / wget -O, tar -x / unzip / patch / git apply (target: their folder, "." = current folder),
// git checkout -- / git restore / git mv / git rm, and the same inside sudo / env / nohup / time / sh -c "…".
// Moves (mv, git mv, rsync --remove-source-files) report their sources too: a moved file is changed.
// Not covered (by design): scripts run by an interpreter (python, node…), other git commands, $(…).
// This is best-effort, not airtight; the verifier's diff check is the backstop.

const OPERATORS = ['&&', '||', ';;', ';', '|', '&', '\n', '(', ')'];

// Splits a command into words and operators, honouring quotes and backslashes.
// Heredoc text ("<<WORD" … a line holding only WORD) is data, not commands: it is skipped.
function tokenize(cmd) {
  const tokens = [];
  let word = null;
  let heredocs = []; // end words waiting for the next line break
  const pushWord = () => { if (word !== null) tokens.push({ t: 'word', v: word }); word = null; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (c === '\\' && i + 1 < cmd.length) {
      if (cmd[i + 1] === '\n') { i++; continue; } // line continuation
      word = (word || '') + cmd[++i];
    } else if (c === "'") {
      const end = cmd.indexOf("'", i + 1);
      const stop = end === -1 ? cmd.length : end;
      word = (word || '') + cmd.slice(i + 1, stop);
      i = stop;
    } else if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < cmd.length && cmd[j] !== '"') {
        if (cmd[j] === '\\' && j + 1 < cmd.length && '"\\$`'.includes(cmd[j + 1])) j++;
        s += cmd[j++];
      }
      word = (word || '') + s;
      i = j;
    } else if (c === ' ' || c === '\t') {
      pushWord();
    } else if (c === '#' && word === null) {
      while (i < cmd.length && cmd[i] !== '\n') i++;
      i--;
    } else if (c === '>' || (c === '&' && cmd[i + 1] === '>')) {
      // Redirection: optional fd digits before it are part of the current word, e.g. "2>"
      if (word !== null && /^\d+$/.test(word)) word = null;
      pushWord();
      let j = c === '&' ? i + 2 : i + 1;
      if (cmd[j] === '>' || cmd[j] === '|') j++;
      tokens.push({ t: 'redir' });
      i = j - 1;
    } else if (c === '<') {
      // Input redirection (reads a file): "<", "<<" heredoc, "<<<" here-string
      if (word !== null && /^\d+$/.test(word)) word = null;
      pushWord();
      let j = i + 1;
      while (cmd[j] === '<') j++;
      tokens.push({ t: 'rin' });
      if (j - i === 2) {
        // Heredoc "<<WORD" / "<<-WORD" / "<<'WORD'": remember WORD; its text starts on the next line.
        let k = j;
        const stripTabs = cmd[k] === '-';
        if (stripTabs) k++;
        while (cmd[k] === ' ' || cmd[k] === '\t') k++;
        let delim = '';
        if (cmd[k] === "'" || cmd[k] === '"') {
          const end = cmd.indexOf(cmd[k], k + 1);
          delim = cmd.slice(k + 1, end === -1 ? cmd.length : end);
          k = end === -1 ? cmd.length : end + 1;
        } else {
          while (k < cmd.length && !/[\s;&|<>()]/.test(cmd[k])) delim += cmd[k++];
        }
        if (delim) {
          heredocs.push({ delim, stripTabs });
          tokens.push({ t: 'word', v: delim }); // consumed as the "file read from" below
          j = k;
        }
      }
      i = j - 1;
    } else if (c === '\n' && heredocs.length) {
      // End of the line that opened heredocs: skip their text up to each end line.
      pushWord();
      tokens.push({ t: 'op', v: '\n' });
      let p = i + 1;
      for (const { delim, stripTabs } of heredocs) {
        while (p < cmd.length) {
          const e = cmd.indexOf('\n', p);
          const line = cmd.slice(p, e === -1 ? cmd.length : e);
          p = e === -1 ? cmd.length : e + 1;
          if ((stripTabs ? line.replace(/^\t+/, '') : line) === delim) break;
        }
      }
      heredocs = [];
      i = p - 1;
    } else {
      const op = OPERATORS.find((o) => cmd.startsWith(o, i));
      if (op) {
        pushWord();
        tokens.push({ t: 'op', v: op });
        i += op.length - 1;
      } else {
        word = (word || '') + c;
      }
    }
  }
  pushWord();
  return tokens;
}

const WRAPPERS = ['sudo', 'doas', 'env', 'nohup', 'time', 'command', 'exec', 'nice', 'stdbuf', 'timeout'];
const SHELLS = ['sh', 'bash', 'zsh', 'dash', 'ksh'];
const ALL_ARGS = ['rm', 'rmdir', 'unlink', 'touch', 'mkdir', 'shred', 'tee'];
const LAST_ARG = ['cp', 'mv', 'install', 'ln', 'rsync'];

const base = (w) => w.split('/').pop();
const isOption = (w) => w.startsWith('-') && w !== '-';

// "dir" + "file" as a relative path ("" or "." = current folder; absolute files stay as they are).
function joinDir(dir, file) {
  if (!dir || dir === '.' || file.startsWith('/')) return file;
  if (file === '.') return dir;
  return `${dir.replace(/\/+$/, '')}/${file}`;
}

// Values of options like "-o file", "--output file", "--output=file".
function optionValues(args, names) {
  const out = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (names.includes(a) && args[k + 1] !== undefined) out.push(args[++k]);
    else {
      const long = names.find((n) => n.startsWith('--') && a.startsWith(`${n}=`));
      if (long) out.push(a.slice(long.length + 1));
    }
  }
  return out;
}

// Words of one simple command → files it writes.
function commandTargets(words, depth) {
  let i = 0;
  // Skip variable assignments and wrapper commands (with their options).
  for (;;) {
    while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
    if (i < words.length && WRAPPERS.includes(base(words[i]))) {
      const wrapper = base(words[i]);
      i++;
      while (i < words.length && (isOption(words[i]) || (wrapper === 'env' && words[i].includes('=')))) i++;
      if (wrapper === 'timeout' && i < words.length) i++; // its duration
      continue;
    }
    break;
  }
  if (i >= words.length) return [];
  const name = base(words[i]);
  const args = words.slice(i + 1);
  const plain = args.filter((a) => !isOption(a));

  if (SHELLS.includes(name)) {
    const c = args.indexOf('-c');
    return c !== -1 && args[c + 1] !== undefined && depth < 3 ? bashWrites(args[c + 1], depth + 1) : [];
  }
  if (name === 'mkdir') return plain.map((p) => ({ path: p, kind: 'mkdir' })); // creates, never changes
  if (ALL_ARGS.includes(name)) return plain;
  if (name === 'truncate') {
    const out = [];
    for (let k = 0; k < args.length; k++) {
      if (args[k] === '-s' || args[k] === '-r') { k++; continue; }
      if (!isOption(args[k])) out.push(args[k]);
    }
    return out;
  }
  // A move, or a sync that removes its sources, changes the sources too (they disappear).
  if (name === 'mv' || (name === 'rsync' && args.includes('--remove-source-files'))) return plain;
  if (LAST_ARG.includes(name)) {
    const t = args.indexOf('-t');
    if (t !== -1 && args[t + 1]) return [args[t + 1]];
    return plain.length >= 2 ? [plain[plain.length - 1]] : [];
  }
  if (name === 'dd') return args.filter((a) => a.startsWith('of=')).map((a) => a.slice(3));
  if (name === 'curl') return optionValues(args, ['-o', '--output']);
  if (name === 'wget') return optionValues(args, ['-O', '--output-document']);
  if (name === 'tar') {
    // Mode letters: "-xzf" anywhere, or old style "xvf" as the first word
    const extracting = args.some((a) => a === '--extract' || a === '--get' || /^-[a-zA-Z]*x[a-zA-Z]*$/.test(a))
      || /^[a-zA-Z]*x[a-zA-Z]*$/.test(args[0] || '');
    if (!extracting) return [];
    const dir = optionValues(args, ['-C', '--directory']);
    return dir.length ? dir : ['.'];
  }
  if (name === 'unzip') {
    const dir = optionValues(args, ['-d']);
    return dir.length ? dir : ['.'];
  }
  if (name === 'patch') {
    const dir = optionValues(args, ['-d', '--directory']);
    return dir.length ? dir : ['.'];
  }
  if (name === 'git') {
    // Skip git's global options before the subcommand. "-C <dir>" also moves git into <dir>,
    // so the paths it names are relative to that folder.
    let k = 0;
    let dir = '';
    while (k < args.length && isOption(args[k])) {
      const opt = args[k];
      if (opt === '-C' && args[k + 1] !== undefined) { dir = joinDir(dir, args[k + 1]); k += 2; }
      else if (['-c', '--git-dir', '--work-tree', '--namespace', '--exec-path'].includes(opt) && args[k + 1] !== undefined) k += 2;
      else k += 1; // --git-dir=…, --work-tree=…, --no-pager, …
    }
    const sub = args[k];
    const rest = args.slice(k + 1);
    const inDir = (files) => files.map((f) => joinDir(dir, f));
    if (sub === 'checkout') {
      const dash = rest.indexOf('--');
      return dash === -1 ? [] : inDir(rest.slice(dash + 1));
    }
    if (sub === 'restore' || sub === 'mv' || sub === 'rm') return inDir(rest.filter((a) => !isOption(a) && a !== '--'));
    if (sub === 'apply') return inDir(['.']);
  }
  if (name === 'sed' || name === 'perl') {
    const inPlace = args.some((a) => a === '--in-place' || a.startsWith('--in-place=') || /^-[a-zA-Z]*i/.test(a));
    if (!inPlace) return [];
    const scriptGiven = args.some((a) => a === '-e' || a === '-f' || a === '--expression');
    const files = [];
    for (let k = 0; k < args.length; k++) {
      if (['-e', '-f', '--expression'].includes(args[k])) { k++; continue; }
      if (!isOption(args[k])) files.push(args[k]);
    }
    return scriptGiven ? files : files.slice(1);
  }
  return [];
}

// → [{ path, kind }] where kind is "mkdir" (only creates a folder) or "write" (changes or deletes).
// A path both created and written counts as "write".
function bashWrites(command, depth = 0) {
  if (typeof command !== 'string') throw new Error('Bash command is not a string');
  const tokens = tokenize(command);
  const found = [];
  const add = (t) => found.push(typeof t === 'string' ? { path: t, kind: 'write' } : t);
  let words = [];
  const flush = () => { commandTargets(words, depth).forEach(add); words = []; };
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok.t === 'redir') {
      const next = tokens[k + 1];
      if (next && next.t === 'word') {
        k++;
        if (!next.v.startsWith('&')) add(next.v); // "2>&1" duplicates a stream, writes no file
      }
    } else if (tok.t === 'rin') {
      if (tokens[k + 1] && tokens[k + 1].t === 'word') k++; // the file read from is not a target
    } else if (tok.t === 'op') {
      flush();
    } else {
      words.push(tok.v);
    }
  }
  flush();
  const byPath = new Map();
  for (const { path: p, kind } of found) {
    if (!p || p === '-' || p.startsWith('/dev/')) continue;
    byPath.set(p, byPath.get(p) === 'write' ? 'write' : kind);
  }
  return [...byPath].map(([p, kind]) => ({ path: p, kind }));
}

const bashWriteTargets = (command, depth) => bashWrites(command, depth).map((w) => w.path);

module.exports = { tokenize, bashWrites, bashWriteTargets };
