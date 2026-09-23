// 作者检查失败时的反馈组装：分类计数、集中判定、指路 hint、报告落盘。
// html.authoring_lint 与 html.build_indesign 共用本模块，保证同一批检查结果两个入口口径一致。
// 设计：docs/superpowers/specs/2026-08-15-authoring-lint-failure-feedback-design.md
const fs = require('node:fs');
const path = require('node:path');

const { isPathInside } = require('../shared');
const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const { writeReportFile } = require('./report-archive');

const MAX_LISTED_CODES = 3;
const CONCENTRATION_RATIO = 0.8;
const OTHER_CODE = 'other';
const REPORT_FILE_NAME = 'authoring-lint-report.json';
const FALLBACK_REPORT_DIR = '.indesign-cli';

// 这些 code 由 src/authoring/lint.js 的前置短路产生：真实规则检查根本没有执行，
// 此时 errorCount 只是短路本身的条数，不能被当成"还剩几个问题"。
const SHORT_CIRCUIT_CODES = new Set(['AUTHOR_GENERATED_ENTRY_DIRTY']);

function lintErrors(lint) {
  return Array.isArray(lint && lint.errors) ? lint.errors.filter(Boolean) : [];
}

function isLintShortCircuit(lint) {
  return lintErrors(lint).some((entry) => SHORT_CIRCUIT_CODES.has(entry.code));
}

// 分类计数由既有 errors[].code 聚合得到，不新增第二套诊断字段。
function classifyLintErrors(lint) {
  const errors = lintErrors(lint);
  const total = Number.isFinite(Number(lint && lint.errorCount))
    ? Number(lint.errorCount)
    : errors.length;

  const codeCounts = countBy(errors, (entry) => entry.code || OTHER_CODE);
  const ranked = [...codeCounts.entries()].sort((left, right) => right[1] - left[1]);
  const listed = collapseTail(ranked, MAX_LISTED_CODES);

  const top = ranked[0] || null;
  const concentration = top && total > 0 && top[0] !== OTHER_CODE && top[1] / total >= CONCENTRATION_RATIO
    ? { code: top[0], count: top[1], ratio: top[1] / total }
    : null;

  const pages = [...countBy(errors, (entry) => entry.pageId).entries()]
    .sort((left, right) => String(left[0]).localeCompare(String(right[0]), 'en', { numeric: true }));
  const edges = [...countBy(errors, (entry) => entry.edges).entries()]
    .sort((left, right) => right[1] - left[1]);

  return { total, byCode: ranked, listed, concentration, pages, edges };
}

function lintFailureMessage(lint, options = {}) {
  if (isLintShortCircuit(lint)) return shortCircuitMessage(lint);

  const classification = classifyLintErrors(lint);
  const lines = [headline(classification, options.strict !== false)];

  const context = [concentrationSentence(classification), distributionSentence(classification)]
    .filter(Boolean)
    .join(' ');
  if (context) lines.push(context);

  const firstIssue = firstIssueSentence(lint);
  if (firstIssue) lines.push(firstIssue);
  const fixes = fixExamplesSentence(lint, options);
  if (fixes) lines.push(fixes);
  const exemptions = gridExemptionSentence(lint);
  if (exemptions) lines.push(exemptions);
  if (options.reportPath) lines.push(`Full report: ${options.reportPath}`);

  return lines.join('\n');
}

const MAX_FIX_EXAMPLES = 3;
const FIX_EXAMPLE_LENGTH_LIMIT = 220;

