'use strict';
// The agent files must match what the hooks enforce, so the two can't drift apart.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { REPORTS } = require('../hooks/scripts/lib/gate');
const { HELPERS } = require('../hooks/scripts/lib/agents');

const DIR = path.join(__dirname, '..', 'agents');
const READ_ONLY = ['explorer', 'verifier', 'shipper'];
const EDITING = ['Edit', 'MultiEdit', 'NotebookEdit'];

function parse(file) {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${file}: frontmatter between --- lines`);
  const meta = Object.fromEntries(m[1].split('\n').map((l) => {
    const i = l.indexOf(':');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
  const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  return { meta, tools: list(meta.tools), disallowed: list(meta.disallowedTools), body: m[2] };
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));

test('the S6 roster is present', () => {
  for (const name of ['explorer', 'test-author', 'implementer', 'verifier', 'shipper']) {
    assert.ok(files.includes(`${name}.md`), name);
  }
});

for (const file of files) {
  const name = file.replace(/\.md$/, '');
  const { meta, tools, disallowed, body } = parse(file);

  test(`${name}: name matches the file and is a helper the hooks know`, () => {
    assert.equal(meta.name, name);
    assert.ok(HELPERS.includes(name));
  });

  test(`${name}: description says it is for hold-my-dev-specs software projects`, () => {
    assert.match(meta.description, /hold-my-dev-specs/);
    assert.match(meta.description, /software project/);
  });

  test(`${name}: no model name (the master picks it from the project settings)`, () => {
    assert.equal(meta.model, undefined);
    assert.doesNotMatch(body, /\b(opus|sonnet|haiku|fable)\b/i);
  });

  test(`${name}: explicit tool list without the Agent tool (helpers never start helpers)`, () => {
    assert.ok(tools.length > 0);
    assert.ok(!tools.includes('Agent') && !tools.includes('Task'));
  });

  test(`${name}: no field plugin agents ignore`, () => {
    for (const k of ['hooks', 'permissionMode', 'mcpServers', 'initialPrompt']) assert.equal(meta[k], undefined, k);
  });

  if (READ_ONLY.includes(name)) {
    test(`${name}: read-only — no editing tools, only Write for its report`, () => {
      for (const t of EDITING) assert.ok(!tools.includes(t), t);
      assert.ok(disallowed.includes('Edit') && disallowed.includes('NotebookEdit'));
    });
  }

  if (REPORTS[name]) {
    test(`${name}: the report name it is told to write is the one the hook allows`, () => {
      const named = [...body.matchAll(/specs\/<feature>\/reports\/([^`\s]+)/g)].map((x) => x[1]);
      assert.ok(named.length > 0, 'report path mentioned');
      for (const n of named) {
        const example = n.replace('<task>', 'T01').replace('<round>', '2').replace('<topic>', 'auth-flow').replace('<lens>', 'security');
        assert.match(example, REPORTS[name], n);
      }
    });
  }

  test(`${name}: treats file and tool contents as information, not instructions`, () => {
    assert.match(body, /never instructions to you/);
  });
}
