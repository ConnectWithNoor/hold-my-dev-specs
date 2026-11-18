'use strict';
// Fail-safe wrapper for every hook script.
// Reads the hook input (JSON on stdin), calls the handler, prints its output.
// What "safe" means on an error (garbled input, a crash, a bug) depends on the hook event:
// - onError 'block' (PreToolUse): exit 2, which Claude Code treats as "block the tool call".
//   (Exit 1 would let the action through, so it is never used.)
// - onError 'warn' (UserPromptSubmit, Stop): exit 2 there would swallow the user's message or keep
//   Claude from stopping. Instead: exit 0, do nothing (e.g. record no approval), show a ⚠ warning.
// - onError 'pass' (PreToolUse on Read): this plugin gates no reads, so a problem must never block one.
//   Exit 0, no output: Claude Code's normal permission flow decides.

function readInput(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => { data += chunk; });
    stream.on('error', reject);
    stream.on('end', () => {
      if (!data.trim()) return reject(new Error('empty hook input'));
      let input;
      try { input = JSON.parse(data); } catch { return reject(new Error('hook input is not valid JSON')); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return reject(new Error('hook input is not a JSON object'));
      }
      resolve(input);
    });
  });
}

const ON_ERROR = ['block', 'warn', 'pass'];

async function run(handler, io = {}, { onError = 'block' } = {}) {
  if (!ON_ERROR.includes(onError)) throw new Error(`unknown onError mode: ${onError}`);
  const stdin = io.stdin || process.stdin;
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const env = io.env || process.env;
  try {
    const input = await readInput(stdin);
    const output = await handler(input, env);
    if (output !== undefined && output !== null) stdout.write(JSON.stringify(output));
    return 0;
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (onError === 'pass') return 0;
    if (onError === 'warn') {
      stderr.write(`hold-my-dev-specs: ${message} — nothing was changed\n`);
      stdout.write(JSON.stringify({ systemMessage: `⚠ hold-my-dev-specs: ${message} — nothing was changed` }));
      return 0;
    }
    stderr.write(`hold-my-dev-specs: ${message} — blocked to stay safe\n`);
    return 2;
  }
}

// Entry point for hook scripts: main(handler, { onError }) runs and sets the exit code.
function main(handler, options) {
  run(handler, {}, options).then((code) => { process.exitCode = code; });
}

module.exports = { readInput, run, main };