// "系统性成因"只回答"是不是一处改法"，不回答"怎么改"。带 suggestedFix 的条目
// 直接给前三条，Agent 不用先去翻完整报告才能动手。
function fixExamplesSentence(lint, options = {}) {
  const carriers = lintErrors(lint).filter((entry) => typeof entry.suggestedFix === 'string' && entry.suggestedFix.trim());
  if (!carriers.length) return '';
  const ordered = fixCarriersByRelevance(carriers, classifyLintErrors(lint).concentration);
  const examples = ordered.slice(0, MAX_FIX_EXAMPLES).map((entry) => {
    const location = [entry.pageId, entry.itemId].filter(Boolean).join(' / ');
    return `${location ? `${location}: ` : ''}${clampFixExample(entry.suggestedFix.trim())}`;
  });
  const rest = carriers.length - MAX_FIX_EXAMPLES;
  const more = rest > 0
    ? (isSummaryFormat(options)
      ? ` (+${rest} more: errors[].suggestedFix in the full report)`
      : ` (+${rest} more in error.details.errors[].suggestedFix)`)
    : '';
  return `Fix examples: ${examples.join(' | ')}${more}`;
}

// 上一句刚点名"这是一处系统性成因"，示例却按文件顺序取前三条，很可能三条都来自
// 那个零散的少数派 code —— Agent 照着改完再跑，集中的那批一条没动。集中成因存在
// 时示例必须先出自它，剩下的按文件顺序垫后。
function fixCarriersByRelevance(carriers, concentration) {
  if (!concentration) return carriers;
  const preferred = carriers.filter((entry) => entry.code === concentration.code);
  if (!preferred.length) return carriers;
  return [...preferred, ...carriers.filter((entry) => entry.code !== concentration.code)];
}

// 首条消息是"扫一眼就能动手"，不是完整报告：单条修法本身可以很长（逐边位移清单 +
// 成因 + 兜底豁免写法），三条不限长就会把 Full report 那行挤出视野。截断处留 …，
// 原文仍在 error.details.errors[].suggestedFix 里。
function clampFixExample(text) {
  return text.length > FIX_EXAMPLE_LENGTH_LIMIT ? `${text.slice(0, FIX_EXAMPLE_LENGTH_LIMIT)}…` : text;
}

// 整包豁免不能静默：Agent 和人都要看见这个包已经豁免了多少元素。
// 文案要点明"含继承"：计数本来就把祖先带 data-id-grid-ignore 的条目算在内
// （isGridIgnored → hasInheritedGridIgnore），只说"carry"会让人以为要逐个元素去找属性。
function gridExemptionSentence(lint) {
  const count = Number(lint && lint.gridIgnoredCount) || 0;
  if (!count) return '';
  return `Grid exemptions already in this package: ${count} item(s) are exempt from grid checks`
    + ` via ${HTML_DATA_ID_ATTRIBUTES.GRID_IGNORE} (own or inherited).`;
}

// 顶层 hint 恒为 null 视为缺陷：完整清单在别处时必须写明去哪里看。
// 下层错误自带 hint（例如 AUTHOR_GENERATED_ENTRY_DIRTY 带着完整重组装命令）时优先上浮。
function lintFailureHint(lint, options = {}) {
  const reportPath = options.reportPath || null;
  const parts = [];

  const upliftedHint = firstErrorHint(lint);
  if (upliftedHint) parts.push(upliftedHint);

  if (isLintShortCircuit(lint)) {
    parts.push('本次是前置短路返回，作者规则检查尚未执行，errorCount 不代表真实问题数量；'
      + '按上面的命令重新组装作者包后重跑才能拿到完整清单。');
    if (reportPath) parts.push(`本次短路结果已写入 ${reportPath}。`);
  } else if (isSummaryFormat(options) && reportPath) {
    const count = classifyLintErrors(lint).total;
    parts.push(`返回体只含摘要（topCodes、firstErrors 前 ${MAX_FIRST_ERRORS} 条）；`
      + `完整错误清单（${count} 条）见报告文件 ${reportPath} 的 errors 数组，`
      + '先核对报告顶层 runId 与本次返回一致；确需在返回体里拿完整数组时传 format:"full"。');
  } else {
    const count = classifyLintErrors(lint).total;
    parts.push(reportPath
      ? `完整错误清单见 error.details.errors（${count} 条）与报告文件 ${reportPath}。`
      : `完整错误清单见 error.details.errors（${count} 条）。`);
  }

  return parts.join(' ');
}

