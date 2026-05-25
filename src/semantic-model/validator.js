function validateSemanticModel(model) {
  const errors = [];
  if (!model || model.kind !== 'DocumentModel') {
    errors.push({ code: 'SEMANTIC_MODEL_INVALID', message: 'Expected DocumentModel.' });
    return { valid: false, errors, warnings: [] };
  }
  if (!hasLabel(model.labels, 'document')) {
    errors.push({ code: 'DOCUMENT_LABEL_MISSING', message: 'Document html_indesign label is missing.' });
  }
  if (!Array.isArray(model.pages) || model.pages.length === 0) {
    errors.push({ code: 'PAGE_MISSING', message: 'DocumentModel requires at least one page.' });
  }
  for (const page of model.pages || []) {
    validatePage(page, errors);
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

function validatePage(page, errors) {
  if (!page.id) errors.push({ code: 'PAGE_ID_MISSING', message: 'Page id is missing.' });
  if (!hasLabel(page.labels, 'page')) {
    errors.push({ code: 'PAGE_LABEL_MISSING', pageId: page.id, message: 'Page html_indesign label is missing.' });
  }
  const ids = new Set();
  for (const item of page.items || []) {
    if (ids.has(item.id)) {
      errors.push({ code: 'ITEM_ID_DUPLICATED', pageId: page.id, itemId: item.id, message: `Duplicate item id: ${item.id}` });
    }
    ids.add(item.id);
    if (!hasLabel(item.labels, 'item')) {
      errors.push({ code: 'ITEM_LABEL_MISSING', pageId: page.id, itemId: item.id, message: 'Item html_indesign label is missing.' });
    }
  }
}

function hasLabel(labels, kind) {
  return (labels || []).some((label) => label && label.kind === kind && label.id);
}

module.exports = {
  validateSemanticModel,
};
