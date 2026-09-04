const { lintAuthoringPackage } = require('../../authoring');
const { resolveProjectPath } = require('../path-policy');
const { artifact } = require('../artifacts');
const { lintFailureHint, lintFailureMessage, writeLintFailureReport } = require('../lint-feedback');

async function call(args, context) {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const strict = Boolean(args.strict);
  const lintStartedAt = Date.now();
  const result = await lintAuthoringPackage({
    packagePath,
    strict,
    gridTolerance: args.gridTolerance,
  });
  const lintMs = Date.now() - lintStartedAt;

  const metrics = buildMetrics({
    lint_ms: lintMs,
    error_count: result && result.errorCount,
    warning_count: result && result.warningCount,
    normalized_count: (result && result.normalizedCount) || 0,
    grid_ignored_count: (result && result.gridIgnoredCount) || 0,
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

  return {
    status: 'complete',
    data: result,
    metrics: buildMetrics({ ...metrics, artifacts: 0 }),
    artifacts: [],
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
