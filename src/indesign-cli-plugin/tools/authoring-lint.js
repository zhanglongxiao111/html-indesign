const { lintAuthoringPackage } = require('../../authoring');
const { resolveProjectPath } = require('../path-policy');
const { artifact } = require('../artifacts');
const { runIdOf } = require('../run-context');
const {
  effectiveLintFormat, lintFailureHint, lintFailureMessage, lintResponseBody, resolveLintFormat,
  writeLintFailureReport, writeLintReport,
} = require('../lint-feedback');

const TOOL_ID = 'html.authoring_lint';

async function call(args, context) {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const strict = Boolean(args.strict);
  const runId = runIdOf(context, TOOL_ID);
  const requestedFormat = resolveLintFormat(args.format);
  const lintStartedAt = Date.now();
  const result = await lintAuthoringPackage({
    packagePath,
    strict,
    gridTolerance: args.gridTolerance,
    lintProfile: args.lintProfile,
  });
  const lintMs = Date.now() - lintStartedAt;

  const metrics = buildMetrics({
    lint_ms: lintMs,
    error_count: result && result.errorCount,
    warning_count: result && result.warningCount,
    normalized_count: (result && result.normalizedCount) || 0,
    grid_ignored_count: (result && result.gridIgnoredCount) || 0,
    grid_observed_downgraded_count: (result && result.gridObservedDowngradedCount) || 0,
    grid_off_count: (result && result.gridOffCount) || 0,
    grid_block_off_count: (result && result.gridBlockOffCount) || 0,
    grid_checked_count: (result && result.gridCheckedCount) || 0,
    grid_shielded_count: (result && result.gridShieldedCount) || 0,
    grid_skipped_count: (result && result.gridSkippedCount) || 0,
    grid_block_checked_count: (result && result.gridBlockCheckedCount) || 0,
    grid_block_skipped_count: (result && result.gridBlockSkippedCount) || 0,
    compatibility_normalized: result && result.compatibility && result.compatibility.summary.normalized,
    compatibility_blocked: result && result.compatibility && result.compatibility.summary.blocked,
  });

  if (result && result.ok === false) {
    const report = writeLintFailureReport(result, {
      outDir: args.outDir,
      cwd: context && context.cwd,
      packagePath,
      runId,
      tool: TOOL_ID,
    });
    const reportPath = report.path;
    const format = effectiveLintFormat(requestedFormat, reportPath);
    const hint = lintFailureHint(result, { reportPath, format });
    return {
      status: 'error',
      error: {
        code: 'AUTHORING_LINT_FAILED',
        message: lintFailureMessage(result, { strict, reportPath, format }),
        stage: 'lint',
        retryable: false,
        hint,
        // 宿主侧当前只读 details，hint/retryable/stage 冗余落一份是保险，不是重复。
        details: {
          ...lintResponseBody(result, { format, requestedFormat, reportPath, runId }),
          stage: 'lint',
          hint,
          retryable: false,
          reportPath,
          // 报告没写成时留痕：静默吞掉就是本轮在修的那个毛病自己再犯一遍。
          ...(report.error ? { reportWriteError: report.error } : {}),
          metrics,
        },
      },
      artifacts: reportPath ? [artifact('json', reportPath, 'Authoring lint report')] : [],
    };
  }

  // 通过时也按 outDir 落一份报告。只在失败路径写，会让显式指定了输出目录的调用方
  // 对着一个空目录猜参数是不是没生效——0.5.12 上「带 outDir 且通过」的调用有 51 次，
  // 目标目录全是空的。
  // summary 格式把完整清单只放在报告里，所以不传 outDir 也必须写（落作者包下的 .indesign-cli/）。
  // full 格式不传 outDir 时维持原状，不凭空写文件；但那里若躺着上一轮的旧报告（例如上次失败），
  // 必须用本次结果盖掉，否则读报告的人会拿到与本次相反的结论（#13 P1-2）。
  const report = writeLintReport(result, {
    outDir: args.outDir,
    cwd: context && context.cwd,
    packagePath,
    runId,
    tool: TOOL_ID,
    onlyIfExists: !args.outDir && requestedFormat === 'full',
  });
  const format = effectiveLintFormat(requestedFormat, report.path);

  return {
    status: 'complete',
    data: {
      ...lintResponseBody(result, { format, requestedFormat, reportPath: report.path, runId }),
      reportPath: report.path,
      // 写不成时留痕，不静默：这正是本轮在修的毛病。
      ...(report.error ? { reportWriteError: report.error } : {}),
    },
    metrics: buildMetrics({ ...metrics, artifacts: report.path ? 1 : 0 }),
    artifacts: report.path ? [artifact('json', report.path, 'Authoring lint report')] : [],
  };
}

function buildMetrics(values) {
  const metrics = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (typeof value === 'number' && Number.isFinite(value)) metrics[key] = value;
    else if (typeof value === 'boolean') metrics[key] = value;
  }
  return metrics;
}

module.exports = {
  call,
};
