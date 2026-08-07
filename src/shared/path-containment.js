'use strict';

const fs = require('node:fs');
const path = require('node:path');

// 事务所内部同一目录常有多种写法：映射盘（net use）、subst 别名、符号链接/junction
// 和 UNC 原始路径。包含判定必须先把两边解析成物理路径再比较，否则
// `Z:\...` 与 `\\主机名\共享\...` 会被误判为两个位置。
function canonicalizePath(inputPath) {
  let base = path.resolve(String(inputPath));
  const pending = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(base);
      return pending.length ? path.join(real, ...pending) : real;
    } catch (_error) {
      const parent = path.dirname(base);
      if (parent === base) return pending.length ? path.join(base, ...pending) : base;
      pending.unshift(path.basename(base));
      base = parent;
    }
  }
}

function isPathInside(rootDir, targetPath) {
  const relative = path.relative(canonicalizePath(rootDir), canonicalizePath(targetPath));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

module.exports = {
  canonicalizePath,
  isPathInside,
};
