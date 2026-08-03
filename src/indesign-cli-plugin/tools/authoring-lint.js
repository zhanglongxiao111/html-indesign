const { lintAuthoringPackage } = require('../../authoring');
const { resolveProjectPath } = require('../path-policy');

async function call(args, context) {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const lintStartedAt = Date.now();
  const result = await lintAuthoringPackage({
    packagePath,
    strict: Boolean(args.strict),
    gridTolerance: args.gridTolerance,
  });
  const lintMs = Date.now() - lintStartedAt;

  const metrics = buildMetrics({
    lint_ms: lintMs,
    error_count: result && result.errorCount,
    warning_count: result && result.warningCount,
    compatibility_normalized: result && result.compatibility && result.compatibility.summary.normalized,
    compatibility_blocked: result && result.compatibility && result.compatibility.summary.blocked,
  });

  if (result && result.ok === false) {
    return {
      status: 'error',
      error: {
        code: 'AUTHORING_LINT_FAILED',
        message: 'Authoring lint reported errors; fix the package before compiling.',
        stage: 'lint',
        details: { ...result, stage: 'lint', metrics },
      },
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