// 失败也落报告：离线复盘时这是唯一的材料来源。
//
// 两条纪律：
//   1. 写盘失败绝不能盖掉真正的 lint 失败——所以这里吞掉自己的异常，不外抛；
//   2. 但"吞掉"不等于"不留痕"。返回 { path, error }，让调用方把失败原因放进
//      details.reportWriteError，否则就是本轮在修的那个毛病自己再犯一遍。
// failed=true 的调用额外留一份带时间戳的失败快照（见 report-archive.js）；
// 通过态只覆盖主文件，不归档——通过的检查没有需要事后复盘的现场。
//
// options.onlyIfExists：目标位置已有旧报告时才写（用来盖掉上一轮留下的旧结论），
// 没有就不凭空造文件——full 格式通过且未传 outDir 时沿用「不给没要产物的调用写文件」。
function writeLintReport(lint, options = {}) {
  try {
    const dir = resolveReportDir(options);
    if (!dir) return { path: null, error: null };
    const reportPath = path.join(dir, REPORT_FILE_NAME);
    if (options.onlyIfExists && !fs.existsSync(reportPath)) return { path: null, error: null };
    fs.mkdirSync(dir, { recursive: true });
    const { archivedPath } = writeReportFile(reportPath, withoutLintSnapshot(lint), {
      failed: Boolean(options.failed),
      runId: options.runId,
      tool: options.tool,
    });
    return { path: reportPath, archivedPath, error: null };
  } catch (error) {
    return { path: null, error: describeReportWriteError(error) };
  }
}

function writeLintFailureReport(lint, options = {}) {
  return writeLintReport(lint, { ...options, failed: true });
}

function describeReportWriteError(error) {
  if (!error) return 'unknown error';
  const code = error.code ? `${error.code}: ` : '';
  return `${code}${error.message || String(error)}`;
}

// 报告里不带浏览器快照：快照体积远大于问题清单，且对定位问题没有帮助。
function withoutLintSnapshot(lint) {
  const { snapshot: _snapshot, ...rest } = lint || {};
  return rest;
}

// ---- 返回体格式（#13 P1-1）----
// summary（默认）：返回体只带计数、按 code 聚合的分布和前三条错误，完整数组只在报告文件里。
// 一次 lint 的完整返回有 76–85KB，Agent 整块读进上下文或被截断落盘，为读自己的输出
// 额外写解析脚本十几次（8/6 事故）。full：保持原来的完整返回。
const LINT_FORMATS = Object.freeze(['summary', 'full']);
const DEFAULT_LINT_FORMAT = 'summary';
const MAX_FIRST_ERRORS = 3;
const MAX_TOP_CODES = 5;
const SUMMARY_TEXT_LIMIT = 500;

function resolveLintFormat(value) {
  return LINT_FORMATS.includes(value) ? value : DEFAULT_LINT_FORMAT;
}

// 模块内的文案函数默认按 full 口径（指向 error.details.errors）；工具层显式传 format。
function isSummaryFormat(options) {
  return Boolean(options) && options.format === 'summary';
}

function lintSummary(lint, extra = {}) {
  const errors = lintErrors(lint);
  const warnings = Array.isArray(lint && lint.warnings) ? lint.warnings.filter(Boolean) : [];
  return {
    ok: Boolean(lint && lint.ok),
    format: 'summary',
    errorCount: countOf(lint && lint.errorCount, errors.length),
    warningCount: countOf(lint && lint.warningCount, warnings.length),
    topCodes: topCodes(errors, warnings),
    firstErrors: errors.slice(0, MAX_FIRST_ERRORS).map(compactIssue),
    reportPath: extra.reportPath || null,
    runId: extra.runId || null,
  };
}

