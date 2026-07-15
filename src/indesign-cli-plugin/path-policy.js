const fs = require('node:fs');
const path = require('node:path');

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

  const relative = path.relative(cwd, outDir);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    const err = new Error(`Output directory must stay inside project cwd: ${outDir}`);
    err.code = 'OUTPUT_OUTSIDE_PROJECT';
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
