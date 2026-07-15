const fs = require('node:fs');
const path = require('node:path');

const { reverseSnapshotToSemanticModel } = require('../../adapters/indesign');
const { lintAuthoringPackage, readAuthorPackage } = require('../../authoring');
const { auditForwardFidelity } = require('../../semantic-model');
const { resolveSemanticPreset } = require('../../semantic-preset');
const { compileAuthoringPackage } = require('./compile-instructions');
const { getPluginRoot } = require('../path-policy');
const { resolveProjectPath } = require('../path-policy');
const { artifact } = require('../artifacts');
const {
  buildBuildJsx,
  buildCloseJsx,
  buildExportJsx,
  buildReverseSnapshotJsx,
} = require('../host-jsx');

const STAGE_ERROR_CODES = Object.freeze({
  build: 'INDESIGN_BUILD_FAILED',
  snapshot: 'INDESIGN_SNAPSHOT_FAILED',
  export: 'INDESIGN_EXPORT_FAILED',
  verify: 'EXPORT_VERIFY_FAILED',
  cleanup: 'BUILD_DOCUMENT_CLOSE_FAILED',
});

async function call(args, context) {
  const mode = args.mode || 'final';
  if (!['final', 'draft'].includes(mode)) {
    const error = new Error(`mode must be final or draft, received: ${mode}`);
    error.code = 'INVALID_ARGS';
    throw error;
  }
  const outputBaseName = args.outputBaseName || 'html-indesign-output';
  const timeout = args.timeout || 300;
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const sourcePackage = readAuthorPackage(packagePath);
  const resolvedPreset = resolveSemanticPreset({
    rootDir: sourcePackage.rootDir,
    config: sourcePackage.config,
  });
  const lintStartedAt = Date.now();
  const lint = await lintAuthoringPackage({
    packagePath,
    strict: true,
    gridTolerance: args.gridTolerance,
    includeSnapshot: true,
  });
  const lintMs = Date.now() - lintStartedAt;
  if (!lint.ok) {
    const error = new Error('Strict authoring checks failed; fix the reported HTML issues before building.');
    error.code = 'AUTHORING_LINT_FAILED';
    error.details = withoutSnapshot(lint);
    throw error;
  }

  const compileStartedAt = Date.now();
  const compile = await compileAuthoringPackage({
    ...args,
    outputName: 'instructions.json',
  }, context, 'html-plugin-build', {
    snapshot: lint.snapshot,
    expectedModelName: 'expected-semantic-model.json',
  });
  const compileMs = Date.now() - compileStartedAt;

  const pluginRoot = getPluginRoot();
  const runMarker = createRunMarker();
  const buildScriptPath = path.join(compile.outDir, 'build.jsx');
  const snapshotScriptPath = path.join(compile.outDir, 'fidelity-snapshot.jsx');
  const snapshotPath = path.join(compile.outDir, 'fidelity-snapshot.json');
  const exportScriptPath = path.join(compile.outDir, 'export.jsx');
  const cleanupScriptPath = path.join(compile.outDir, 'cleanup.jsx');
  const fidelityReportPath = path.join(compile.outDir, 'forward-fidelity-report.json');
  const semanticPresetPath = path.join(compile.outDir, 'expected-semantic-preset.json');
  const lintReportPath = path.join(compile.outDir, 'authoring-lint-report.json');
  const exportPdf = args.exportPdf !== false;
  const exportIdml = args.exportIdml !== false;

  fs.writeFileSync(lintReportPath, JSON.stringify(withoutSnapshot(lint), null, 2), 'utf8');
  fs.writeFileSync(semanticPresetPath, JSON.stringify(resolvedPreset.preset, null, 2), 'utf8');
  fs.writeFileSync(buildScriptPath, buildBuildJsx({
    repoRoot: pluginRoot,
    instructionsPath: compile.instructionsPath,
    marker: runMarker,
  }), 'utf8');
  fs.writeFileSync(snapshotScriptPath, buildReverseSnapshotJsx({
    repoRoot: pluginRoot,
    outputPath: snapshotPath,
    inddPath: null,
    closeDocument: false,
    expectedMarker: runMarker,
    closeOnFailure: true,
  }), 'utf8');
  fs.writeFileSync(exportScriptPath, buildExportJsx({
    runDir: compile.outDir,
    outputBaseName,
    exportPdf,
    exportIdml,
    closeDocument: true,
    expectedMarker: runMarker,
  }), 'utf8');
  fs.writeFileSync(cleanupScriptPath, buildCloseJsx({ expectedMarker: runMarker }), 'utf8');

  const state = {
    tool_id: 'html.build_indesign',
    stage: 'build',
    mode,
    runDir: compile.outDir,
    outputBaseName,
    exportPdf,
    exportIdml,
    timeout,
    runMarker,
    instructionsPath: compile.instructionsPath,
    expectedModelPath: compile.expectedModelPath,
    summaryPath: compile.summaryPath,
    lintReportPath,
    buildScriptPath,
    snapshotScriptPath,
    snapshotPath,
    exportScriptPath,
    cleanupScriptPath,
    fidelityReportPath,
    semanticPresetPath,
    timings: { lintMs, compileMs },
    stageStartedAt: Date.now(),
  };

  return hostActionResponse(state, buildAction(state));
}