function countOf(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// 错误在前、警告在后，各自按条数降序；总数封顶，剩下的看 errorCount/warningCount 与报告。
function topCodes(errors, warnings) {
  const ranked = (entries, level) => [...countBy(entries, (entry) => entry.code || OTHER_CODE).entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([code, count]) => ({ code, level, count }));
  return [...ranked(errors, 'error'), ...ranked(warnings, 'warning')].slice(0, MAX_TOP_CODES);
}

// 只留能直接动手的定位与修法；逐边偏移、块归属等明细在报告里。
function compactIssue(entry) {
  const picked = {};
  for (const key of ['code', 'pageId', 'itemId', 'message', 'suggestedFix', 'hint']) {
    const value = entry && entry[key];
    if (typeof value === 'string' && value) picked[key] = clampSummaryText(value);
  }
  return picked;
}

function clampSummaryText(text) {
  return text.length > SUMMARY_TEXT_LIMIT ? `${text.slice(0, SUMMARY_TEXT_LIMIT)}…` : text;
}

// summary 的前提是完整清单已经落进报告。报告写不成（越界 outDir、磁盘错误）时
// 退回完整返回，并显式标出退回原因——不能让清单两头都拿不到。
function effectiveLintFormat(requested, reportPath) {
  return requested === 'summary' && !reportPath ? 'full' : requested;
}

function lintResponseBody(result, { format, requestedFormat, reportPath, runId }) {
  if (format === 'summary') return lintSummary(result, { reportPath, runId });
  return {
    ...result,
    ...(requestedFormat === 'summary'
      ? { format: 'full', formatFallback: 'summary requested but the report file was not written; returning the full lint payload.' }
      : {}),
  };
}

// 宿主动作失败时，下层已经算好的 code 与真实文本必须保留，不得只报动作 ID。
function underlyingHostFailure(result) {
  if (result && result.error) return unwrapSerializedHostError(result.error);
  const data = result && result.data;
  const errors = data && Array.isArray(data.errors) ? data.errors : [];
  if (errors[0]) return errors[0];
  if (data && data.error) return unwrapSerializedHostError(data.error);
  if (data && data.code && data.message) return { code: data.code, message: data.message };
  return { code: null, message: null };
}

// CLI 的 script.run 遇到 ok:false 且没有顶层 message 的脚本结果时，会把整段
// JSON 当作 error.message。这里把首条结构化错误解回来，原文放 hostResult。
function unwrapSerializedHostError(error) {
  const message = error && typeof error.message === 'string' ? error.message.trim() : '';
  if (!message.startsWith('{')) return error;
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch (_) {
    return error;
  }
  const first = parsed && Array.isArray(parsed.errors) ? parsed.errors[0] : null;
  if (!first || !first.message) return error;
  return { ...error, code: first.code || error.code, message: first.message, hostResult: parsed };
}

// outDir 是 Agent 可控参数，必须和其他吃 outDir 的工具受同一道围栏约束。
// 报告写盘是本轮新增的写入点，若不校验就等于给 OUTPUT_OUTSIDE_PROJECT 开了个
// 后门，而且越界写出的路径还会作为 artifacts 回给 Agent，把越界正常化。
// 这里不抛错——报告只是辅助材料，不该盖掉真正的 lint 失败；越界就不写，
// 由 writeLintFailureReport 把原因带回 details。
function resolveReportDir(options) {
  const cwd = path.resolve(options.cwd || process.cwd());
  if (options.outDir) {
    const resolved = path.resolve(cwd, options.outDir);
    if (!isPathInside(cwd, resolved)) {
      const error = new Error(`outDir must stay inside project cwd: ${resolved}`);
      error.code = 'OUTPUT_OUTSIDE_PROJECT';
      throw error;
    }
    return resolved;
  }
  if (options.packagePath) {
    return path.join(path.dirname(path.resolve(options.packagePath)), FALLBACK_REPORT_DIR);
  }
  return null;
}

function headline(classification, strict) {
  const { total } = classification;
  const prefix = `${strict ? 'Strict authoring' : 'Authoring'} checks found ${total} error${total === 1 ? '' : 's'}`;
  const codeSummary = classification.listed.map(([code, count]) => `${code}: ${count}`).join(', ');
  return codeSummary ? `${prefix} (${codeSummary}).` : `${prefix}.`;
}

// 只给总数无法区分「多处独立问题」和「单一系统性成因」，高度集中时必须显式点明。
//
// 措辞必须随集中度变化：阈值是 80%，"All errors share code X" 只在 100% 时
// 成立。9:1 的情况下说"全部同一类、不是 10 处独立修改"，会让 Agent 以为调一次
// 容差就能清零，漏掉剩下那一条——而这批改动的主题正是不许首条消息误导 Agent。
function concentrationSentence(classification) {
  if (!classification.concentration) return '';
  const { code, count } = classification.concentration;
  const { total } = classification;
  if (count === total) {
    return `All ${total} errors share code ${code} — this is one systemic cause,`
      + ` not ${total} independent fixes.`;
  }
  const rest = total - count;
  return `${count} of ${total} errors share code ${code} — treat those as one systemic cause,`
    + ` then handle the remaining ${rest} separately.`;
}

function distributionSentence(classification) {
  const parts = [];
  if (classification.pages.length) {
    parts.push(`Affected: ${classification.pages.map(([id, count]) => `${id} (${count})`).join(', ')}`);
  }
  if (classification.edges.length) {
    parts.push(`edges ${classification.edges.map(([edge]) => edge).join('/')}`);
  }
  return parts.length ? `${parts.join('; ')}.` : '';
}

function firstIssueSentence(lint) {
  const errors = lintErrors(lint);
  const first = errors.find((entry) => entry.pageId || entry.itemId) || errors[0] || {};
  if (!first.message) return '';
  const location = [first.pageId, first.itemId].filter(Boolean).join(' / ');
  return `First issue${location ? ` at ${location}` : ''}: ${first.message}`;
}

function firstErrorHint(lint) {
  const carrier = lintErrors(lint).find((entry) => typeof entry.hint === 'string' && entry.hint.trim());
  return carrier ? carrier.hint.trim() : null;
}

function shortCircuitMessage(lint) {
  const entry = lintErrors(lint).find((item) => SHORT_CIRCUIT_CODES.has(item.code)) || {};
  const lines = [`Authoring lint did not run: ${shortCircuitReason(entry)}.`];
  const command = reassembleCommand(entry.hint);
  if (command) lines.push(`Reassemble the package and retry: ${command}`);
  return lines.join('\n');
}

function shortCircuitReason(entry) {
  let text = String(entry.message || 'the generated entry file is out of date');
  if (entry.code && text.startsWith(`${entry.code}: `)) text = text.slice(entry.code.length + 2);
  if (entry.entryPath && text.endsWith(`: ${entry.entryPath}`)) {
    text = text.slice(0, text.length - entry.entryPath.length - 2);
  }
  return text.replace(/[.。]+$/, '').trim();
}

// 下层 hint 是「中文引导语 + 可直接执行的命令」，首条消息只取命令部分。
function reassembleCommand(hint) {
  if (typeof hint !== 'string' || !hint.trim()) return null;
  const start = hint.indexOf('& "');
  return start >= 0 ? hint.slice(start).trim() : hint.trim();
}

function countBy(entries, pick) {
  const counts = new Map();
  for (const entry of entries) {
    const value = pick(entry);
    const keys = Array.isArray(value) ? value : [value];
    for (const key of keys) {
      if (key === null || key === undefined || key === '') continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function collapseTail(ranked, limit) {
  if (ranked.length <= limit) return ranked.map(([code, count]) => [code, count]);
  const listed = ranked.slice(0, limit).map(([code, count]) => [code, count]);
  const rest = ranked.slice(limit).reduce((sum, [, count]) => sum + count, 0);
  listed.push([OTHER_CODE, rest]);
  return listed;
}

module.exports = {
  DEFAULT_LINT_FORMAT,
  LINT_FORMATS,
  MAX_FIRST_ERRORS,
  classifyLintErrors,
  effectiveLintFormat,
  isLintShortCircuit,
  lintFailureHint,
  lintFailureMessage,
  lintResponseBody,
  lintSummary,
  resolveLintFormat,
  underlyingHostFailure,
  withoutLintSnapshot,
  writeLintFailureReport,
  writeLintReport,
};
