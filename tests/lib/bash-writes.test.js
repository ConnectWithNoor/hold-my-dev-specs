'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bashWriteTargets } = require('../../hooks/scripts/lib/bash-writes');

const cases = [
  // [command, expected targets]
  ['ls -la', []],
  ['git status && npm test', []],
  ['cat a.txt > b.txt', ['b.txt']],
  ['echo hi >> log.txt', ['log.txt']],
  ['echo hi>x.txt', ['x.txt']],
  ['npm test 2>&1 | tee out.log', ['out.log']],
  ['cmd 2> err.txt', ['err.txt']],
  ['cmd &> all.txt', ['all.txt']],
  ['cmd > /dev/null 2>&1', []],
  ['sort < in.txt', []],
  ['cat <<EOF > gen.js', ['gen.js']],
  ['sed -i "s/a/b/" src/app.js', ['src/app.js']],
  ['sed -i.bak -e s/a/b/ one.js two.js', ['one.js', 'two.js']],
  ['sed "s/a/b/" src/app.js', []],
  ['perl -pi -e "s/a/b/" f.pl', ['f.pl']],
  ['cp a.js tests/a.test.js', ['tests/a.test.js']],
  ['cp -r src dist', ['dist']],
  ['cp -t target a b', ['target']],
  ['mv old.js new.js', ['old.js', 'new.js']],
  ['mv specs/002/spec.md specs/002/old.md', ['specs/002/spec.md', 'specs/002/old.md']],
  ['mv -t dest a b', ['dest', 'a', 'b']],
  ['git mv specs/002/spec.md x.md', ['specs/002/spec.md', 'x.md']],
  ['git rm specs/002/rubric.md', ['specs/002/rubric.md']],
  ['git rm --cached -r build', ['build']],
  ['rsync --remove-source-files specs/002/spec.md /tmp/', ['specs/002/spec.md', '/tmp/']],
  ['rsync -a src/ backup/', ['backup/']],
  ['rm -rf build tmp', ['build', 'tmp']],
  ['touch a b', ['a', 'b']],
  ['mkdir -p x/y', ['x/y']],
  ['truncate -s 0 big.log', ['big.log']],
  ['dd if=/dev/zero of=disk.img bs=1M', ['disk.img']],
  ['tee -a notes.md', ['notes.md']],
  ['sudo rm protected.cfg', ['protected.cfg']],
  ['env FOO=1 BAR=2 rm a', ['a']],
  ['FOO=1 touch b', ['b']],
  ['timeout 5 rm c', ['c']],
  ['bash -c "echo x > inner.txt"', ['inner.txt']],
  ["sh -c 'rm -f q'", ['q']],
  ['echo "a > b" > real.txt', ['real.txt']],
  ["echo 'x' # > not-a-target", []],
  ['(cd sub && rm f)', ['f']],
  ['a; b > one; c >> two', ['one', 'two']],
  ['echo a > same && echo b > same', ['same']],
  ['/usr/bin/rm z', ['z']],
  ['curl -o out.bin https://x', ['out.bin']],
  ['curl -sSL --output=dl.zip https://x', ['dl.zip']],
  ['curl https://x', []],
  ['wget -O page.html https://x', ['page.html']],
  ['tar -xzf a.tgz -C vendor', ['vendor']],
  ['tar xf a.tar', ['.']],
  ['tar -czf backup.tgz src', []],
  ['tar -czf linux.tgz box', []],
  ['unzip pkg.zip -d lib', ['lib']],
  ['unzip pkg.zip', ['.']],
  ['patch -p1 < fix.diff', ['.']],
  ['git apply fix.diff', ['.']],
  ['git checkout -- src/a.js src/b.js', ['src/a.js', 'src/b.js']],
  ['git checkout main', []],
  ['git restore --staged src/a.js', ['src/a.js']],
  ['git status', []],
  ['git -C . rm specs/002/spec.md', ['specs/002/spec.md']],
  ['git -c x=y mv a b', ['a', 'b']],
  ['git -C specs/002 rm spec.md', ['specs/002/spec.md']],
  ['git -C a -C b rm f', ['a/b/f']],
  ['git -C specs/002 apply fix.diff', ['specs/002']],
  ['git --git-dir=.git --work-tree=. rm f', ['f']],
  ['git --no-pager -c core.x=1 checkout -- src/a.js', ['src/a.js']],
  ['git -C . status', []],
];
for (const [cmd, expected] of cases) {
  test(`${JSON.stringify(cmd)} → ${JSON.stringify(expected)}`, () => {
    assert.deepEqual(bashWriteTargets(cmd), expected);
  });
}

test('known gaps stay undetected (verifier diff check is the backstop)', () => {
  assert.deepEqual(bashWriteTargets('python -c "open(\'x\',\'w\')"'), []);
  assert.deepEqual(bashWriteTargets('node scripts/rewrite.js'), []);
  assert.deepEqual(bashWriteTargets('git stash pop'), []);
});

test('non-string command throws (wrapper then blocks)', () => {
  assert.throws(() => bashWriteTargets(undefined));
});