async function resume(params) {
  const state = params.state || {};
  const hostResults = params.host_results || [];

  if (state.stage === 'cleanup') {
    return pendingErrorAfterCleanup(state, hostResults);
  }

  const failedHostResult = firstFailedHostResult(hostResults);
  if (failedHostResult) {
    return hostFailureResponse(state, failedHostResult);
  }

  const nextState = finishStageTiming(state);
  if (state.stage === 'build') {
    if (state.mode === 'draft') {
      return hostActionResponse(startStage(nextState, 'export'), exportAction(state));
    }
    return hostActionResponse(startStage(nextState, 'snapshot'), snapshotAction(state));
  }

  if (state.stage === 'snapshot') {
    return resumeAfterSnapshot(nextState);
  }

  if (state.stage === 'export') {
    if (state.exportPdf) {
      return hostActionResponse(startStage(nextState, 'verify'), verifyAction(state));
    }
    return completeResult(nextState);
  }

  if (state.stage === 'verify') {
    return completeResult(nextState);
  }

  return errorResponse('BUILD_STATE_INVALID', `Unknown html.build_indesign stage: ${state.stage || 'missing'}`, {
    stage: state.stage || null,
  });
}

function resumeAfterSnapshot(state) {
  let expectedModel;
  let instructions;
  let actualSnapshot;
  let actualModel;
  try {
    expectedModel = readJsonRequired(state.expectedModelPath, 'expected semantic model');
    const semanticPreset = readJsonRequired(state.semanticPresetPath, 'expected semantic preset');
    instructions = readJsonRequired(state.instructionsPath, 'InDesign instructions');
    actualSnapshot = readJsonRequired(state.snapshotPath, 'actual InDesign snapshot');
    actualModel = reverseSnapshotToSemanticModel(actualSnapshot, { mode: 'structured', semanticPreset });
  } catch (error) {
    return cleanupThenError(state, {
      code: error.code || 'FIDELITY_SNAPSHOT_INVALID',
      message: `The built InDesign document could not be checked: ${error.message}`,
      stage: 'snapshot',
      retryable: false,
      hint: 'Fix the reported snapshot or protocol issue before rebuilding; do not retry unchanged input.',
      details: { snapshotPath: state.snapshotPath },
    });
  }

  const report = auditForwardFidelity({
    expectedModel,
    instructions,
    actualSnapshot,
    actualModel,
  });
  fs.writeFileSync(state.fidelityReportPath, JSON.stringify(report, null, 2), 'utf8');
  if (!report.ok) {
    const first = report.errors[0] || {};
    return cleanupThenError(state, {
      code: 'FIDELITY_GATE_FAILED',
      message: fidelityFailureMessage(first, report.errors.length),
      stage: 'fidelity',
      retryable: false,
      hint: 'Read forward-fidelity-report.json, fix the named HTML page/object/field, then start a new build.',
      details: {
        reportPath: state.fidelityReportPath,
        summary: report.summary,
        firstError: first,
      },
    });
  }

  return hostActionResponse(startStage({
    ...state,
    verified: true,
    fidelitySummary: report.summary,
  }, 'export'), exportAction(state));
}

