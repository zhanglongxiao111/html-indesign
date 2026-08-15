'use strict';

const fs = require('node:fs');
const path = require('node:path');

// 事务所内部同一目录常有多种写法：映射盘（net use）、subst 别名、符号链接/junction
// 和 UNC 原始路径。包含判定必须先把两边解析成物理路径再比较，否则
// `Z:\...` 与 `\\主机名\共享\...` 会被误判为两个位置。
//
// realpathSync.native 在逐级向上查找时可能遇到两类错误：
//   - ENOENT：这一级路径还不存在，合理，继续向上找存在的祖先（原有行为不变）。
//   - 其它（ETIMEDOUT/EACCES/网络类等）：NAS 抖动、权限、网络故障，不代表路径
//     不存在。这类错误不能当成 ENOENT 静默吞掉再假装归一化成功——那正是
//     2026-08-06 那次事故的复现条件。遇到就立即停止归一化，把字面路径和
//     导致失败的原始错误一起带出去，交给调用方决定如何处理。
function tryCanonicalizePath(inputPath) {
  let base = path.resolve(String(inputPath));
  const pending = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(base);
      const resolved = pending.length ? path.join(real, ...pending) : real;
      return { path: resolved, ok: true, error: null };
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        const parent = path.dirname(base);
        if (parent === base) {
          const resolved = pending.length ? path.join(base, ...pending) : base;
          return { path: resolved, ok: true, error: null };
        }
        pending.unshift(path.basename(base));
        base = parent;
        continue;
      }
      const resolved = pending.length ? path.join(base, ...pending) : base;
      return { path: resolved, ok: false, error };
    }
  }
}

// 保留原签名给现有调用方：始终返回字符串，从不抛出。归一化失败时退回字面
// 路径（与历史行为一致），但这只是"尽力而为"的便捷封装——需要知道归一化
// 是否成功、失败原因是什么的调用方，请改用 tryCanonicalizePath。
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
