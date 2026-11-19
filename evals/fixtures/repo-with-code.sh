#!/usr/bin/env bash
# A small existing Node project, git repo, no hold-my-dev-specs settings.
set -euo pipefail
git init -q -b main
git config user.email eval@example.com
git config user.name eval
cat > package.json <<'JSON'
{ "name": "greet-demo", "version": "0.0.0", "private": true, "scripts": { "test": "node --test" } }
JSON
cat > index.js <<'JS'
'use strict';
function greet(name) { return `Hello, ${name}!`; }
module.exports = greet;
JS
mkdir -p test
cat > test/greet.test.js <<'JS'
const test = require('node:test');
const assert = require('node:assert/strict');
const greet = require('..');
test('greets by name', () => assert.equal(greet('Ana'), 'Hello, Ana!'));
JS
git add -A && git commit -q -m "chore: start"
