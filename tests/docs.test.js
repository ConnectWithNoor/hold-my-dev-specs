'use strict';
// The public docs (README, docs/how-it-works.md, CONTRIBUTING.md) keep their required sections, link
// only to files and headings that exist, carry well-formed Mermaid diagrams, name the real parts of the
// plugin, and hold nothing private.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { HELPERS } = require('../hooks/scripts/lib/agents');
const { PHRASES } = require('../hooks/scripts/lib/approvals');

const ROOT = path.join(__dirname, '..');
const DOCS = { readme: 'README.md', how: 'docs/how-it-works.md', contributing: 'CONTRIBUTING.md' };
const text = Object.fromEntries(Object.entries(DOCS).map(([k, f]) => [k, fs.readFileSync(path.join(ROOT, f), 'utf8')]));

// GitHub's heading anchors: lower case, punctuation dropped, spaces → dashes.
const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
const headings = (md) => [...md.matchAll(/^#{1,6} (.+)$/gm)].map((m) => m[1]);
const mermaidBlocks = (md) => [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);

const REQUIRED = {
  readme: ['The method', 'The stages and your phrases', 'Who controls what', 'Best practices it follows', 'How it compares',
    'Install', 'Quick start', 'Profiles', 'Requirements', 'Permission prompts to expect', "What the protections can and can't do", 'Go deeper', 'License'],
  how: ['Skills', 'Helpers (agents)', 'Hooks', 'One task, step by step', 'Evals', 'Saving context and usage'],
  contributing: ['Set up', 'Making a change', 'Evals', 'Privacy', 'License'],
};

for (const [key, file] of Object.entries(DOCS)) {
  test(`${file}: has its required sections`, () => {
    const hs = headings(text[key]);
    for (const h of REQUIRED[key]) assert.ok(hs.includes(h), h);
  });

  test(`${file}: every relative link points at a file (and heading) that exists`, () => {
    const dir = path.dirname(path.join(ROOT, file));
    for (const [, target] of text[key].matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^https?:\/\//.test(target)) continue;
      const [rel, anchor] = target.split('#');
      const dest = rel ? path.join(dir, rel) : path.join(ROOT, file);
      assert.ok(fs.existsSync(dest), target);
      if (anchor && dest.endsWith('.md')) {
        assert.ok(headings(fs.readFileSync(dest, 'utf8')).map(slug).includes(anchor), `${target}: heading`);
      }
    }
  });

  test(`${file}: Mermaid blocks start with a known diagram type and have balanced brackets and quotes`, () => {
    for (const block of mermaidBlocks(text[key])) {
      assert.match(block.split('\n')[0], /^(flowchart (LR|TD|TB|RL|BT)|stateDiagram-v2|sequenceDiagram)$/);
      for (const line of block.split('\n')) {
        assert.equal((line.match(/"/g) || []).length % 2, 0, `quotes: ${line}`);
        assert.ok(!line.includes(';'), `a ; ends a Mermaid statement: ${line}`);
        assert.equal((line.match(/\[/g) || []).length, (line.match(/\]/g) || []).length, `brackets: ${line}`);
      }
    }
  });

  test(`${file}: nothing private (home paths, temp folders, real email addresses)`, () => {
    assert.doesNotMatch(text[key], /\/home\/[a-z]|\/Users\/[A-Za-z]|\/tmp\/claude|phase-b-|\.claude\/plans/);
    for (const [email] of text[key].matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      assert.match(email, /@example\.com$/, email);
    }
  });
}

test('README: the method diagram covers every stage and its feedback loops', () => {
  const [flow, states] = mermaidBlocks(text.readme);
  assert.match(flow, /^flowchart/);
  for (const stage of ['Intent', 'Spec', 'Plan', 'Tasks', 'Build', 'Verify', 'Manual review', 'Ship', 'Retro']) assert.ok(flow.includes(stage), stage);
  for (const loop of ['fresh fixer', 'the spec itself is wrong', 'bug', 'wrong requirement']) assert.ok(flow.includes(loop), loop);
  assert.match(states, /^stateDiagram-v2/);
  for (const stage of ['spec', 'plan', 'tasks', 'build', 'validate', 'review', 'ship', 'done']) assert.match(states, new RegExp(`\\b${stage}\\b`), stage);
  for (const phrase of Object.keys(PHRASES)) assert.ok(states.includes(`: ${phrase}`), phrase);
  for (const from of ['plan', 'tasks', 'build', 'validate', 'review']) assert.ok(states.includes(`${from} --> spec: revoke`), from);
});

test('README: the comparison names each tool with a link and the date it was checked', () => {
  assert.match(text.readme, /checked\s+on 2026-11-24/);
  for (const url of ['https://github.com/github/spec-kit', 'https://kiro.dev/docs/specs/', 'https://github.com/obra/superpowers',
    'https://github.com/bmad-code-org/BMAD-METHOD', 'https://github.com/Fission-AI/OpenSpec']) {
    assert.ok(text.readme.includes(`](${url})`), url);
  }
  assert.match(text.readme, /\| Where it is stronger \|/);
});

test('how-it-works: names every skill, helper and hook script that exists, and has the task sequence diagram', () => {
  for (const skill of fs.readdirSync(path.join(ROOT, 'skills'))) assert.ok(text.how.includes(`| \`${skill}\` |`), skill);
  for (const helper of HELPERS) assert.ok(text.how.includes(`| \`${helper}\` |`), helper);
  const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const groups of Object.values(hooks)) {
    for (const g of groups) for (const h of g.hooks) assert.ok(text.how.includes(path.basename(h.command.replace(/"$/, ''))), h.command);
  }
  const [seq] = mermaidBlocks(text.how);
  assert.match(seq, /^sequenceDiagram/);
  for (const who of ['Master', 'Test author', 'Implementer', 'Verifier']) assert.ok(seq.includes(who), who);
  assert.match(seq, /alt PASS[\s\S]*else FAIL[\s\S]*fresh implementer as fixer[\s\S]*end/);
  assert.match(text.how, /about 905 tokens per session/);
});

test('CONTRIBUTING: issue first for big changes, tests for behaviour, ADRs, eval cost, no private data', () => {
  for (const must of ['open an issue first', 'Every behaviour change comes with tests', 'New lasting decisions get an ADR',
    'about\n$1.60 per run', 'Never commit private data', 'claude plugin validate .', '--plugin-dir', 'Node.js 22']) {
    assert.ok(text.contributing.includes(must), must);
  }
});
