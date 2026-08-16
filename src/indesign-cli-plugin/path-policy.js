const fs = require('node:fs');
const path = require('node:path');

const { isPathInside, tryCanonicalizePath } = require('../shared');

function getCwd(context) {
  return path.resolve((context && context.cwd) || process.cwd());
}

function getPluginRoot() {
  return path.resolve(__dirname, '..', '..');
}

function resolveProjectPath(context, inputPath, fieldName) {
  if (!inputPath || typeof inputPath !== 'string') {
    const err = new Error(`${fieldName} must be a non-empty string`);
    err.code = 'INVALID_ARGS';
    throw err;
  }
  return path.resolve(getCwd(context), inputPath);
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function ensureOutputDir(context, requestedOutDir, prefix) {
  const cwd = getCwd(context);
  const outDir = requestedOutDir
    ? path.resolve(cwd, requestedOutDir)
    : path.join(cwd, 'test', 'workspace', `${prefix}-${timestamp()}`);

  if (!isPathInside(cwd, outDir)) {
    // isPathInside 内部会归一化两侧路径再比较，但只回传布尔值。这里再单独
    // 归一化一次（只在即将报错时才付这个代价），把实际参与比较的值和归一化
    // 是否成功一起带出来，否则 agent 只能看到字面路径，判断不出两者到底是
    // 不是同一个位置，也不知道"UNC 与映射盘等价"这句承诺当下是否成立。
    const cwdCanonical = tryCanonicalizePath(cwd);
    const outDirCanonical = tryCanonicalizePath(outDir);
    const degraded = !cwdCanonical.ok || !outDirCanonical.ok;
    const degradedError = (!cwdCanonical.ok && cwdCanonical.error)
      || (!outDirCanonical.ok && outDirCanonical.error)
      || null;

    const messageParts = [
      `Output directory must stay inside project cwd. outDir: ${outDir}; cwd: ${cwd}.`,
      `canonicalOutDir: ${outDirCanonical.path}; canonicalCwd: ${cwdCanonical.path}.`,
      'Run the CLI from the project directory (cd into it) or pass an outDir under it.',
    ];
    if (degraded) {
      const reasonCode = (degradedError && degradedError.code) || 'unknown error';
      messageParts.push(
        `Path canonicalization failed (${reasonCode}); this check fell back to comparing the literal `
        + 'paths above, so the usual UNC/mapped-drive equivalence guarantee could not be verified this '
        + 'time. Confirm the paths manually, or retry once the path is reachable again.',
      );
    } else {
      messageParts.push('UNC and mapped-drive spellings of the same location are treated as equal.');
    }

    const err = new Error(messageParts.join(' '));
    err.code = 'OUTPUT_OUTSIDE_PROJECT';
    err.canonicalCwd = cwdCanonical.path;
    err.canonicalOutDir = outDirCanonical.path;
    err.canonicalizationDegraded = degraded;
    throw err;
  }

  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

module.exports = {
  getCwd,
  getPluginRoot,
  resolveProjectPath,
  ensureOutputDir,
};
