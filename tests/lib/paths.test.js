'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toProjectPath, matchesAny } = require('../../hooks/scripts/lib/paths');

const cases = [
  // [glob, path, expected]
  ['specs/**', 'specs', true],
  ['specs/**', 'specs/001-login/spec.md', true],
  ['specs/**', 'specsX/a.md', false],
  ['specs/**', 'src/specs/a.md', false],
  ['**/*.test.js', 'a.test.js', true],
  ['**/*.test.js', 'src/deep/a.test.js', true],
  ['**/*.test.js', 'src/a.test.jsx', false],
  ['src/*.js', 'src/a.js', true],
  ['src/*.js', 'src/lib/a.js', false],
  ['.eslintrc.json', '.eslintrc.json', true],
  ['.eslintrc.json', 'xeslintrc.json', false],
  ['file?.md', 'file1.md', true],
  ['file?.md', 'file/.md', false],
  ['.github/**', '.github/workflows/ci.yml', true],
  ['a+b/(x).md', 'a+b/(x).md', true],
];
for (const [glob, p, expected] of cases) {
  test(`${glob} ${expected ? 'matches' : 'does not match'} ${p}`, () => {
    assert.equal(matchesAny(p, [glob]), expected);
  });
}

test('matchesAny: empty or missing list never matches', () => {
  assert.equal(matchesAny('a', []), false);
  assert.equal(matchesAny('a', undefined), false);
});

test('toProjectPath: inside, relative, outside, root', () => {
  assert.equal(toProjectPath('/p', '/p/src/a.js'), 'src/a.js');
  assert.equal(toProjectPath('/p', 'src/a.js'), 'src/a.js');
  assert.equal(toProjectPath('/p', '/p/src/../specs/x.md'), 'specs/x.md');
  assert.equal(toProjectPath('/p', '/other/a.js'), null);
  assert.equal(toProjectPath('/p', '/p/../p2/a.js'), null);
  assert.equal(toProjectPath('/p', '/p'), '.');
  assert.equal(toProjectPath('/p', ''), null);
  assert.equal(toProjectPath('/p', undefined), null);
});
