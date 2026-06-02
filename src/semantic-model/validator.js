const {
  fieldRegistry,
  scanModelPaths,
  validateLabelFields,
  validateModelFields,
} = require('../protocol');
const {
  modelFieldDomainsInclude,
  normalizeModelFieldDomains,
} = require('../protocol/validators/model-field-domains');
const hasOwn = Object.prototype.hasOwnProperty;

const STYLE_LABEL_COLLECTION_KEYS = Object.freeze([
  'paragraphStyles',
  'characterStyles',
  'objectStyles',
  'frameStyles',
  'tableStyles',
  'cellStyles',
]);

function validateSemanticModel(model, options = {}) {
  const errors = [];
  const warnings = [];
  let fieldValidation = null;
  let labelValidation = null;
  const fieldDomains = normalizeModelFieldDomains(fieldDomainsOption(options));
  if (!model || model.kind !== 'DocumentModel') {
    errors.push({ code: 'SEMANTIC_MODEL_INVALID', message: 'Expected DocumentModel.' });
    return { valid: false, errors, warnings };
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
  if (options.strictFields === true || options.warnFields === true) {
    fieldValidation = validateModelFields(
      fieldRegistry,
      scanModelPaths(model),
      {
        strict: options.strictFields === true,
        domains: fieldDomains || undefined,
      },
    );
    warnings.push(...fieldValidation.warnings);
    if (options.strictFields === true) {
      errors.push(...fieldValidation.errors);
    }
    labelValidation = validateRawLabelFields(
      model,
      {
        strict: options.strictFields === true && modelFieldDomainsInclude(fieldDomains, 'labels'),
      },
    );
    warnings.push(...labelValidation.warnings);
    if (options.strictFields === true) {
      errors.push(...labelValidation.errors);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fieldValidation,
    labelValidation,
  };
}

function fieldDomainsOption(options) {
  if (hasOwn.call(options, 'fieldDomains') && hasOwn.call(options, 'strictFieldDomains')) {
    throw new Error('SEMANTIC_FIELD_DOMAINS_CONFLICT');
  }
  if (hasOwn.call(options, 'fieldDomains')) {
    return options.fieldDomains;
  }
  if (hasOwn.call(options, 'strictFieldDomains')) {
    return options.strictFieldDomains;
  }
  return undefined;
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

function validateRawLabelFields(model, options) {
  const strict = options.strict === true;
  const labels = collectRawLabels(model);
  const results = [];
  const warnings = [];
  const errors = [];

  for (const entry of labels) {
    const result = validateLabelFields(
      fieldRegistry,
      entry.label,
      { strict, kind: entry.label.kind },
    );
    const decoratedWarnings = result.warnings.map((warning) => decorateLabelIssue(warning, entry));
    const decoratedErrors = result.errors.map((error) => decorateLabelIssue(error, entry));
    warnings.push(...decoratedWarnings);
    errors.push(...decoratedErrors);
    results.push({
      labelPath: entry.labelPath,
      surfacePath: entry.surfacePath,
      kind: entry.label.kind,
      validation: {
        ...result,
        warnings: decoratedWarnings,
        errors: decoratedErrors,
      },
    });
  }

  return {
    valid: errors.length === 0,
    labels: results,
    warnings,
    errors,
  };
}

function collectRawLabels(model) {
  const entries = [];

  collectLabelArray(entries, model.labels, 'labels', 'labels[]');

  forEachPlainObject(model.parentPages, (parentPage, parentPageIndex) => {
    collectLabelArray(
      entries,
      parentPage.labels,
      `parentPages[${parentPageIndex}].labels`,
      'parentPages[].labels[]',
    );
    collectItemLabels(
      entries,
      parentPage.items,
      `parentPages[${parentPageIndex}].items`,
      'parentPages[].items[].labels[]',
    );
  });

  forEachPlainObject(model.pages, (page, pageIndex) => {
    collectLabelArray(
      entries,
      page.labels,
      `pages[${pageIndex}].labels`,
      'pages[].labels[]',
    );
    collectItemLabels(
      entries,
      page.items,
      `pages[${pageIndex}].items`,
      'pages[].items[].labels[]',
    );
  });

  forEachPlainObject(model.layers, (layer, layerIndex) => {
    collectLabelArray(
      entries,
      layer.labels,
      `layers[${layerIndex}].labels`,
      'layers[].labels[]',
    );
  });

  collectStyleLabels(entries, model.styles);

  return entries;
}

function collectItemLabels(entries, items, itemPath, surfacePath) {
  forEachPlainObject(items, (item, itemIndex) => {
    collectLabelArray(
      entries,
      item.labels,
      `${itemPath}[${itemIndex}].labels`,
      surfacePath,
    );
  });
}

function collectStyleLabels(entries, styles) {
  if (Array.isArray(styles)) {
    collectStyleResourceLabels(entries, styles, 'styles', 'styles[].labels[]');
    return;
  }
  if (!isPlainObject(styles)) return;

  for (const collectionKey of STYLE_LABEL_COLLECTION_KEYS) {
    const collection = styles[collectionKey];
    const collectionPath = `styles.${collectionKey}`;
    collectStyleResourceLabels(
      entries,
      collection,
      collectionPath,
      `${collectionPath}[].labels[]`,
    );
  }
}

function collectStyleResourceLabels(entries, collection, collectionPath, surfacePath) {
  if (Array.isArray(collection)) {
    forEachPlainObject(collection, (resource, resourceIndex) => {
      collectLabelArray(
        entries,
        resource.labels,
        `${collectionPath}[${resourceIndex}].labels`,
        surfacePath,
      );
    });
    return;
  }
  if (!isPlainObject(collection)) return;

  for (const [styleKey, resource] of Object.entries(collection)) {
    if (!isPlainObject(resource)) {
      continue;
    }
    collectLabelArray(
      entries,
      resource.labels,
      `${collectionPath}.${styleKey}.labels`,
      surfacePath,
    );
  }
}

function collectLabelArray(entries, labels, labelArrayPath, surfacePath) {
  forEachPlainObject(labels, (label, labelIndex) => {
    entries.push({
      label,
      labelPath: `${labelArrayPath}[${labelIndex}]`,
      surfacePath,
    });
  });
}

function forEachPlainObject(values, visit) {
  if (!Array.isArray(values)) return;

  values.forEach((value, index) => {
    if (isPlainObject(value)) {
      visit(value, index);
    }
  });
}

function decorateLabelIssue(issue, entry) {
  return {
    ...issue,
    labelPath: entry.labelPath,
    surfacePath: entry.surfacePath,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  validateSemanticModel,
};
