// 作者检查失败时的反馈组装：分类计数、集中判定、指路 hint、报告落盘。
// html.authoring_lint 与 html.build_indesign 共用本模块，保证同一批检查结果两个入口口径一致。
// 设计：docs/superpowers/specs/2026-08-15-authoring-lint-failure-feedback-design.md
const fs = require('node:fs');
const path = require('node:path');

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
  if (options.reportPath) lines.push(`Full report: ${options.reportPath}`);

  return lines.join('\n');
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
  } else {
    const count = classifyLintErrors(lint).total;
    parts.push(reportPath
      ? `完整错误清单见 error.details.errors（${count} 条）与报告文件 ${reportPath}。`
      : `完整错误清单见 error.details.errors（${count} 条）。`);
  }

  return parts.join(' ');
}

// 失败也落报告：离线复盘时这是唯一的材料来源。写盘失败绝不能盖掉真正的 lint 失败。
function writeLintFailureReport(lint, options = {}) {
  try {
    const dir = resolveReportDir(options);
    if (!dir) return null;
    fs.mkdirSync(dir, { recursive: true });
    const reportPath = path.join(dir, REPORT_FILE_NAME);
    fs.writeFileSync(reportPath, JSON.stringify(withoutLintSnapshot(lint), null, 2), 'utf8');
    return reportPath;
  } catch (_error) {
    return null;
  }
}

// 报告里不带浏览器快照：快照体积远大于问题清单，且对定位问题没有帮助。
function withoutLintSnapshot(lint) {
  const { snapshot: _snapshot, ...rest } = lint || {};
  return rest;
}

// 宿主动作失败时，下层已经算好的 code 与真实文本必须保留，不得只报动作 ID。
function underlyingHostFailure(result) {
  if (result && result.error) return result.error;
  const data = result && result.data;
  const errors = data && Array.isArray(data.errors) ? data.errors : [];
  if (errors[0]) return errors[0];
  if (data && data.error) return data.error;
  return { code: null, message: null };
}

function resolveReportDir(options) {
  if (options.outDir) return path.resolve(options.cwd || process.cwd(), options.outDir);
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
function concentrationSentence(classification) {
  if (!classification.concentration) return '';
  const { code } = classification.concentration;
  return `All errors share code ${code} — this is one systemic cause,`
    + ` not ${classification.total} independent fixes.`;
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
  classifyLintErrors,
  isLintShortCircuit,
  lintFailureHint,
  lintFailureMessage,
  underlyingHostFailure,
  withoutLintSnapshot,
  writeLintFailureReport,
};
