// 失败态报告加时间戳归档：主文件仍原地覆盖（下游读取方零改动），
// 失败快照另存 <name>.failed-<ts>.json，只保留最近 MAX_FAILED_ARCHIVES 份。
// 背景：2026-08-19 p6-el19 保真失败现场被后续成功构建覆盖，离线复盘断链。
const fs = require('node:fs');
const path = require('node:path');

const MAX_FAILED_ARCHIVES = 3;

function writeReportFile(reportPath, payload, options = {}) {
  const text = JSON.stringify(payload, null, 2);
  fs.writeFileSync(reportPath, text, 'utf8');
  if (!options.failed) return { archivedPath: null };
  const dir = path.dirname(reportPath);
  const ext = path.extname(reportPath) || '.json';
  const base = path.basename(reportPath, ext);
  const stamp = options.stamp || new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  const archivedPath = path.join(dir, `${base}.failed-${stamp}${ext}`);
  fs.writeFileSync(archivedPath, text, 'utf8');
  pruneFailedArchives(dir, base, ext);
  return { archivedPath };
}

function pruneFailedArchives(dir, base, ext) {
  const prefix = `${base}.failed-`;
  const stale = fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(ext))
    .sort()
    .slice(0, -MAX_FAILED_ARCHIVES);
  for (const name of stale) fs.rmSync(path.join(dir, name), { force: true });
}

module.exports = { writeReportFile };