function cleanupThenError(state, error) {
  if (!state.cleanupScriptPath) return { status: 'error', error };
  return hostActionResponse(startStage({ ...state, pendingError: error }, 'cleanup'), cleanupAction(state));
}

function pendingErrorAfterCleanup(state, hostResults) {
  const pendingError = state.pendingError || {
    code: 'BUILD_FAILED',
    message: 'The build failed and its temporary document was closed.',
    retryable: false,
  };
  const cleanupFailure = firstFailedHostResult(hostResults);
  if (!cleanupFailure) return { status: 'error', error: pendingError };
  return {
    status: 'error',
    error: {
      ...pendingError,
      details: {
        ...(pendingError.details || {}),
        cleanupFailure,
      },
    },
  };
}

function completeResult(state) {
  const runDir = state.runDir;
  const outputBaseName = state.outputBaseName || 'html-indesign-output';
  const inddPath = path.join(runDir, `${outputBaseName}.indd`);
  const pdfPath = path.join(runDir, `${outputBaseName}.pdf`);
  const idmlPath = path.join(runDir, `${outputBaseName}.idml`);
  const missing = [];
  if (!fs.existsSync(inddPath)) missing.push(inddPath);
  if (state.exportPdf && !fs.existsSync(pdfPath)) missing.push(pdfPath);
  if (state.exportIdml && !fs.existsSync(idmlPath)) missing.push(idmlPath);
  if (missing.length) {
    return errorResponse('BUILD_ARTIFACTS_MISSING', `Expected build artifacts are missing: ${missing.join(', ')}`, {
      stage: 'artifacts',
      missing,
    });
  }

  const verified = state.mode !== 'draft' && state.verified === true;
  const artifacts = [];
  addArtifactIfPresent(artifacts, 'json', state.lintReportPath, 'Strict authoring check');
  addArtifactIfPresent(artifacts, 'json', state.instructionsPath, 'InDesign instructions');
  addArtifactIfPresent(artifacts, 'json', state.expectedModelPath, 'Expected semantic facts');
  addArtifactIfPresent(artifacts, 'json', state.semanticPresetPath, 'Expected semantic preset');
  addArtifactIfPresent(artifacts, 'json', state.summaryPath, 'Compile summary');
  addArtifactIfPresent(artifacts, 'json', state.fidelityReportPath, 'Forward fidelity report');
  artifacts.push(artifact('indd', inddPath, 'InDesign document'));
  if (state.exportPdf) artifacts.push(artifact('pdf', pdfPath, 'PDF export'));
  if (state.exportIdml) artifacts.push(artifact('idml', idmlPath, 'IDML export'));

  return {
    status: 'complete',
    data: {
      ok: true,
      verified,
      verificationStatus: verified ? 'verified' : 'not-run-draft',
      mode: state.mode || 'final',
      runDir,
      inddPath,
      pdfPath: state.exportPdf ? pdfPath : null,
      idmlPath: state.exportIdml ? idmlPath : null,
      fidelityReportPath: verified ? state.fidelityReportPath : null,
      fidelitySummary: verified ? state.fidelitySummary || null : null,
      timings: state.timings || {},
      warnings: verified ? [] : [{
        code: 'DRAFT_NOT_VERIFIED',
        message: 'Draft mode skipped the built-document fidelity check and is not a verified delivery.',
      }],
    },
    artifacts,
  };
}

