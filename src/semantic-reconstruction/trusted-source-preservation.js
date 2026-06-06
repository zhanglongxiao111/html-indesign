function auditTrustedSourcePreservation(expectedModel, actualModel) {
  assertDocumentModel(expectedModel, 'expected');
  assertDocumentModel(actualModel, 'actual');

  const expected = collectTrustedSignatures(expectedModel);
  const actual = collectCurrentSignatures(actualModel);
  const failures = [];

  for (const entry of expected.pages) {
    const current = actual.pages.get(entry.key);
    collectMutationFailure(failures, entry, current);
  }
  for (const entry of expected.items) {
    const current = actual.items.get(entry.key);
    collectMutationFailure(failures, entry, current);
  }

  return {
    kind: 'TrustedSourcePreservationAudit',
    version: 1,
    ok: failures.length === 0,
    summary: {
      trustedPages: expected.pages.length,
      trustedItems: expected.items.length,
      checked: expected.pages.length + expected.items.length,
      mutations: failures.filter((failure) => failure.code === 'TRUSTED_SOURCE_STRUCTURE_MUTATED').length,
      missing: failures.filter((failure) => failure.code === 'TRUSTED_SOURCE_ITEM_MISSING').length,
    },
    failures,
    warnings: [],
  };
}

function collectTrustedSignatures(model) {
  const pages = [];
  const items = [];
  for (const [pageIndex, page] of (model.pages || []).entries()) {
    if (isTrustedSourceEntity(page)) {
      pages.push(signatureForPage(page, pageIndex));
    }
    for (const [itemIndex, item] of (page.items || []).entries()) {
      if (!isTrustedSourceEntity(item)) continue;
      items.push(signatureForItem(page, item, pageIndex, itemIndex));
    }
  }
  return { pages, items };
}

function collectCurrentSignatures(model) {
  const pages = new Map();
  const items = new Map();
  for (const [pageIndex, page] of (model.pages || []).entries()) {
    pages.set(pageKey(page, pageIndex), signatureForPage(page, pageIndex));
    for (const [itemIndex, item] of (page.items || []).entries()) {
      items.set(itemKey(item, itemIndex), signatureForItem(page, item, pageIndex, itemIndex));
    }
  }
  return { pages, items };
}

function signatureForPage(page, pageIndex) {
  return {
    kind: 'page',
    key: pageKey(page, pageIndex),
    pageId: page.id || null,
    path: `pages[${pageIndex}]`,
    fields: stableFields(page),
  };
}

function signatureForItem(page, item, pageIndex, itemIndex) {
  return {
    kind: 'item',
    key: itemKey(item, itemIndex),
    pageId: page && page.id || null,
    itemId: item && item.id || null,
    path: `pages[${pageIndex}].items[${itemIndex}]`,
    fields: stableFields(item),
  };
}

function stableFields(entity = {}) {
  return {
    semantic: entity.semantic || null,
    sourceAncestorNodes: normalizeSourceAncestorNodes(entity.sourceAncestorNodes),
    sourceNode: normalizeSourceNode(entity.sourceNode),
    structure: stableValue(entity.structure || null),
    tagName: entity.tagName || null,
  };
}

function collectMutationFailure(failures, expected, actual) {
  if (!actual) {
    failures.push({
      code: 'TRUSTED_SOURCE_ITEM_MISSING',
      message: 'Trusted source page or item is missing after semantic reconstruction.',
      kind: expected.kind,
      pageId: expected.pageId || null,
      itemId: expected.itemId || null,
      path: expected.path,
      changedFields: ['item'],
    });
    return;
  }
  const changedFields = Object.keys(expected.fields)
    .filter((field) => stableString(expected.fields[field]) !== stableString(actual.fields[field]));
  if (!changedFields.length) return;
  failures.push({
    code: 'TRUSTED_SOURCE_STRUCTURE_MUTATED',
    message: 'Trusted source page or item structure changed during semantic reconstruction.',
    kind: expected.kind,
    pageId: expected.pageId || null,
    itemId: expected.itemId || null,
    path: expected.path,
    changedFields,
    before: pickFields(expected.fields, changedFields),
    after: pickFields(actual.fields, changedFields),
  });
}

function isTrustedSourceEntity(entity) {
  return Boolean(entity && entity.labelStatus === 'accepted' && entity.sourceNode);
}

function normalizeSourceAncestorNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => normalizeSourceNode(node));
}

function normalizeSourceNode(sourceNode) {
  if (!sourceNode) return null;
  const attrs = sourceNode.attributes && typeof sourceNode.attributes === 'object'
    ? stableValue(sourceNode.attributes)
    : {};
  return {
    tagName: sourceNode.tagName || null,
    id: sourceNode.id || null,
    classList: classList(sourceNode.classList),
    attributes: attrs,
    sourceHtml: sourceNode.sourceHtml || null,
  };
}

function classList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).sort();
  return String(value || '').split(/\s+/).map((item) => item.trim()).filter(Boolean).sort();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

function stableString(value) {
  return JSON.stringify(stableValue(value));
}

function pickFields(fields, names) {
  return Object.fromEntries(names.map((name) => [name, fields[name]]));
}

function pageKey(page, pageIndex) {
  return page && page.id ? `page:${page.id}` : `page-index:${pageIndex}`;
}

function itemKey(item, itemIndex) {
  return item && item.id ? `item:${item.id}` : `item-index:${itemIndex}`;
}

function assertDocumentModel(model, label) {
  if (!model || model.kind !== 'DocumentModel') {
    throw new Error(`auditTrustedSourcePreservation requires a ${label} DocumentModel`);
  }
}

module.exports = {
  auditTrustedSourcePreservation,
  isTrustedSourceEntity,
};
