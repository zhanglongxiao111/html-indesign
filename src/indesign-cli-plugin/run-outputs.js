'use strict';

// html.build_indesign 在 outDir 里写的交付物与中间产物：开工快照、本轮是否写过、失败收尾（#23）。
//
// 显式 outDir 常被反复复用（例如作者包下的 build/）。上一轮成功留下的 INDD/PDF/IDML 和
// instructions.json 等中间产物，在本轮任一阶段失败后若原样留着，按惯例去 outDir 取 PDF 的
// 人或 Agent 拿到的就是上一轮的成品。三份主报告由 supersedeReports 换成 not-produced 占位；
// 这里管其余文件：
//   1. 开工前给本工具会写的每个文件/目录拍指纹快照（文件 {mtimeMs,size}，目录取整棵树的摘要）。
//      判定只拿同一台文件服务器的数据自己和自己比，不拿工位时钟去比 NAS 时间戳。
//   2. 构建失败时，与快照一致（本轮没写过）的旧文件移进 previous-output/，同名旧副本只留最近一份；
//      本轮写过的文件是失败现场，原位保留供复盘。移不动的（被 InDesign 打开、被锁）原位留下，
//      在返回体 warning 里点名。
//   3. 失败时总在 outDir 写 BUILD_FAILED.json（本次 runId、失败码、移走/没移走的清单）；
//      下一次成功构建把它删掉。所以「outDir 里有 BUILD_FAILED.json」就等于「最近一次构建失败了」。
//   4. 同一份快照也决定成功收尾时哪些交付物算本轮产物（BUILD_ARTIFACTS_MISSING）、
//      导出阶段半途失败时哪些已经落盘（partialArtifacts）。
const crypto = require('node:crypto');
const nodeFs = require('node:fs');
const path = require('node:path');

const { removeFileWithRetrySync, renameWithRetrySync, writeReportFile } = require('../shared');
const { artifact } = require('./artifacts');

const PREVIOUS_OUTPUT_DIR = 'previous-output';
const BUILD_FAILED_MARKER = 'BUILD_FAILED.json';

const PREVIOUS_OUTPUT_MOVED = 'PREVIOUS_OUTPUT_MOVED';
const PREVIOUS_OUTPUT_NOT_MOVED = 'PREVIOUS_OUTPUT_NOT_MOVED';
const BUILD_FAILED_MARKER_NOT_REMOVED = 'BUILD_FAILED_MARKER_NOT_REMOVED';

const DELIVERABLE_KINDS = Object.freeze([
  { kind: 'indd', extension: '.indd', label: 'InDesign document', prefixLabel: 'INDD' },
  { kind: 'pdf', extension: '.pdf', label: 'PDF export', prefixLabel: 'PDF' },
  { kind: 'idml', extension: '.idml', label: 'IDML export', prefixLabel: 'IDML' },
]);

// 主报告不在这里：它们由 supersedeReports 原位换成本次占位，<name>.failed-*.json 归档另有保留策略。
// previews/ 是读回快照阶段导出的置入资源预览，作为一个整体判定、整体移动。
const INTERMEDIATE_OUTPUT_NAMES = Object.freeze([
  'instructions.json',
  'expected-semantic-model.json',
  'expected-semantic-preset.json',
  'fidelity-snapshot.json',
  'build.jsx',
  'fidelity-snapshot.jsx',
  'export.jsx',
  'cleanup.jsx',
  'previews',
]);

// 文件被占用时的重试：比写报告短，lint 失败本来一秒内返回，不值得为一个被 InDesign 打开的 INDD 等太久。
const MOVE_RETRY = Object.freeze({ retries: 3, initialDelayMs: 100 });

function deliverableName(baseName, kind) {
  const entry = DELIVERABLE_KINDS.find((item) => item.kind === kind);
  return `${baseName}${entry.extension}`;
}

// outputBaseName 带路径分隔符时拼出来的不是 outDir 下的直接子项，不纳入管理。
function runOutputNames(baseName) {
  return [
    ...DELIVERABLE_KINDS.map((item) => `${baseName}${item.extension}`),
    ...INTERMEDIATE_OUTPUT_NAMES,
  ].filter((name) => name && path.basename(name) === name);
}

// 目录不存在或没给目录时返回 {}：没有可比的快照，后面既不判 stale 也不移动。
function snapshotRunOutputs(dir, baseName, options = {}) {
  const fs = options.fs || nodeFs;
  if (!dir) return {};
  const snapshot = {};
  for (const name of runOutputNames(baseName)) snapshot[name] = fingerprint(path.join(dir, name), fs);
  return snapshot;
}

