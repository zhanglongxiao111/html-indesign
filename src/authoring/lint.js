const fs = require('fs');
const path = require('path');
const { renderSnapshot, validateAuthoringRules } = require('../adapters/html');
const {
  auditAuthorPackageSourceFormat,
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

async function lintAuthoringPackage(options = {}) {
  const packagePath = path.resolve(requiredPath(options.packagePath, 'packagePath'));
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
    });
  }

  const packageCheck = checkAuthorPackageEntry(packagePath);
  if (!packageCheck.ok) {
    const message = `AUTHOR_GENERATED_ENTRY_DIRTY: ${packageCheck.message}: ${packageCheck.entryPath}`;
    return normalizeLintPayload(packageFailure(sourceFormat, {
      code: 'AUTHOR_GENERATED_ENTRY_DIRTY',
      message,
      entryPath: packageCheck.entryPath,
    }, null, semanticPreset), {
      packagePath,
      htmlPath: packageCheck.entryPath,
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
    });
  }

  const htmlResult = await lintAuthoringHtml({
    htmlPath: packageCheck.entryPath,
    strict: options.strict,
    gridTolerance: options.gridTolerance,
  });

  const errors = (sourceFormat.errors || [])
    .concat(semanticAudit.errors || [], htmlResult.errors || []);
  const warnings = (sourceFormat.warnings || [])
    .concat(semanticAudit.warnings || [], htmlResult.warnings || []);

  return normalizeLintPayload({
    ok: errors.length === 0,
    valid: errors.length === 0,
    htmlPath: packageCheck.entryPath,
    packagePath,
    dataIdAudit: htmlResult.dataIdAudit,
    sourceFormat,
    semanticPreset,
    semanticAudit,
    errors,
    warnings,
    messages: errors.concat(warnings),
  }, {
    packagePath,
    htmlPath: packageCheck.entryPath,
  });
}

async function lintAuthoringHtml(options = {}) {
  const htmlPath = path.resolve(requiredPath(options.htmlPath, 'htmlPath'));
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
    }, { htmlPath });
  }
  const snapshot = await renderSnapshot({ htmlPath });
  const result = withDataIdAudit(validateAuthoringRules(snapshot, {
    strict: options.strict,
    gridTolerance: options.gridTolerance,
  }), dataIdAudit);

  return normalizeLintPayload({
    ok: result.valid,
    htmlPath,
    dataIdAudit,
    runtimeAudit,
    ...withRuntimeAudit(result, runtimeAudit),
  }, {
    htmlPath,
  });
}

function withRuntimeAudit(result, runtimeAudit) {
  const errors = result.errors.concat(runtimeAudit.errors);
  const warnings = result.warnings.concat(runtimeAudit.warnings);
  return {
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
  const warnings = payload.warnings || [];
  const messages = payload.messages || errors.concat(warnings);
  return {
    ...payload,
    ok: errors.length === 0,
    valid: errors.length === 0,
    ...(paths.packagePath ? { packagePath: paths.packagePath } : {}),
    ...(paths.htmlPath ? { htmlPath: paths.htmlPath } : {}),
    errors,
    warnings,
    messages,
    issueCount: messages.length,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
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
  lintAuthoringHtml,
  lintAuthoringPackage,
};
