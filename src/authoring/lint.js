const fs = require('fs');
const path = require('path');
const {
  AUTHORING_LINT_PROFILE_NAMES,
  DEFAULT_AUTHORING_LINT_PROFILE,
  GRID_OBSERVED_DOWNGRADED,
  auditHtmlCompatibility,
  renderSnapshot,
  resolveAuthoringLintProfile,
  validateAuthoringRules,
} = require('../adapters/html');
const {
  auditAuthorPackageSourceFormat,
  authorPackageReassemblyHint,
  checkAuthorPackageEntry,
  readAuthorPackage,
} = require('./source-package');
const {
  fieldRegistry,
  scanDataIdFields,
  validateDataIdFields,
} = require('../protocol');
const { auditAuthoringSemanticTokens, resolveSemanticPreset } = require('../semantic-preset');
const { auditStaticAuthoringRuntime } = require('./static-runtime-audit');
const { auditCompilePrecheck } = require('./compile-precheck');
const { authorPackageCompileOptions } = require('./compile-options');

async function lintAuthoringPackage(options = {}) {
  const packagePath = path.resolve(requiredPath(options.packagePath, 'packagePath'));
  // 非法 lintProfile 在读包之前就拒绝：不能带着没生效的参数跑出一份看似正常的结果。
  const lintProfile = resolveAuthoringLintProfile(options.lintProfile);
  let sourcePackage;
  try {
    sourcePackage = readAuthorPackage(packagePath);
  } catch (error) {
    throw normalizeErrorCode(error);
  }

  const resolvedPreset = resolveSemanticPreset({
    rootDir: sourcePackage.rootDir,
    config: sourcePackage.config,
  });
  const semanticPreset = publicSemanticPresetMetadata(resolvedPreset);

  const sourceFormat = auditAuthorPackageSourceFormat(packagePath, { strict: options.strict });
  if (!sourceFormat.valid) {
    return normalizeLintPayload(packageFailure(sourceFormat, null, null, semanticPreset), {
      packagePath,
      htmlPath: null,
      lintProfile,
    });
  }

  const packageCheck = checkAuthorPackageEntry(packagePath);
  if (!packageCheck.ok) {
    const message = `AUTHOR_GENERATED_ENTRY_DIRTY: ${packageCheck.message}: ${packageCheck.entryPath}`;
    return normalizeLintPayload(packageFailure(sourceFormat, {
      code: 'AUTHOR_GENERATED_ENTRY_DIRTY',
      message,
      entryPath: packageCheck.entryPath,
      hint: authorPackageReassemblyHint(packagePath),
    }, null, semanticPreset), {
      packagePath,
      htmlPath: packageCheck.entryPath,
      lintProfile,
    });
  }

  const semanticAudit = auditAuthoringSemanticTokens({
    preset: resolvedPreset.preset,
    pageFiles: sourcePackage.pageFiles,
    strict: options.strict,
  });
  if (!semanticAudit.valid) {
    return normalizeLintPayload(packageFailure(sourceFormat, null, semanticAudit, semanticPreset), {
      packagePath,
      htmlPath: packageCheck.entryPath,
      lintProfile,
    });
  }

  const htmlResult = await lintAuthoringHtml({
    htmlPath: packageCheck.entryPath,
    strict: options.strict,
    gridTolerance: options.gridTolerance,
    lintProfile,
    includeSnapshot: options.includeSnapshot,
    // lint 用 compile 的默认 unitMode/targetSize 与同一份语义库 styleNameMap，
    // 让编译预检与 html.compile_instructions / html.build_indesign 走同一套选项。
    compileOptions: authorPackageCompileOptions(sourcePackage, {}, resolvedPreset),
  });

  const errors = (sourceFormat.errors || [])
    .concat(semanticAudit.errors || [], htmlResult.errors || []);
  // htmlResult 已过一遍 normalizeLintPayload，归一化条目被拆到 normalized；
  // 这里必须把它带回警告池，否则包级重新归一化时这批条目会从 warnings 和 normalized 里双双消失。
  const warnings = (sourceFormat.warnings || [])
    .concat(semanticAudit.warnings || [], htmlResult.warnings || [], htmlResult.normalized || []);

  return normalizeLintPayload({
    ok: errors.length === 0,
    valid: errors.length === 0,
    htmlPath: packageCheck.entryPath,
    packagePath,
    dataIdAudit: htmlResult.dataIdAudit,
    sourceFormat,
    semanticPreset,
    semanticAudit,
    compatibility: htmlResult.compatibility,
    lintProfile,
    notices: htmlResult.notices || [],
    gridObservedDowngradedCount: htmlResult.gridObservedDowngradedCount || 0,
    gridIgnoredCount: htmlResult.gridIgnoredCount || 0,
    gridOffCount: htmlResult.gridOffCount || 0,
    gridBlockOffCount: htmlResult.gridBlockOffCount || 0,
    gridCheckedCount: htmlResult.gridCheckedCount || 0,
    gridShieldedCount: htmlResult.gridShieldedCount || 0,
    gridSkippedCount: htmlResult.gridSkippedCount || 0,
    gridBlockCheckedCount: htmlResult.gridBlockCheckedCount || 0,
    gridBlockSkippedCount: htmlResult.gridBlockSkippedCount || 0,
    errors,
    warnings,
    messages: errors.concat(warnings),
    ...(options.includeSnapshot ? { snapshot: htmlResult.snapshot } : {}),
  }, {
    packagePath,
    htmlPath: packageCheck.entryPath,
  });
}