function fingerprint(target, fs = nodeFs) {
  let stat;
  try {
    stat = fs.statSync(target, { throwIfNoEntry: false });
  } catch (_) {
    return null;
  }
  if (!stat) return null;
  if (!stat.isDirectory()) return { mtimeMs: stat.mtimeMs, size: stat.size };
  return { tree: treeDigest(target, fs) };
}

function treeDigest(root, fs) {
  const hash = crypto.createHash('sha1');
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      hash.update(`unreadable:${rel}\n`);
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        hash.update(`d:${childRel}\n`);
        walk(full, childRel);
        continue;
      }
      const stat = fingerprint(full, fs);
      hash.update(`f:${childRel}:${stat ? `${stat.mtimeMs}:${stat.size}` : 'gone'}\n`);
    }
  };
  walk(root, '');
  return hash.digest('hex');
}

function sameFingerprint(a, b) {
  if (!a || !b) return a === b;
  if ('tree' in a || 'tree' in b) return a.tree === b.tree;
  return a.mtimeMs === b.mtimeMs && a.size === b.size;
}

// 现在存在、且开工前不存在或与开工前快照不同，才算本轮写出的。
// 没有快照条目（state 不是本插件 call() 产出的）时无从比较，按存在即算。
function writtenThisRun(file, before, options = {}) {
  const now = fingerprint(file, options.fs || nodeFs);
  if (!now) return false;
  if (!before) return true;
  return !sameFingerprint(now, before);
}

function landedDeliverables(dir, baseName, snapshot) {
  if (!dir) return [];
  const before = snapshot || {};
  const landed = [];
  for (const deliverable of DELIVERABLE_KINDS) {
    const name = `${baseName}${deliverable.extension}`;
    if (!writtenThisRun(path.join(dir, name), before[name])) continue;
    landed.push(artifact(deliverable.kind, path.join(dir, name), deliverable.label));
  }
  return landed;
}

// 构建失败收尾。永不抛错：它跑在失败返回的路上，出任何问题都只能变成 warning，不能盖掉真正的失败。
// keep: { [name]: 原因 }，这些文件即使是旧的也不动（例如作者正在 InDesign 里打开的目标 INDD）。
function settleFailedRun(options) {
  const fs = options.fs || nodeFs;
  const { dir, baseName, snapshot, runId, tool } = options;
  if (!dir || !snapshot || typeof snapshot !== 'object') return [];
  try {
    if (!fs.existsSync(dir)) return [];
    const keep = options.keep || {};
    const archiveDir = path.join(dir, PREVIOUS_OUTPUT_DIR);
    const moved = [];
    const notMoved = [];
    for (const name of runOutputNames(baseName)) {
      const before = snapshot[name];
      const source = path.join(dir, name);
      if (!before || !sameFingerprint(fingerprint(source, fs), before)) continue;
      if (keep[name]) {
        notMoved.push({ name, path: source, error: keep[name] });
        continue;
      }
      try {
        moveIntoArchive(source, path.join(archiveDir, name), fs, options.retry);
        moved.push({ name, path: path.join(archiveDir, name) });
      } catch (error) {
        notMoved.push({ name, path: source, error: describeError(error) });
      }
    }
    // 一个都没移成时，别留下刚建出来的空 previous-output/；里面有更早的副本时 rmdir 本来就会失败，正好不动。
    if (!moved.length) {
      try {
        fs.rmdirSync(archiveDir);
      } catch (_) {
        // 不存在或非空：都不需要处理。
      }
    }
    const marker = writeBuildFailedMarker({ dir, archiveDir, moved, notMoved, runId, tool, failure: options.failure });
    return staleOutputWarnings({ archiveDir, moved, notMoved, marker });
  } catch (error) {
    return [{
      code: PREVIOUS_OUTPUT_NOT_MOVED,
      message: `本次构建失败，清理 outDir（${dir}）里上一轮旧文件时出错：${describeError(error)}。`
        + 'outDir 里的交付物和中间产物可能是上一轮的，不要当成本次成品取用或发出。',
      details: { outDir: dir, error: describeError(error) },
    }];
  }
}

