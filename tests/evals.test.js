'use strict';
// The skill-trigger eval suite (evals/) is checked here for free: shape, starting scripts, balance.
// Running it costs usage: `npm run eval`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EVALS = path.join(__dirname, '..', 'evals');
const SKILLS = ['setup', 'feature', 'retro'];
const cases = SKILLS.flatMap((skill) => fs.readdirSync(path.join(EVALS, skill)).map((name) => ({ skill, name, dir: path.join(EVALS, skill, name) })));

test('3 positive and 3 negative cases per skill', () => {
  for (const skill of SKILLS) {
    const mine = cases.filter((c) => c.skill === skill);
    assert.equal(mine.filter((c) => c.name.startsWith('positive-')).length, 3, `${skill} positive`);
    assert.equal(mine.filter((c) => c.name.startsWith('negative-')).length, 3, `${skill} negative`);
  }
});

for (const c of cases) {
  const yaml = fs.readFileSync(path.join(c.dir, 'case.yaml'), 'utf8');
  const label = `${c.skill}/${c.name}`;

  test(`${label}: name, one cheap run, read-only tools`, () => {
    assert.match(yaml, new RegExp(`^name: ${c.skill}-${c.name}$`, 'm'));
    assert.match(yaml, /^runs: 1$/m);
    assert.match(yaml, /^ {2}max_turns: 3$/m);
    assert.match(yaml, /^ {2}allowed_tools: \[Skill, Read, Glob, Grep\]$/m);
  });

  test(`${label}: the description is quoted (a leading quote mark broke YAML once)`, () => {
    assert.match(yaml, /^description: ".*"$/m);
  });

  test(`${label}: its starting script links to a shared fixture that exists`, () => {
    assert.match(yaml, /^ {2}scaffold_script: scaffold\.sh$/m);
    const link = path.join(c.dir, 'scaffold.sh');
    assert.ok(fs.lstatSync(link).isSymbolicLink());
    const target = fs.readlinkSync(link);
    assert.match(target, /^\.\.\/\.\.\/fixtures\/[a-z-]+\.sh$/);
    assert.ok(fs.existsSync(path.join(c.dir, target)), target);
  });

  test(`${label}: graders check which of our skills started`, () => {
    if (c.name.startsWith('positive-')) {
      assert.match(yaml, new RegExp(`name: ${c.skill}-started`));
      assert.match(yaml, /name: other-skills-not-started[\s\S]*max: 0/);
    } else {
      assert.match(yaml, /name: no-plugin-skill-started[\s\S]*\(setup\|feature\|retro\)[\s\S]*max: 0/);
    }
  });
}

test('fixtures: setup cases start without settings, feature and retro cases with them', () => {
  const fixture = (c) => fs.readlinkSync(path.join(c.dir, 'scaffold.sh'));
  for (const c of cases.filter((x) => x.skill === 'setup')) assert.match(fixture(c), /repo-with-code\.sh$/);
  for (const c of cases.filter((x) => x.skill === 'feature')) assert.match(fixture(c), /configured\.sh$/);
  for (const c of cases.filter((x) => x.skill === 'retro')) assert.match(fixture(c), /done-feature\.sh$/);
});
