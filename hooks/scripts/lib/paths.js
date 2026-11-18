'use strict';
// Path helpers: turn a tool's file path into a project-relative path and match it against globs.
// Glob syntax: `**` = any number of folders, `*` = anything inside one folder name, `?` = one character.
// `dir/**` also matches `dir` itself.
const fs = require('fs');
const path = require('path');

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      const atEnd = i + 2 === glob.length;
      const slashAfter = glob[i + 2] === '/';
      if (atEnd) {
        // "a/**" → "a" or anything below it
        if (re.endsWith('/')) re = re.slice(0, -1) + '(?:/.*)?';
        else re += '.*';
        i += 1;
      } else if (slashAfter) {
        re += '(?:.*/)?'; // "**/" → zero or more folders
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

// Project-relative path with forward slashes, or null when the path is outside the project.
function toProjectPath(root, filePath) {
  if (typeof filePath !== 'string' || !filePath) return null;
  const abs = path.resolve(root, filePath);
  const rel = path.relative(path.resolve(root), abs);
  if (rel === '') return '.';
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function matchesAny(relPath, globs) {
  if (!relPath || !Array.isArray(globs)) return false;
  return globs.some((g) => globToRegExp(g).test(relPath));
}

// The real location of a path, with symlinks resolved: the file's own if it exists,
// otherwise its nearest existing parent folder's (for files about to be created).
function realPath(absPath) {
  const missing = [];
  let p = path.resolve(absPath);
  while (!fs.existsSync(p)) {
    const parent = path.dirname(p);
    if (parent === p) break;
    missing.unshift(path.basename(p));
    p = parent;
  }
  const real = fs.existsSync(p) ? fs.realpathSync(p) : p;
  return path.join(real, ...missing);
}

// Project-relative real path (symlinks resolved on both sides), or null when outside the project.
function realProjectPath(root, absPath) {
  return toProjectPath(realPath(root), realPath(absPath));
}

module.exports = { globToRegExp, toProjectPath, matchesAny, realPath, realProjectPath };