function moveIntoArchive(source, target, fs, retry) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // rename 能直接替换同名旧文件，替换不了目录：previous-output/ 里的同名旧副本是目录，
  // 或本次要移的是目录时，先清掉旧副本（只保留最近一份）。
  const existing = fingerprint(target, fs);
  const current = fingerprint(source, fs);
  if (existing && ('tree' in existing || (current && 'tree' in current))) {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  }
  renameWithRetrySync(source, target, { fs, ...MOVE_RETRY, ...(retry || {}), busyCode: 'PREVIOUS_OUTPUT_BUSY' });
}

function writeBuildFailedMarker({ dir, archiveDir, moved, notMoved, runId, tool, failure }) {
  const markerPath = path.join(dir, BUILD_FAILED_MARKER);
  try {
    writeReportFile(markerPath, {
      ok: false,
      status: 'build-failed',
      errorCode: (failure && failure.code) || null,
      stage: (failure && failure.stage) || null,
      note: `本次构建（${runId}）失败，这个目录里没有可交付的成品。`
        + '上一轮留下、本次没有重写的交付物和中间产物已移到 previous-output/；'
        + 'notMoved 里的文件没能移走，仍在原位，但它们不是本次的结果。'
        + '本次写出的文件（如有）是失败现场，只供复盘。下一次构建成功时本文件会被删除。',
      previousOutputDir: archiveDir,
      moved: moved.map((item) => item.name),
      notMoved: notMoved.map((item) => ({ name: item.name, path: item.path, error: item.error })),
    }, { runId, tool });
    return { path: markerPath, error: null };
  } catch (error) {
    return { path: null, attemptedPath: markerPath, error: describeError(error) };
  }
}

function staleOutputWarnings({ archiveDir, moved, notMoved, marker }) {
  const warnings = [];
  const markerDetails = marker.error
    ? { markerPath: null, markerWriteError: `${marker.attemptedPath}: ${marker.error}` }
    : { markerPath: marker.path };
  if (moved.length) {
    const names = moved.map((item) => item.name);
    warnings.push({
      code: PREVIOUS_OUTPUT_MOVED,
      message: `本次构建失败。outDir 里 ${names.length} 个上一轮留下、本次没有重写的文件已移到 ${archiveDir}：`
        + `${names.join('、')}。它们不是本次的结果；previous-output/ 里同名旧副本只保留最近一份。`,
      details: { previousOutputDir: archiveDir, files: names, ...markerDetails },
    });
  }
  if (notMoved.length) {
    warnings.push({
      code: PREVIOUS_OUTPUT_NOT_MOVED,
      message: `本次构建失败，但 outDir 里 ${notMoved.length} 个上一轮留下的旧文件没能移走，仍在原位：`
        + `${notMoved.map((item) => `${item.path}（${item.error}）`).join('；')}。`
        + '它们不是本次的结果，不要当成本次成品取用或发出。',
      details: {
        files: notMoved.map((item) => ({ name: item.name, path: item.path, error: item.error })),
        ...markerDetails,
      },
    });
  }
  return warnings;
}

// 构建成功收尾：上一次失败留下的 BUILD_FAILED.json 已经不成立，删掉；删不掉就报出来。
function clearBuildFailedMarker(dir, options = {}) {
  if (!dir) return [];
  const markerPath = path.join(dir, BUILD_FAILED_MARKER);
  try {
    removeFileWithRetrySync(markerPath, { fs: options.fs || nodeFs, ...MOVE_RETRY, ...(options.retry || {}) });
    return [];
  } catch (error) {
    return [{
      code: BUILD_FAILED_MARKER_NOT_REMOVED,
      message: `本次构建成功，但没能删除上一次失败留下的 ${markerPath}（${describeError(error)}）。`
        + '那份标记说的是更早的一次失败，以本次返回体为准；可以手动删除它。',
      details: { markerPath, error: describeError(error) },
    }];
  }
}

function describeError(error) {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  if (error.details && error.details.lastErrorCode) {
    return `${error.details.lastErrorCode}: 重试 ${error.details.attempts} 次后仍被占用`;
  }
  return `${error.code ? `${error.code}: ` : ''}${error.message || String(error)}`;
}

module.exports = {
  BUILD_FAILED_MARKER,
  BUILD_FAILED_MARKER_NOT_REMOVED,
  DELIVERABLE_KINDS,
  PREVIOUS_OUTPUT_DIR,
  PREVIOUS_OUTPUT_MOVED,
  PREVIOUS_OUTPUT_NOT_MOVED,
  clearBuildFailedMarker,
  deliverableName,
  landedDeliverables,
  settleFailedRun,
  snapshotRunOutputs,
  writtenThisRun,
};
