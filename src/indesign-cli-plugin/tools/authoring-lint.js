const { lintAuthoringPackage } = require('../../authoring');
const { resolveProjectPath } = require('../path-policy');
const { artifact } = require('../artifacts');
const {
  lintFailureHint, lintFailureMessage, writeLintFailureReport, writeLintReport,
} = require('../lint-feedback');

async function call(args, context) {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const strict = Boolean(args.strict);
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
    });
    const reportPath = report.path;
    const hint = lintFailureHint(result, { reportPath });
    return {
      status: 'error',
      error: {
        code: 'AUTHORING_LINT_FAILED',
        message: lintFailureMessage(result, { strict, reportPath }),
        stage: 'lint',
        retryable: false,
        hint,
        // 宿主侧当前只读 details，hint/retryable/stage 冗余落一份是保险，不是重复。
        details: {
          ...result,
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
  // 目标目录全是空的。不传 outDir 时维持原状：不给没要产物的调用凭空写文件。
  const report = args.outDir
    ? writeLintReport(result, {
      outDir: args.outDir,
      cwd: context && context.cwd,
      packagePath,
    })
    : { path: null, error: null };

  return {
    status: 'complete',
    data: {
      ...result,
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