function hostFailureResponse(state, failed) {
  const detail = underlyingHostFailure(failed);
  const stage = state.stage || 'build';
  return {
    status: 'error',
    error: {
      code: STAGE_ERROR_CODES[stage] || 'HOST_ACTION_FAILED',
      message: detail.message || `Host action failed during ${stage}.`,
      stage,
      retryable: false,
      hint: 'Fix the reported cause before starting a new build; unchanged input must not be retried automatically.',
      details: {
        causeCode: detail.code || null,
        hostResult: failed,
      },
    },
  };
}

function underlyingHostFailure(result) {
  if (result && result.error) return result.error;
  const data = result && result.data;
  const errors = data && Array.isArray(data.errors) ? data.errors : [];
  if (errors[0]) return errors[0];
  if (data && data.error) return data.error;
  return { code: null, message: null };
}

function firstFailedHostResult(hostResults) {
  return hostResults.find((result) => {
    if (!result) return false;
    if (result.status && result.status !== 'complete' && result.status !== 'ok') return true;
    if (result.ok === false) return true;
    if (result.data && result.data.ok === false) return true;
    return false;
  }) || null;
}

function hostActionResponse(state, action) {
  return {
    status: 'requires_host_actions',
    state,
    actions: [action],
    resume: { method: 'tools/resume' },
  };
}

function buildAction(state) {
  return scriptAction('html-build-script', state.buildScriptPath, state.timeout);
}

function snapshotAction(state) {
  return scriptAction('html-fidelity-snapshot', state.snapshotScriptPath, state.timeout);
}

function exportAction(state) {
  return scriptAction('html-export-script', state.exportScriptPath, state.timeout);
}

function cleanupAction(state) {
  return scriptAction('html-build-cleanup', state.cleanupScriptPath, Math.min(Number(state.timeout || 300), 60));
}

function scriptAction(id, file, timeout) {
  return { id, tool_id: 'script.run', args: { file, timeout: timeout || 300 } };
}

function verifyAction(state) {
  return {
    id: 'html-export-verify',
    tool_id: 'export.verify',
    args: { path: path.join(state.runDir, `${state.outputBaseName || 'html-indesign-output'}.pdf`) },
  };
}

function startStage(state, stage) {
  return { ...state, stage, stageStartedAt: Date.now() };
}

function finishStageTiming(state) {
  if (!state.stage || !Number.isFinite(Number(state.stageStartedAt))) return state;
  return {
    ...state,
    timings: {
      ...(state.timings || {}),
      [`${state.stage}Ms`]: Math.max(0, Date.now() - Number(state.stageStartedAt)),
    },
  };
}

function readJsonRequired(file, label) {
  if (!file || !fs.existsSync(file)) {
    const error = new Error(`${label} is missing: ${file || '(path missing)'}`);
    error.code = 'FIDELITY_INPUT_MISSING';
    throw error;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (cause) {
    const error = new Error(`${label} is invalid JSON: ${cause.message}`);
    error.code = 'FIDELITY_INPUT_INVALID';
    error.cause = cause;
    throw error;
  }
}

function withoutSnapshot(lint) {
  const { snapshot: _snapshot, ...rest } = lint || {};
  return rest;
}

function createRunMarker() {
  return `html-indesign-build-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fidelityFailureMessage(first, count) {
  const location = [
    first.pageId ? `page ${first.pageId}` : null,
    first.parentPageId ? `parent page ${first.parentPageId}` : null,
    first.itemId ? `item ${first.itemId}` : null,
    first.field ? `field ${first.field}` : null,
  ].filter(Boolean).join(', ');
  return `Built InDesign content differs from the HTML source${location ? ` at ${location}` : ''}; ${count} issue(s) found.`;
}

function errorResponse(code, message, details) {
  return {
    status: 'error',
    error: {
      code,
      message,
      retryable: false,
      details: details || {},
    },
  };
}

function addArtifactIfPresent(artifacts, kind, file, label) {
  if (file && fs.existsSync(file)) artifacts.push(artifact(kind, file, label));
}

module.exports = {
  call,
  resume,
};
