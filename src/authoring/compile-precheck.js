const { snapshotToSemanticModel } = require('../adapters/html');
const { compileDocument } = require('../indesign-pipeline');
const { validateInstructions } = require('../writers/indesign');
const { compileDocumentOptions } = require('./compile-options');

// html.compile_instructions / html.build_indesign 的 compile 阶段把 lint 用过的同一份快照交给
// compileDocument（snapshotToSemanticModel -> validateSemanticModel -> semanticModelToInstructions），
// 再用 validateInstructions 检查构建指令；任何一步不过，整次构建失败。
// lint 在这里走同一条路径、用同一份编译选项（compile-options.js），把 compile 会拒绝的输入
// 提前报成 lint error。判定逻辑只有 compile 这一份，lint 不另写第二套规则（#25）。
//
// 两个阶段分开标注：
// - stage "semantic-model"：语义模型转换或校验失败（如同页重复 id ITEM_ID_DUPLICATED）；
// - stage "instructions"：构建指令校验失败（如资源文件缺失 ASSET_FILE_NOT_FOUND）。
// 只有 htmlPath、没有作者包时拿不到语义库 styleNameMap，编译选项与 compile 不一致，
// 只做语义模型那一步（与样式名无关），不做构建指令校验。
const SEMANTIC_MODEL_STAGE = 'semantic-model';
const INSTRUCTIONS_STAGE = 'instructions';
const MODEL_VALIDATION_FAILED = 'SEMANTIC_MODEL_VALIDATION_FAILED';
const ITEM_ID_DUPLICATED = 'ITEM_ID_DUPLICATED';
const ASSET_FILE_NOT_FOUND = 'ASSET_FILE_NOT_FOUND';
const ERROR_CODE_RE = /^[A-Z][A-Z0-9_]+$/;

// options.compileOptions：authorPackageCompileOptions() 的结果；缺省时只做语义模型一步。
// options.compatibilityBlocked：compile 先拦兼容性 blocked，再做后续步骤；lint 全部都跑，
// 好让一次 lint 暴露全部问题。blocked 时除重复 id 外的条目可能只是连带后果，逐条注明，不隐藏。
function auditCompilePrecheck(snapshot, options = {}) {
  const compileOptions = options.compileOptions || null;
  const compatibilityBlocked = options.compatibilityBlocked === true;
  let compiled;
  try {
    compiled = compileOptions
      ? compileDocument(snapshot, compileOptions.document)
      : { model: snapshotToSemanticModel(snapshot, compileDocumentOptions()), instructions: null };
  } catch (error) {
    const errors = modelStageErrorsFor(error, compatibilityBlocked);
    // 没有错误码的异常是转换器自身的缺陷，不能包装成一条看似普通的作者错误。
    if (!errors) throw error;
    return precheckResult(errors, compileOptions);
  }
  if (!compileOptions) return precheckResult([], compileOptions);

  const validation = validateInstructions(compiled.instructions, compileOptions.instructionValidation);
  const errors = (validation.errors || []).map((issue) => withBlockedHint(
    instructionError(issue, compiled.instructions, compiled.model),
    compatibilityBlocked,
  ));
  return precheckResult(errors, compileOptions);
}

function precheckResult(errors, compileOptions) {
  return {
    valid: errors.length === 0,
    stages: compileOptions ? [SEMANTIC_MODEL_STAGE, INSTRUCTIONS_STAGE] : [SEMANTIC_MODEL_STAGE],
    errors,
  };
}

function modelStageErrorsFor(error, compatibilityBlocked) {
  if (!error) return null;
  if (error.code === MODEL_VALIDATION_FAILED && error.validation) {
    return modelValidationErrors(error.validation.errors || [], error.model, compatibilityBlocked);
  }
  if (typeof error.code === 'string' && ERROR_CODE_RE.test(error.code)) {
    return [withBlockedHint({
      level: 'error',
      code: error.code,
      stage: SEMANTIC_MODEL_STAGE,
      message: `${stripCodePrefix(error.message, error.code)} (compile stops here: snapshotToSemanticModel)`,
    }, compatibilityBlocked)];
  }
  return null;
}