async function lintAuthoringHtml(options = {}) {
  const htmlPath = path.resolve(requiredPath(options.htmlPath, 'htmlPath'));
  const lintProfile = resolveAuthoringLintProfile(options.lintProfile);
  if (!fs.existsSync(htmlPath)) {
    const error = new Error(`HTML_NOT_FOUND: ${htmlPath}`);
    error.code = 'HTML_NOT_FOUND';
    throw error;
  }

  const dataIdAudit = auditHtmlDataIdFields(htmlPath, { strict: options.strict });
  const runtimeAudit = auditStaticAuthoringRuntime(fs.readFileSync(htmlPath, 'utf8'), {
    strict: options.strict,
    file: htmlPath,
  });
  if (!runtimeAudit.valid) {
    return normalizeLintPayload({
      ok: false,
      htmlPath,
      dataIdAudit,
      runtimeAudit,
      errors: dataIdAudit.errors.concat(runtimeAudit.errors),
      warnings: dataIdAudit.warnings.concat(runtimeAudit.warnings),
    }, { htmlPath, lintProfile });
  }
  const snapshot = options.snapshot || await renderSnapshot({ htmlPath });
  const compatibility = auditHtmlCompatibility(snapshot);
  const result = withModelPrecheck(withCompatibility(withDataIdAudit(validateAuthoringRules(snapshot, {
    strict: options.strict,
    gridTolerance: options.gridTolerance,
    lintProfile,
  }), dataIdAudit), compatibility), auditCompilePrecheck(snapshot, {
    // 只有 htmlPath（没有作者包）时不传：拿不到语义库，编译预检只做语义模型一步。
    compileOptions: options.compileOptions || null,
    compatibilityBlocked: compatibilityBlocked(compatibility),
  }));

  return normalizeLintPayload({
    ok: result.valid,
    htmlPath,
    dataIdAudit,
    runtimeAudit,
    compatibility,
    ...(options.includeSnapshot ? { snapshot } : {}),
    ...withRuntimeAudit(result, runtimeAudit),
  }, {
    htmlPath,
  });
}

function withRuntimeAudit(result, runtimeAudit) {
  const errors = result.errors.concat(runtimeAudit.errors);
  const warnings = result.warnings.concat(runtimeAudit.warnings);
  return {
    ...result,
    valid: errors.length === 0,
    errors,
    warnings,
    messages: errors.concat(warnings),
  };
}

function requiredPath(value, name) {
  if (!value || typeof value !== 'string') {
    const error = new Error(`${name} must be a non-empty string`);
    error.code = 'INVALID_ARGS';
    throw error;
  }
  return value;
}

function normalizeErrorCode(error) {
  if (!error.code && error.message) {
    const match = String(error.message).match(/^([A-Z0-9_]+):/);
    if (match) error.code = match[1];
  }
  return error;
}

function normalizeLintPayload(payload, paths = {}) {
  const errors = payload.errors || [];
  const allWarnings = payload.warnings || [];
  const normalized = allWarnings.filter((entry) => entry && entry.action === 'normalized');
  const warnings = allWarnings.filter((entry) => !entry || entry.action !== 'normalized');
  const messages = payload.messages || errors.concat(allWarnings);
  return {
    ...payload,
    ok: errors.length === 0,
    valid: errors.length === 0,
    ...(paths.packagePath ? { packagePath: paths.packagePath } : {}),
    ...(paths.htmlPath ? { htmlPath: paths.htmlPath } : {}),
    errors,
    warnings,
    normalized,
    normalizedSummary: normalizedSummaryByCode(normalized),
    messages,
    issueCount: messages.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    normalizedCount: normalized.length,
    lintProfile: payload.lintProfile || paths.lintProfile || DEFAULT_AUTHORING_LINT_PROFILE,
    notices: Array.isArray(payload.notices) ? payload.notices : [],
    gridObservedDowngradedCount: Number(payload.gridObservedDowngradedCount) || 0,
    gridIgnoredCount: Number(payload.gridIgnoredCount) || 0,
    gridOffCount: Number(payload.gridOffCount) || 0,
    gridBlockOffCount: Number(payload.gridBlockOffCount) || 0,
    gridCheckedCount: Number(payload.gridCheckedCount) || 0,
    gridShieldedCount: Number(payload.gridShieldedCount) || 0,
    gridSkippedCount: Number(payload.gridSkippedCount) || 0,
    gridBlockCheckedCount: Number(payload.gridBlockCheckedCount) || 0,
    gridBlockSkippedCount: Number(payload.gridBlockSkippedCount) || 0,
    compatibility: payload.compatibility || emptyCompatibility(),
  };
}

