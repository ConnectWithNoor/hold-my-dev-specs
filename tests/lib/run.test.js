'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { run } = require('../../hooks/scripts/lib/run');

function sink() {
  const chunks = [];
  const stream = new Writable({ write(c, _e, cb) { chunks.push(String(c)); cb(); } });
  return { stream, text: () => chunks.join('') };
}

async function runWith(stdinText, handler, options) {
  const out = sink();
  const err = sink();
  const code = await run(handler, { stdin: Readable.from([stdinText]), stdout: out.stream, stderr: err.stream, env: {} }, options);
  return { code, stdout: out.text(), stderr: err.text() };
}

test('valid input: handler output is printed, exit 0', async () => {
  const r = await runWith('{"hook_event_name":"PreToolUse"}', (input) => ({ seen: input.hook_event_name }));
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.stdout), { seen: 'PreToolUse' });
});

test('handler returns nothing: no output, exit 0', async () => {
  const r = await runWith('{}', () => undefined);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

for (const [name, text] of [['empty', ''], ['whitespace', '  \n'], ['garbled', '{"a":'], ['array', '[1,2]'], ['string', '"hi"']]) {
  test(`${name} input → blocked (exit 2)`, async () => {
    const r = await runWith(text, () => ({ never: true }));
    assert.equal(r.code, 2);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /blocked to stay safe/);
  });
}

test('handler crash → blocked (exit 2), message on stderr', async () => {
  const r = await runWith('{}', () => { throw new Error('boom'); });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /boom/);
});

test('async handler rejection → blocked (exit 2)', async () => {
  const r = await runWith('{}', async () => { throw new Error('later'); });
  assert.equal(r.code, 2);
});

// onError 'warn' — UserPromptSubmit and Stop hooks: never swallow the message or stop Claude from stopping.
for (const [name, text, handler] of [
  ['garbled input', '{"a":', () => ({ never: true })],
  ['handler crash', '{}', () => { throw new Error('ledger unreadable'); }],
]) {
  test(`warn mode, ${name} → exit 0 with a ⚠ warning and no handler output`, async () => {
    const r = await runWith(text, handler, { onError: 'warn' });
    assert.equal(r.code, 0);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(Object.keys(out), ['systemMessage']);
    assert.match(out.systemMessage, /^⚠ hold-my-dev-specs: .* — nothing was changed$/);
  });
}

test('warn mode, normal run → handler output unchanged', async () => {
  const r = await runWith('{}', () => ({ ok: 1 }), { onError: 'warn' });
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.stdout), { ok: 1 });
});

test('unknown onError mode is a programming error', async () => {
  await assert.rejects(runWith('{}', () => ({}), { onError: 'ignore' }));
});
