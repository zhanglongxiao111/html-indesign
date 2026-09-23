// 插件报告的唯一写入口：lint 报告、保真报告、编译摘要都从这里落盘。
//
// 1. 顶层统一写 runId / generatedAt / tool（#13 P1-2）。Agent 读报告前拿工具返回体里的
//    runId 核对，对不上就是别的运行留下的，不能据此下结论。
// 2. 主文件永远是本次结果：成功写成功内容，失败写失败内容，本次没走到的阶段由
//    supersedeReports 写一份「本次未产出」占位盖掉上一轮的旧文件。
// 3. 失败态另存 <name>.failed-<ts>.json，只保留最近 MAX_FAILED_ARCHIVES 份。
//    背景：2026-08-19 p6-el19 保真失败现场被后续成功构建覆盖，离线复盘断链。
const fs = require('node:fs');
const path = require('node:path');

const MAX_FAILED_ARCHIVES = 3;

function reportHeader(options) {
  const runId = options && options.runId;
  const tool = options && options.tool;
  // 没有 runId 的报告正是本轮要消灭的东西：宁可写不成（调用方会把原因带回返回体），
  // 也不写一份无法与本次调用核对的报告。
  if (!runId || !tool) {
    const error = new Error('report header requires runId and tool');
    error.code = 'REPORT_HEADER_MISSING';
    throw error;
  }
  return { runId, generatedAt: new Date().toISOString(), tool };
}

function writeReportFile(reportPath, payload, options = {}) {
  const header = reportHeader(options);
  const text = JSON.stringify({ ...header, ...withoutHeader(payload) }, null, 2);
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

// 本次运行开始时，把目录里已有的主报告换成「本次未产出」占位。
// 运行走到哪个阶段，哪个阶段就用真实内容覆盖占位；没走到的阶段留着占位，
// 读到它的人看得到 runId 与本次一致、status 是 not-produced，不会把上一轮的 valid:true 当成本次结论。
// 只处理已存在的文件：目录里本来没有的报告不凭空造出来。
function supersedeReports(dir, fileNames, options = {}) {
  const header = reportHeader(options);
  const superseded = [];
  for (const name of fileNames) {
    const reportPath = path.join(dir, name);
    if (!fs.existsSync(reportPath)) continue;
    fs.writeFileSync(reportPath, JSON.stringify({
      ...header,
      ok: false,
      status: 'not-produced',
      note: `本次运行（${header.runId}）没有产出这份报告：运行在更早的阶段停止或尚未走到这一步。`
        + '上一轮留下的内容已作废，以本次工具返回体为准。',
    }, null, 2), 'utf8');
    superseded.push(reportPath);
  }
  return superseded;
}

// 载荷自带的同名字段不得盖掉本次写入的标识。
function withoutHeader(payload) {
  const { runId: _runId, generatedAt: _generatedAt, tool: _tool, ...rest } = payload || {};
  return rest;
}

function pruneFailedArchives(dir, base, ext) {
  const prefix = `${base}.failed-`;
  const stale = fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(ext))
    .sort()
    .slice(0, -MAX_FAILED_ARCHIVES);
  for (const name of stale) fs.rmSync(path.join(dir, name), { force: true });
}

module.exports = { supersedeReports, writeReportFile };