function normalizedSummaryByCode(normalized) {
  const counts = new Map();
  for (const entry of normalized) {
    const code = entry && entry.code || 'other';
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([code, count]) => ({ code, count }));
}

function withCompatibility(result, compatibility) {
  const messages = compatibility && Array.isArray(compatibility.messages) ? compatibility.messages : [];
  const errors = result.errors.concat(messages.filter((entry) => entry.level === 'error'));
  const warnings = result.warnings.concat(messages.filter((entry) => entry.level !== 'error'));
  return {
    ...result,
    valid: errors.length === 0,
    errors,
    warnings,
    messages: errors.concat(warnings),
    compatibility: compatibility || emptyCompatibility(),
  };
}

// compile 阶段会拒绝的输入（同页重复 id、资源文件缺失等）按 error 并入，strict 与否都一样。
function withModelPrecheck(result, precheck) {
  if (!precheck || !precheck.errors.length) return result;
  const errors = result.errors.concat(precheck.errors);
  return {
    ...result,
    valid: errors.length === 0,
    errors,
    messages: errors.concat(result.warnings),
  };
}

// 与 compile 的 assertCompatibilityReady 同一口径：error 级或 blocked 动作，或 summary.blocked > 0。
function compatibilityBlocked(compatibility) {
  const messages = compatibility && Array.isArray(compatibility.messages) ? compatibility.messages : [];
  if (messages.some((entry) => entry && (entry.level === 'error' || entry.action === 'blocked'))) return true;
  return Number(compatibility && compatibility.summary && compatibility.summary.blocked) > 0;
}

function emptyCompatibility() {
  return { summary: { normalized: 0, warnings: 0, blocked: 0 }, messages: [] };
}

function packageFailure(sourceFormat, entryIssue, semanticAudit, semanticPreset) {
  const entryErrors = entryIssue ? [{ level: 'error', ...entryIssue }] : [];
  const semanticErrors = semanticAudit ? semanticAudit.errors : [];
  const semanticWarnings = semanticAudit ? semanticAudit.warnings : [];
  const errors = entryErrors.concat(sourceFormat ? sourceFormat.errors : [], semanticErrors);
  const warnings = (sourceFormat ? sourceFormat.warnings : []).concat(semanticWarnings);
  return {
    ok: false,
    sourceFormat,
    ...(semanticPreset ? { semanticPreset } : {}),
    ...(semanticAudit ? { semanticAudit } : {}),
    errors,
    warnings,
    messages: errors.concat(warnings),
  };
}

function auditHtmlDataIdFields(htmlPath, options = {}) {
  const attrs = scanDataIdFields(fs.readFileSync(htmlPath, 'utf8'));
  const validation = validateDataIdFields(fieldRegistry, attrs, { strict: options.strict });
  const errors = validation.errors.map((issue) => dataIdMessage('error', issue, htmlPath));
  const warnings = options.strict
    ? []
    : validation.warnings.map((issue) => dataIdMessage('warning', issue, htmlPath));

  return {
    valid: errors.length === 0,
    htmlPath,
    attrs,
    accepted: validation.accepted,
    unknown: validation.unknown,
    retired: validation.retired,
    errors,
    warnings,
    messages: errors.concat(warnings),
  };
}

function dataIdMessage(level, issue, htmlPath) {
  return {
    level,
    code: issue.code,
    file: htmlPath,
    attribute: issue.name,
    message: issue.message,
    ...(issue.policy ? { policy: issue.policy } : {}),
  };
}

function withDataIdAudit(result, dataIdAudit) {
  if (!dataIdAudit) return result;
  const errors = result.errors.concat(dataIdAudit.errors);
  const warnings = result.warnings.concat(dataIdAudit.warnings);
  return {
    ...result,
    valid: errors.length === 0,
    errors,
    warnings,
    messages: errors.concat(warnings),
  };
}

function publicSemanticPresetMetadata(resolvedPreset) {
  return {
    source: resolvedPreset.source,
    id: resolvedPreset.preset.id,
    ...(resolvedPreset.relativePath ? { relativePath: resolvedPreset.relativePath } : {}),
    ...(resolvedPreset.profile ? { profile: resolvedPreset.profile } : {}),
  };
}

module.exports = {
  AUTHORING_LINT_PROFILE_NAMES,
  DEFAULT_AUTHORING_LINT_PROFILE,
  GRID_OBSERVED_DOWNGRADED,
  lintAuthoringHtml,
  lintAuthoringPackage,
  normalizeLintPayload,
};
