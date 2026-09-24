const { snapshotToSemanticModel } = require('../adapters/html');

// html.compile_instructions / html.build_indesign 的 compile 阶段把 lint 用过的同一份快照交给
// snapshotToSemanticModel，语义模型校验（validateSemanticModel）不过就整次构建失败。
// lint 在这里用同一个函数、同一组版面默认值跑一遍，把 compile 会拒绝的输入提前报成 lint error：
// 判定逻辑只有语义模型校验这一份，lint 不另写第二套规则，两边不会再走散（#25）。
// targetSize 比例不符等只取决于构建参数的失败不属于作者包问题，这里固定用 compile 的默认值。
const COMPILE_MODEL_OPTIONS = Object.freeze({
  mode: 'editable-first',
  unitMode: 'presentation',
  targetSize: 'same',
});
const SEMANTIC_MODEL_STAGE = 'semantic-model';
const MODEL_VALIDATION_FAILED = 'SEMANTIC_MODEL_VALIDATION_FAILED';
const ITEM_ID_DUPLICATED = 'ITEM_ID_DUPLICATED';
const ERROR_CODE_RE = /^[A-Z][A-Z0-9_]+$/;

// compile 先拦兼容性 blocked，再做语义模型；lint 两项都跑，好让一次 lint 暴露全部问题。
// 兼容性已 blocked 时，除重复 id 外的模型错误可能只是 blocked 内容的连带后果，逐条注明，不隐藏。
function auditSemanticModelPrecheck(snapshot, options = {}) {
  try {
    snapshotToSemanticModel(snapshot, COMPILE_MODEL_OPTIONS);
    return { valid: true, errors: [] };
  } catch (error) {
    const errors = precheckErrorsFor(error, options.compatibilityBlocked === true);
    // 没有错误码的异常是转换器自身的缺陷，不能包装成一条看似普通的作者错误。
    if (!errors) throw error;
    return { valid: errors.length === 0, errors };
  }
}

function precheckErrorsFor(error, compatibilityBlocked) {
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

function duplicateKey(pageId, itemId) {
  return JSON.stringify([pageId == null ? null : String(pageId), itemId == null ? null : String(itemId)]);
}

function stripCodePrefix(message, code) {
  const text = String(message || code);
  return text.startsWith(`${code}: `) ? text.slice(code.length + 2) : text;
}

module.exports = {
  auditSemanticModelPrecheck,
};
