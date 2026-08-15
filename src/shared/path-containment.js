'use strict';

const fs = require('node:fs');
const path = require('node:path');

// 事务所内部同一目录常有多种写法：映射盘（net use）、subst 别名、符号链接/junction
// 和 UNC 原始路径。包含判定必须先把两边解析成物理路径再比较，否则
// `Z:\...` 与 `\\主机名\共享\...` 会被误判为两个位置。
//
// realpathSync.native 在逐级向上查找时可能遇到两类错误：
//   - ENOENT：这一级路径还不存在，合理，继续向上找存在的祖先。
//   - 其它（ETIMEDOUT/EACCES/网络类等）：NAS 抖动、权限、网络故障，不代表路径
//     不存在。
//
// 两类都继续向上找——这是本模块存在的理由：只要有任一祖先能解析，映射盘与
// UNC 两种写法就仍能归一化到同一物理路径。遇到非 ENOENT 就地停下会退回字面
// 路径，让本来在项目内的 outDir 被判成越界，等于把 2026-08-06 那次误判换个
// 方向重演一遍。
//
// 但非 ENOENT 也不能当作无事发生：它一旦出现，归一化结果就只是"尽力而为"，
// 调用方不该再对外宣称"两种写法已被视为等价"。因此记下首个此类错误，通过
// ok/error 如实带出，判定照常用归一化后的路径。
function tryCanonicalizePath(inputPath) {
  let base = path.resolve(String(inputPath));
  const pending = [];
  let degradedError = null;
  for (;;) {
    try {
      const real = fs.realpathSync.native(base);
      const resolved = pending.length ? path.join(real, ...pending) : real;
      return { path: resolved, ok: !degradedError, error: degradedError };
    } catch (error) {
      if (error && error.code !== 'ENOENT' && !degradedError) degradedError = error;
      const parent = path.dirname(base);
      if (parent === base) {
        const resolved = pending.length ? path.join(base, ...pending) : base;
        return { path: resolved, ok: !degradedError, error: degradedError };
      }
      pending.unshift(path.basename(base));
      base = parent;
    }
  }
}

// 保留原签名给现有调用方：始终返回字符串，从不抛出，且逐级向上的解析行为与
// 历史实现逐字一致。需要知道归一化过程中有没有出过非 ENOENT 错误的调用方，
// 请改用 tryCanonicalizePath。
function canonicalizePath(inputPath) {
  return tryCanonicalizePath(inputPath).path;
}

function isPathInside(rootDir, targetPath) {
  const relative = path.relative(canonicalizePath(rootDir), canonicalizePath(targetPath));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

module.exports = {
  canonicalizePath,
  tryCanonicalizePath,
  isPathInside,
};
