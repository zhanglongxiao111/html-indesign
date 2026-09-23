const fs = require('node:fs');
const path = require('node:path');

const { reverseSnapshotToSemanticModel } = require('../../adapters/indesign');
const { auditHtmlCompatibility } = require('../../adapters/html');
const { lintAuthoringPackage, readAuthorPackage } = require('../../authoring');
const { auditForwardFidelity } = require('../../semantic-model');
const { resolveSemanticPreset } = require('../../semantic-preset');
const { compileAuthoringPackage } = require('./compile-instructions');
const { getPluginRoot } = require('../path-policy');
const { resolveProjectPath } = require('../path-policy');
const { artifact } = require('../artifacts');
const { writeReportFile } = require('../report-archive');
const {
  lintFailureHint,
  lintFailureMessage,
  observedGridDowngradeSentence,
  underlyingHostFailure,
  withoutLintSnapshot,
  writeLintFailureReport,
} = require('../lint-feedback');
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
    error.details = { stage: 'validate' };
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
    profile: args.profile,
    includeSnapshot: true,
  });
  const lintMs = Date.now() - lintStartedAt;
  const lintCounts = {
    errorCount: lint.errorCount,
    warningCount: lint.warningCount,
    normalizedCount: lint.normalizedCount || 0,
    gridIgnoredCount: lint.gridIgnoredCount || 0,
    gridObservedDowngradedCount: lint.gridObservedDowngradedCount || 0,
    gridOffCount: lint.gridOffCount || 0,
    gridBlockOffCount: lint.gridBlockOffCount || 0,
    gridCheckedCount: lint.gridCheckedCount || 0,
    gridShieldedCount: lint.gridShieldedCount || 0,
    gridSkippedCount: lint.gridSkippedCount || 0,
    gridBlockCheckedCount: lint.gridBlockCheckedCount || 0,
    gridBlockSkippedCount: lint.gridBlockSkippedCount || 0,
  };
  if (!lint.ok) {
    const report = writeLintFailureReport(lint, {
      outDir: args.outDir,
      cwd: context && context.cwd,
      packagePath,
    });
    const reportPath = report.path;
    const hint = lintFailureHint(lint, { reportPath });
    const error = new Error(lintFailureMessage(lint, { strict: true, reportPath }));
    error.code = 'AUTHORING_LINT_FAILED';
    error.hint = hint;
    error.retryable = false;
    // dispatcher 抛出路径只搬运 details，hint/retryable/stage 必须同时冗余进 details。
    error.details = {
      ...withoutLintSnapshot(lint),
      stage: 'lint',
      hint,
      retryable: false,
      reportPath,
      ...(report.error ? { reportWriteError: report.error } : {}),
      metrics: buildMetrics({
        lint_ms: lintMs,
        error_count: lintCounts.errorCount,
        warning_count: lintCounts.warningCount,
        normalized_count: lintCounts.normalizedCount ?? 0,
        grid_ignored_count: lintCounts.gridIgnoredCount,
        grid_observed_downgraded_count: lintCounts.gridObservedDowngradedCount,
        grid_off_count: lintCounts.gridOffCount,
        grid_block_off_count: lintCounts.gridBlockOffCount,
        grid_checked_count: lintCounts.gridCheckedCount,
        grid_shielded_count: lintCounts.gridShieldedCount,
        grid_skipped_count: lintCounts.gridSkippedCount,
        grid_block_checked_count: lintCounts.gridBlockCheckedCount,
        grid_block_skipped_count: lintCounts.gridBlockSkippedCount,
      }),
    };
    throw error;
  }

  const compileStartedAt = Date.now();
  let compile;
  try {
    compile = await compileAuthoringPackage({
      ...args,
      outputName: 'instructions.json',
    }, context, 'html-plugin-build', {
      snapshot: lint.snapshot,
      compatibility: lint.compatibility,
      expectedModelName: 'expected-semantic-model.json',
    });
  } catch (error) {
    const compileMsAtFailure = Date.now() - compileStartedAt;
    const existingDetails = (error && typeof error.details === 'object' && error.details) || {};
    const existingMetrics = (existingDetails.metrics && typeof existingDetails.metrics === 'object') ? existingDetails.metrics : {};
    error.details = {
      ...existingDetails,
      stage: existingDetails.stage || 'compile',
      metrics: buildMetrics({
        lint_ms: lintMs,
        compile_ms: compileMsAtFailure,
        warning_count: lintCounts.warningCount,
        normalized_count: lintCounts.normalizedCount ?? 0,
        grid_ignored_count: lintCounts.gridIgnoredCount,
        grid_observed_downgraded_count: lintCounts.gridObservedDowngradedCount,
        grid_off_count: lintCounts.gridOffCount,
        grid_block_off_count: lintCounts.gridBlockOffCount,
        grid_checked_count: lintCounts.gridCheckedCount,
        grid_shielded_count: lintCounts.gridShieldedCount,
        grid_skipped_count: lintCounts.gridSkippedCount,
        grid_block_checked_count: lintCounts.gridBlockCheckedCount,
        grid_block_skipped_count: lintCounts.gridBlockSkippedCount,
        ...existingMetrics,
      }),
    };
    throw error;
  }
  const compileMs = Date.now() - compileStartedAt;
  const sizeMetrics = {
    pages: compile.metrics && compile.metrics.pages,
    objects: compile.metrics && compile.metrics.objects,
    vectorPaths: compile.metrics && compile.metrics.vector_paths,
    assets: compile.metrics && compile.metrics.assets,
  };

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
  const preRunDeliverables = snapshotDeliverables(compile.outDir, outputBaseName);

  writeReportFile(lintReportPath, withoutLintSnapshot(lint), { failed: false });
  fs.writeFileSync(semanticPresetPath, JSON.stringify(resolvedPreset.preset, null, 2), 'utf8');
  fs.writeFileSync(buildScriptPath, buildBuildJsx({
    repoRoot: pluginRoot,
    instructionsPath: compile.instructionsPath,
    marker: runMarker,
    targetInddPath: path.join(compile.outDir, `${outputBaseName}.indd`),
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
    sizeMetrics,
    lintCounts,
    lintProfile: lint.profile,
    compatibility: compile.compatibility || lint.compatibility,
    preRunDeliverables,
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

  // 每个阶段的宿主脚本都会报自己的 warning（构建阶段的 PREVIOUS_OUTPUT_CLOSED、快照阶段的
  // PLACED_ASSET_PREVIEW_EXPORT_FAILED、导出阶段的 IDML_EXPORT_FAILED……）。按分支各收一次
  // 就会漏掉没写到的分支（快照阶段此前就是这么丢的），所以在这里统一收一次，四个阶段共用。
  const nextState = withHostWarnings(finishStageTiming(state), hostResults);
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
    // 其余三条失败出口都带 hostWarnings，这里也带：阶段名对不上时之前阶段收到的
    // warning 往往正是解释"怎么走到这一步"的线索，没理由只在这个出口丢掉。
    ...(state.hostWarnings && state.hostWarnings.length ? { hostWarnings: state.hostWarnings } : {}),
    metrics: collectMetrics(state),
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

  const fidelityAuditStartedAt = Date.now();
  const report = auditForwardFidelity({
    expectedModel,
    instructions,
    actualSnapshot,
    actualModel,
  });
  const fidelityGateMs = Date.now() - fidelityAuditStartedAt;
  const stateWithGateTiming = {
    ...state,
    timings: { ...(state.timings || {}), fidelityGateMs },
    fidelityCounts: {
      errorCount: report.summary && report.summary.errors,
      warningCount: report.summary && report.summary.warnings,
      // 扩框量级进遥测：只有计数时，"verified 但有警告"这类问题在聚合里看不出严重程度。
      textFitCount: countWarningCode(report.warnings, 'FORWARD_TEXT_FIT_APPLIED'),
      maxGrow: maxWarningGrow(report.warnings),
    },
  };
  writeReportFile(state.fidelityReportPath, report, {
    failed: Array.isArray(report.errors) && report.errors.length > 0,
  });
  if (!report.ok) {
    const first = report.errors[0] || {};
    // 首条差异未必带 hint（例如矢量几何差异排在文本溢出前面）；hint 取第一条能指路的。
    const hintCarrier = report.errors.find((entry) => typeof entry.hint === 'string' && entry.hint.trim()) || first;
    // hintCarrier 与 first 不是同一条时，message 描述的是 first，hint 描述的是 hintCarrier；
    // 不带定位前缀就是无名指路，得把 hintCarrier 自己的 page/item 补上。
    const carrierLocation = hintCarrier === first
      ? ''
      : [hintCarrier.pageId, hintCarrier.itemId].filter(Boolean).join(' / ');
    return cleanupThenError(stateWithGateTiming, {
      code: 'FIDELITY_GATE_FAILED',
      message: fidelityFailureMessage(first, report.errors.length),
      stage: 'fidelity',
      retryable: false,
      hint: hintCarrier.hint
        ? `${carrierLocation ? `${carrierLocation}: ` : ''}${hintCarrier.hint} Full list: forward-fidelity-report.json.`
        : 'Read forward-fidelity-report.json, fix the named HTML page/object/field, then start a new build.',
      details: {
        reportPath: state.fidelityReportPath,
        summary: report.summary,
        firstError: first,
      },
    });
  }

  const warningDigest = fidelityWarningDigest(report.warnings);
  return hostActionResponse(startStage({
    ...stateWithGateTiming,
    verified: true,
    fidelitySummary: {
      ...report.summary,
      // 通过的构建也可能改了几何；digest 让"warnings: 2"变成可读的两条具体记录。
      ...(warningDigest ? { warningDigest } : {}),
    },
  }, 'export'), exportAction(state));
}

// 走到这里表示构建被放弃：文档在 InDesign 里建过，但导出阶段永远不会执行。
// 成品从未落盘这件事必须显式说清楚，否则调用方会去找根本不存在的 INDD。
function cleanupThenError(state, error) {
  const enrichedError = {
    ...error,
    details: {
      ...(error.details || {}),
      stage: error.stage || (error.details && error.details.stage) || null,
      artifactsExported: false,
      artifactNote: 'InDesign 文档已构建但未通过核对，未导出 INDD/PDF/IDML；'
        + '可离线复查的中间产物（instructions、读回快照、保真报告）保留在 intermediateDir。',
      intermediateDir: state.runDir || null,
      ...(state.hostWarnings && state.hostWarnings.length ? { hostWarnings: state.hostWarnings } : {}),
      metrics: collectMetrics(state),
      compatibility: state.compatibility || auditHtmlCompatibility(null),
    },
  };
  if (!state.cleanupScriptPath) return { status: 'error', error: enrichedError };
  return hostActionResponse(startStage({ ...state, pendingError: enrichedError }, 'cleanup'), cleanupAction(state));
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
  // IDML_EXPORT_FAILED 只是 warning，光看 existsSync 会把上一轮遗留的旧文件当成本轮成果报出去。
  // 与开工前的 {mtimeMs, size} 快照比对：存在但没变的算 stale，同样不能当交付。
  const before = state.preRunDeliverables || {};
  const expected = [
    { kind: 'indd', file: inddPath },
    ...(state.exportPdf ? [{ kind: 'pdf', file: pdfPath }] : []),
    ...(state.exportIdml ? [{ kind: 'idml', file: idmlPath }] : []),
  ];
  const missing = [];
  const stale = [];
  for (const item of expected) {
    if (deliverableIsFresh(item.file, before[item.kind])) continue;
    missing.push(item.file);
    if (fs.existsSync(item.file)) stale.push(item.file);
  }
  if (missing.length) {
    const absent = missing.filter((file) => !stale.includes(file));
    const parts = [];
    if (absent.length) parts.push(`missing: ${absent.join(', ')}`);
    if (stale.length) parts.push(`unchanged since the run started (stale from a previous build): ${stale.join(', ')}`);
    return errorResponse('BUILD_ARTIFACTS_MISSING', `Expected build artifacts are ${parts.join('; ')}`, {
      stage: 'artifacts',
      missing,
      stale,
      ...(state.hostWarnings && state.hostWarnings.length ? { hostWarnings: state.hostWarnings } : {}),
      metrics: collectMetrics(state),
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
      warnings: [
        ...(state.hostWarnings || []),
        ...(verified ? [] : [{
          code: 'DRAFT_NOT_VERIFIED',
          message: 'Draft mode skipped the built-document fidelity check and is not a verified delivery.',
        }]),
        ...observedGridDowngradeWarnings(state),
      ],
      compatibility: state.compatibility || auditHtmlCompatibility(null),
    },
    metrics: collectMetrics(state, { artifacts: artifacts.length }),
    artifacts,
  };
}

// 导出阶段可能只失败一半：INDD 已经落盘、PDF 没有。把整次调用报成失败而不提已落盘产物，
// 调用方就无法判断重跑范围。cleanupThenError() 已是这个模式，这里对称应用。
// OUTPUT_TARGET_OPEN 是构建前预检：什么都没写，原因也不是作者源码，单独映射并标记可重试。
function hostFailureResponse(state, failed) {
  const detail = underlyingHostFailure(failed);
  const stage = state.stage || 'build';
  const finished = finishStageTiming(state);
  // resume() 在顶部收割前就把失败结果转给这里，本阶段自己报的 warning（例如导出失败前
  // 那条 PDF_PAGE_APPLY_FAILED）还没进 state.hostWarnings，得在这里单独补收一次；
  // 之前阶段的 warning 已经随 state 带过来了，withHostWarnings 只是在它后面追加。
  //
  // 真实 CLI 的失败形状是 { ok:false, error:{ code:'INDESIGN_SCRIPT_FAILED', message:<整段
  // JSON 文本> } }，根本没有 data —— 只收 failed 就等于在生产路径上一条 warning 都收不到。
  // unwrapSerializedHostError 已经把那段文本解成 detail.hostResult，这里按 data 的形状再收
  // 一次；插件契约/测试的 data 直挂形状不产出 hostResult，因此不会重复计数。
  const withWarnings = withHostWarnings(finished, [
    failed,
    ...(detail.hostResult && typeof detail.hostResult === 'object' ? [{ data: detail.hostResult }] : []),
  ]);
  const targetOpen = stage === 'build' && detail.code === 'OUTPUT_TARGET_OPEN';
  const partialArtifacts = targetOpen ? [] : landedDeliverables(state);
  const baseMessage = detail.message || `Host action failed during ${stage}.`;
  const prefix = landedArtifactPrefix(partialArtifacts);
  const hint = targetOpen
    ? '目标 INDD 正在 InDesign 中打开：在 InDesign 里关闭它（或改用其他 outputBaseName），然后重跑同一命令。'
    : partialArtifacts.length
      ? '已落盘的产物见 error.details.partialArtifacts，重跑前先确认是否需要保留；'
        + 'Fix the reported cause before starting a new build; unchanged input must not be retried automatically.'
      : 'Fix the reported cause before starting a new build; unchanged input must not be retried automatically.';
  return {
    status: 'error',
    error: {
      code: targetOpen ? 'OUTPUT_TARGET_OPEN' : (STAGE_ERROR_CODES[stage] || 'HOST_ACTION_FAILED'),
      message: prefix ? `${prefix}${baseMessage}` : baseMessage,
      stage,
      retryable: targetOpen,
      hint,
      details: {
        causeCode: detail.code || null,
        hostResult: failed,
        stage,
        artifactsExported: partialArtifacts.length > 0,
        partialArtifacts,
        intermediateDir: state.runDir || null,
        ...(withWarnings.hostWarnings && withWarnings.hostWarnings.length ? { hostWarnings: withWarnings.hostWarnings } : {}),
        metrics: collectMetrics(finished),
        compatibility: state.compatibility || auditHtmlCompatibility(null),
      },
    },
    ...(partialArtifacts.length ? { artifacts: partialArtifacts } : {}),
  };
}

const DELIVERABLE_KINDS = Object.freeze([
  { kind: 'indd', extension: '.indd', label: 'InDesign document', prefixLabel: 'INDD' },
  { kind: 'pdf', extension: '.pdf', label: 'PDF export', prefixLabel: 'PDF' },
  { kind: 'idml', extension: '.idml', label: 'IDML export', prefixLabel: 'IDML' },
]);

// 产物新鲜度不能靠工位时钟和 NAS 文件时间戳互比（两台机器的钟可以差几分钟）。
// 开工前给三个产物拍 {mtimeMs, size} 快照，收尾时同一台文件服务器的数据自己和自己比。
function snapshotDeliverables(runDir, baseName) {
  const snapshot = {};
  for (const deliverable of DELIVERABLE_KINDS) {
    snapshot[deliverable.kind] = statDeliverable(path.join(runDir, `${baseName}${deliverable.extension}`));
  }
  return snapshot;
}

function statDeliverable(file) {
  try {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    return stat ? { mtimeMs: stat.mtimeMs, size: stat.size } : null;
  } catch (_) {
    return null;
  }
}

// 存在且不同于开工前快照才算本轮写出的；没有快照（旧 state）时退回“存在即算”。
function deliverableIsFresh(file, before) {
  const now = statDeliverable(file);
  if (!now) return false;
  if (before === undefined) return true;
  if (before === null) return true;
  return now.mtimeMs !== before.mtimeMs || now.size !== before.size;
}

function landedDeliverables(state) {
  if (!state || !state.runDir) return [];
  const baseName = state.outputBaseName || 'html-indesign-output';
  const before = state.preRunDeliverables || {};
  const landed = [];
  for (const deliverable of DELIVERABLE_KINDS) {
    const file = path.join(state.runDir, `${baseName}${deliverable.extension}`);
    if (!deliverableIsFresh(file, before[deliverable.kind])) continue;
    landed.push(artifact(deliverable.kind, file, deliverable.label));
  }
  return landed;
}

function landedArtifactPrefix(partialArtifacts) {
  if (!partialArtifacts.length) return '';
  const labels = new Map(DELIVERABLE_KINDS.map((item) => [item.kind, item.prefixLabel]));
  const parts = partialArtifacts.map((item) => `${labels.get(item.kind) || item.kind} 已保存于 ${item.path}`);
  return `${parts.join('；')}。`;
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

// 宿主脚本的 warnings（例如预检自动关闭旧产物的 PREVIOUS_OUTPUT_CLOSED、导出阶段的
// IDML_EXPORT_FAILED）必须到达调用方。真实 CLI 的 formatScriptResult 把脚本载荷摊进 parsed，
// 这是 parsed.warnings 存在的唯一原因；插件契约/测试用 data 直挂。回落按字段而不是按对象：
// parsed 在但没有 warnings 时，仍要看 data.warnings。
const HOST_WARNING_LIMIT = 100;
const HOST_WARNING_MESSAGE_LIMIT = 500;
const HOST_WARNING_DETAIL_STRING_LIMIT = 200;
const HOST_WARNING_DETAIL_KEY_LIMIT = 24;

function hostScriptWarnings(hostResults) {
  const warnings = [];
  for (const result of hostResults || []) {
    const data = result && result.data;
    const payload = data && data.parsed && typeof data.parsed === 'object' ? data.parsed : null;
    const list = (payload && Array.isArray(payload.warnings))
      ? payload.warnings
      : (data && Array.isArray(data.warnings) ? data.warnings : []);
    for (const warning of list) {
      if (!warning || !warning.code) continue;
      const entry = {
        code: warning.code,
        message: clampText(String(warning.message || ''), HOST_WARNING_MESSAGE_LIMIT),
      };
      const details = hostWarningScalarDetails(warning.details);
      if (details) entry.details = details;
      warnings.push(entry);
    }
  }
  return warnings;
}

// details 里的定位字段（哪一页、哪个对象、请求了什么字体又落到了什么字体）是作者修问题的唯一线索，
// 而每个 warning 各带一套自己的键：FONT_FALLBACK_APPLIED 是 requestedFont/appliedFont，
// 文本溢出是 itemId/pageName/textLength，还有 styleName、compositeFont、propertyName……
// 白名单挡不住新键，只会静默丢掉。所以反过来按形状过滤：标量（字符串/有限数字/布尔）一律透传，
// 只丢掉对象/数组这类体积无界的结构（bounds、visibleText 之外的嵌套载荷）。
function hostWarningScalarDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const kept = {};
  // 键数也要封顶，理由同对象/数组：一条 warning 带几百个标量键同样是无界载荷。
  // 但上限只能数"留下来的标量键"：先对键名 slice 的话，排在前面的对象/数组键会把名额
  // 花在根本不会留下的键上（bounds 之类占五个名额，后面真正有用的定位字段就被挤没了）。
  let keptCount = 0;
  for (const key of Object.keys(details)) {
    if (keptCount >= HOST_WARNING_DETAIL_KEY_LIMIT) break;
    const value = details[key];
    if (typeof value === 'string') kept[key] = clampText(value, HOST_WARNING_DETAIL_STRING_LIMIT);
    else if (typeof value === 'number' && Number.isFinite(value)) kept[key] = value;
    else if (typeof value === 'boolean') kept[key] = value;
    else continue;
    keptCount += 1;
  }
  return Object.keys(kept).length ? kept : null;
}

// 上限必须按累计后的 state.hostWarnings 计。按单次收割计的话，构建/快照/导出/校验四个阶段
// 各报 100 条就是 400 条，上限等于不存在；截断条目也只留一条，后续阶段只把它的计数改大。
function withHostWarnings(state, hostResults) {
  return {
    ...state,
    hostWarnings: capHostWarnings([...(state.hostWarnings || []), ...hostScriptWarnings(hostResults)]),
  };
}

function capHostWarnings(warnings) {
  let omitted = 0;
  const kept = [];
  for (const entry of warnings) {
    if (entry && entry.code === 'HOST_WARNINGS_TRUNCATED') {
      omitted += truncatedOmittedCount(entry);
      continue;
    }
    if (kept.length < HOST_WARNING_LIMIT) kept.push(entry);
    else omitted += 1;
  }
  if (!omitted) return kept;
  return [...kept, {
    code: 'HOST_WARNINGS_TRUNCATED',
    message: `${omitted} more host warnings omitted`,
    details: { omitted },
  }];
}

function truncatedOmittedCount(entry) {
  const count = Number(entry.details && entry.details.omitted);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function clampText(value, limit) {
  return value.length > limit ? value.slice(0, limit) : value;
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

function createRunMarker() {
  return `html-indesign-build-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// verified 的构建同样可能带保真警告：作者声明的 expand-frame-to-content 扩框就是一例——
// 长大幅度在 maxGrowX/maxGrowY 之内所以不算错误，但文字框确实变了几何。
// 返回体过去只给 summary.warnings 一个计数，调用方看到 "verified:true, warnings:2"
// 无从知道是哪两个框、各长了多少，必须自己去翻 forward-fidelity-report.json
// （2026-09-08 起遥测 35 次）。这里把量级直接带回返回体：不改门禁判定，只让它可见。
const FIDELITY_WARNING_DIGEST_LIMIT = 5;

function fidelityWarningDigest(warnings) {
  const list = Array.isArray(warnings) ? warnings : [];
  if (!list.length) return null;

  const byCode = {};
  for (const warning of list) {
    const code = String((warning && warning.code) || 'UNKNOWN');
    byCode[code] = (byCode[code] || 0) + 1;
  }

  // 按几何变化量排序：最大的那个才是作者需要先看一眼的，条数多时尤其如此。
  const ranked = [...list].sort((a, b) => warningMagnitude(b) - warningMagnitude(a));
  const top = ranked.slice(0, FIDELITY_WARNING_DIGEST_LIMIT).map((warning) => ({
    code: warning.code,
    ...(warning.pageId ? { pageId: warning.pageId } : {}),
    ...(warning.itemId ? { itemId: warning.itemId } : {}),
    ...(warning.field ? { field: warning.field } : {}),
    ...(Number.isFinite(Number(warning.growX)) ? { growX: Number(warning.growX) } : {}),
    ...(Number.isFinite(Number(warning.growY)) ? { growY: Number(warning.growY) } : {}),
  }));

  return {
    total: list.length,
    byCode,
    top,
    ...(list.length > top.length ? { omitted: list.length - top.length } : {}),
  };
}

function countWarningCode(warnings, code) {
  return (Array.isArray(warnings) ? warnings : []).filter((warning) => warning && warning.code === code).length;
}

function warningMagnitude(warning) {
  const growX = Math.abs(Number(warning && warning.growX));
  const growY = Math.abs(Number(warning && warning.growY));
  return Math.max(Number.isFinite(growX) ? growX : 0, Number.isFinite(growY) ? growY : 0);
}

function maxWarningGrow(warnings) {
  const list = Array.isArray(warnings) ? warnings : [];
  return list.reduce((max, warning) => Math.max(max, warningMagnitude(warning)), 0);
}

function fidelityFailureMessage(first, count) {
  const location = [
    first.pageId ? `page ${first.pageId}` : null,
    first.parentPageId ? `parent page ${first.parentPageId}` : null,
    first.itemId ? `item ${first.itemId}` : null,
    first.field ? `field ${first.field}` : null,
  ].filter(Boolean).join(', ');
  // 首条差异的原因直接进 message：Agent 只读 message 就能决定是改框还是改内容。
  const detail = first.reason === 'overset'
    ? ' (text overset: the InDesign frame is too small for its text)'
    : Array.isArray(first.dimensions) && first.dimensions.length
      ? ` (table differs in: ${first.dimensions.join(', ')})`
      : '';
  return `Built InDesign content differs from the HTML source${location ? ` at ${location}` : ''}; ${count} issue(s) found${detail}.`;
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

function collectMetrics(state, extra) {
  const timings = state.timings || {};
  const size = state.sizeMetrics || {};
  const lintCounts = state.lintCounts || {};
  const fidelityCounts = state.fidelityCounts || {};
  const compatibility = state.compatibility && state.compatibility.summary || {};
  return buildMetrics({
    lint_ms: timings.lintMs,
    compile_ms: timings.compileMs,
    indesign_build_ms: timings.buildMs,
    readback_ms: timings.snapshotMs,
    fidelity_gate_ms: timings.fidelityGateMs,
    export_ms: timings.exportMs,
    verify_ms: timings.verifyMs,
    pages: size.pages,
    objects: size.objects,
    vector_paths: size.vectorPaths,
    assets: size.assets,
    error_count: lintCounts.errorCount,
    warning_count: lintCounts.warningCount,
    normalized_count: lintCounts.normalizedCount ?? 0,
    grid_ignored_count: lintCounts.gridIgnoredCount,
    grid_observed_downgraded_count: lintCounts.gridObservedDowngradedCount,
    grid_off_count: lintCounts.gridOffCount,
    grid_block_off_count: lintCounts.gridBlockOffCount,
    grid_checked_count: lintCounts.gridCheckedCount,
    grid_shielded_count: lintCounts.gridShieldedCount,
    grid_skipped_count: lintCounts.gridSkippedCount,
    grid_block_checked_count: lintCounts.gridBlockCheckedCount,
    grid_block_skipped_count: lintCounts.gridBlockSkippedCount,
    fidelity_error_count: fidelityCounts.errorCount,
    fidelity_warning_count: fidelityCounts.warningCount,
    fidelity_text_fit_count: fidelityCounts.textFitCount,
    fidelity_max_grow: fidelityCounts.maxGrow,
    compatibility_normalized: compatibility.normalized,
    compatibility_blocked: compatibility.blocked,
    ...(extra || {}),
  });
}

// profile: reverse-export 的网格降级在构建通过时也要看得见，不能只藏在 metrics 里。
function observedGridDowngradeWarnings(state) {
  const lintCounts = state.lintCounts || {};
  const message = observedGridDowngradeSentence({
    gridObservedDowngradedCount: lintCounts.gridObservedDowngradedCount,
    profile: state.lintProfile,
  });
  return message ? [{ code: 'GRID_OBSERVED_DOWNGRADED', message }] : [];
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
  resume,
  // 仅供测试断言文案/形状；宿主只走 call/resume。
  fidelityFailureMessage,
  fidelityWarningDigest,
};