function withBlockedHint(entry, compatibilityBlocked) {
  if (!compatibilityBlocked) return entry;
  return {
    ...entry,
    hint: 'HTML compatibility is blocked in this lint run; this error may be a side effect of the blocked content. Fix the blocked items first, then lint again.',
  };
}

function modelValidationErrors(issues, model, compatibilityBlocked) {
  const duplicateKeys = new Set();
  const out = [];
  for (const issue of issues) {
    if (issue && issue.code === ITEM_ID_DUPLICATED) {
      duplicateKeys.add(duplicateKey(issue.pageId, issue.itemId));
      continue;
    }
    out.push(withBlockedHint(genericValidationError(issue), compatibilityBlocked));
  }
  if (duplicateKeys.size) out.unshift(...duplicateItemIdErrors(duplicateKeys, model));
  return out;
}

// 判重范围由 validateSemanticModel 决定（同一页的 page.items；母版家具不在其中），
// 这里只负责把它报出的每组重复展开成全部出现位置，不重新判定。
function duplicateItemIdErrors(duplicateKeys, model) {
  const errors = [];
  const pages = model && Array.isArray(model.pages) ? model.pages : [];
  for (const page of pages) {
    const items = Array.isArray(page.items) ? page.items : [];
    const pageIds = new Set(items.map((item) => item && item.id));
    const seen = new Set();
    for (const item of items) {
      const key = duplicateKey(page.id, item && item.id);
      if (!duplicateKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      const occurrences = items
        .filter((candidate) => candidate && candidate.id === item.id)
        .map((candidate) => occurrenceFor(candidate, page));
      if (occurrences.length < 2) continue;
      errors.push(duplicateItemIdError(page, item.id, occurrences, pageIds));
    }
  }
  return errors;
}

function duplicateItemIdError(page, itemId, occurrences, pageIds) {
  const renames = occurrences.slice(1).map((occurrence) => ({
    occurrence,
    to: unusedId(itemId, pageIds),
  }));
  const files = [...new Set(occurrences.map((occurrence) => occurrence.sourceFile).filter(Boolean))];
  const where = occurrences.map(describeOccurrence).join('; ');
  const renameText = renames
    .map(({ occurrence, to }) => `${describeOccurrence(occurrence)} -> id="${to}"`)
    .join('; ');
  return {
    level: 'error',
    code: ITEM_ID_DUPLICATED,
    stage: SEMANTIC_MODEL_STAGE,
    pageId: page.id,
    itemId,
    duplicateId: itemId,
    ...(files.length === 1 ? { sourceFile: files[0] } : {}),
    occurrences,
    message: `Page ${page.id} has ${occurrences.length} objects with id "${itemId}": ${where}. `
      + 'Object ids must be unique within a page; the compile stage rejects this page (ITEM_ID_DUPLICATED).',
    suggestedFix: `Keep the first, rename the rest: ${renameText}. `
      + `Also update CSS selectors or links that target #${itemId} for the renamed element, then reassemble the package.`,
  };
}

function occurrenceFor(item, page) {
  const sourceNode = item.sourceNode || {};
  return {
    tagName: item.tagName || sourceNode.tagName || null,
    sourceFile: item.sourceFile || page.sourceFile || null,
    sourcePath: sourceNode.sourcePath || null,
    classList: Array.isArray(item.classList) ? item.classList.slice() : [],
  };
}

function describeOccurrence(occurrence) {
  const tag = `<${occurrence.tagName || 'element'}>`;
  const location = [occurrence.sourceFile, occurrence.sourcePath].filter(Boolean).join(' ');
  return location ? `${tag} at ${location}` : tag;
}

function unusedId(base, taken) {
  let index = 2;
  while (taken.has(`${base}-${index}`)) index += 1;
  const id = `${base}-${index}`;
  taken.add(id);
  return id;
}

function genericValidationError(issue) {
  const entry = {
    level: 'error',
    code: issue && issue.code || MODEL_VALIDATION_FAILED,
    stage: SEMANTIC_MODEL_STAGE,
    message: `${issue && issue.message || 'Semantic model validation failed.'} (compile stops here: validateSemanticModel)`,
  };
  for (const key of ['pageId', 'itemId', 'path', 'labelPath', 'surfacePath']) {
    if (issue && typeof issue[key] === 'string' && issue[key]) entry[key] = issue[key];
  }
  return entry;
}

// validateInstructions 的条目原样透传，再补上页面、源文件定位：
// 多数条目只带 itemId，资源文件缺失只带 assetId/path，Agent 需要知道改哪一页的哪个元素。
function instructionError(issue, instructions, model) {
  const entry = {
    ...issue,
    level: 'error',
    code: issue && issue.code || 'INSTRUCTIONS_VALIDATION_FAILED',
    stage: INSTRUCTIONS_STAGE,
  };
  if (entry.itemId && !entry.pageId) {
    const pageId = instructionPageIdFor(instructions, entry.itemId);
    if (pageId) entry.pageId = pageId;
  }
  if (entry.itemId && entry.pageId) {
    const source = modelItemSource(model, entry.pageId, entry.itemId);
    if (source) Object.assign(entry, withoutEmpty(source));
  }
  if (entry.code === ASSET_FILE_NOT_FOUND && entry.assetId) {
    return assetFileNotFoundError(entry, instructions, model);
  }
  entry.message = `${entry.message || entry.code} (compile stops here: validateInstructions)`;
  return entry;
}

function assetFileNotFoundError(entry, instructions, model) {
  const asset = (instructions.assets || []).find((candidate) => candidate && candidate.id === entry.assetId) || {};
  const usages = assetUsages(instructions, entry.assetId).map((usage) => ({
    ...usage,
    ...withoutEmpty(modelItemSource(model, usage.pageId, usage.itemId) || {}),
  }));
  const reference = asset.src || null;
  const out = {
    ...entry,
    ...(reference ? { src: reference } : {}),
    usages,
  };
  if (usages.length === 1) {
    out.pageId = usages[0].pageId;
    out.itemId = usages[0].itemId;
    if (usages[0].sourceFile) out.sourceFile = usages[0].sourceFile;
    if (usages[0].sourcePath) out.sourcePath = usages[0].sourcePath;
  }
  const where = usages.length
    ? ` Used by ${usages.map(describeUsage).join('; ')}.`
    : '';
  out.message = `Asset file not found: ${entry.path || reference || entry.assetId}`
    + `${reference && reference !== entry.path ? ` (referenced as "${reference}")` : ''}.${where}`
    + ' (compile stops here: validateInstructions)';
  out.suggestedFix = 'Make sure the file exists at that path and is reachable from this machine (UNC share online), '
    + 'or correct the src/href in the page file, then reassemble and lint again.';
  return out;
}

function assetUsages(instructions, assetId) {
  const usages = [];
  for (const page of instructions.pages || []) {
    for (const item of page.items || []) {
      if (item && item.placed && item.placed.assetId === assetId) {
        usages.push({ pageId: page.id, itemId: item.id });
      }
    }
  }
  return usages;
}

function describeUsage(usage) {
  const location = [usage.sourceFile, usage.sourcePath].filter(Boolean).join(' ');
  return `${usage.pageId}/${usage.itemId}${location ? ` (${location})` : ''}`;
}

function instructionPageIdFor(instructions, itemId) {
  for (const page of instructions.pages || []) {
    const items = (page.items || []).concat(page.parentPageItemOverrides || []);
    if (items.some((item) => item && item.id === itemId)) return page.id;
  }
  return null;
}

function modelItemSource(model, pageId, itemId) {
  const page = model && Array.isArray(model.pages)
    ? model.pages.find((candidate) => candidate && candidate.id === pageId)
    : null;
  if (!page) return null;
  const item = (page.items || []).find((candidate) => candidate && candidate.id === itemId);
  if (!item) return { sourceFile: page.sourceFile || null };
  const occurrence = occurrenceFor(item, page);
  return { sourceFile: occurrence.sourceFile, sourcePath: occurrence.sourcePath };
}

function withoutEmpty(values) {
  const out = {};
  for (const [key, value] of Object.entries(values)) {
    if (value != null && value !== '') out[key] = value;
  }
  return out;
}

function duplicateKey(pageId, itemId) {
  return JSON.stringify([pageId == null ? null : String(pageId), itemId == null ? null : String(itemId)]);
}

function stripCodePrefix(message, code) {
  const text = String(message || code);
  return text.startsWith(`${code}: `) ? text.slice(code.length + 2) : text;
}

module.exports = {
  auditCompilePrecheck,
};
