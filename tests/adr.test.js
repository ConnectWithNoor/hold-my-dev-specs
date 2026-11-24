'use strict';
// The public decision records (docs/adr/) keep one shape, are all listed in the index, link only to
// files that exist, and carry nothing private.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'docs', 'adr');
const files = fs.readdirSync(DIR).filter((f) => /^\d{4}-[a-z0-9-]+\.md$/.test(f)).sort();
const index = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');

test('ADRs are numbered 0001, 0002, … without gaps', () => {
  assert.ok(files.length > 0);
  files.forEach((f, i) => assert.equal(f.slice(0, 4), String(i + 1).padStart(4, '0'), f));
});

for (const f of files) {
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');

  test(`${f}: title, status and the three sections`, () => {
    assert.match(text, new RegExp(`^# ADR-${f.slice(0, 4)} — .+`));
    assert.match(text, /^\*\*Status:\*\* (Accepted|Superseded by ADR-\d{4}) \(\d{4}-\d{2}-\d{2}\)$/m);
    for (const s of ['## Context', '## Decision', '## Consequences']) assert.ok(text.includes(`\n${s}\n`), s);
  });

  test(`${f}: listed in the index with its title`, () => {
    const title = text.split('\n')[0].replace(/^# ADR-\d{4} — /, '');
    assert.ok(index.includes(`| [${f.slice(0, 4)}](${f}) | ${title} |`), title);
  });

  test(`${f}: relative links point at files that exist`, () => {
    for (const [, rel] of text.matchAll(/\]\(([^)#:]+)\)/g)) assert.ok(fs.existsSync(path.join(DIR, rel)), rel);
  });

  test(`${f}: nothing private (home paths, temp folders, emails, private planning files)`, () => {
    assert.doesNotMatch(text, /\/home\/|~\/\.claude|\/tmp\/|@[a-z0-9-]+\.[a-z]{2,}|phase-b-|\.claude\/plans/i);
  });
}
