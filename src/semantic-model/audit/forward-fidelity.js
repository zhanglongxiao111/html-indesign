const path = require('node:path');

const { fieldRegistry } = require('../../protocol');
const { normalizeLineEndings } = require('../../shared/text');

const DEFAULT_OPTIONS = Object.freeze({
  boundsTolerance: 1,
  guideTolerance: 0.25,
  numberTolerance: 0.01,
});

const READABLE = new Set(['native', 'lossless', 'observe-only']);
const DURABLE = new Set(['native', 'lossless']);

const ITEM_LABEL_FIELDS = Object.freeze([
  ['role', 'items[].role'],
  ['semantic', 'items[].semantic'],
  ['layout', 'items[].layout'],
  ['sourceFile', 'items[].sourceFile'],
  ['sourceNode', 'items[].sourceNode'],
  ['sourceAncestorNodes', 'items[].sourceAncestorNodes'],
  ['sourceText', 'items[].sourceText'],
  ['sourceHtml', 'items[].sourceHtml'],
  ['sourceRuns', 'items[].sourceRuns'],
  ['structure', 'items[].structure'],
  ['htmlTag', 'items[].sourceHtmlTag'],
  ['className', 'items[].sourceClassName'],
]);

const PAGE_LABEL_FIELDS = Object.freeze([
  ['semantic', 'pages[].semantic'],
  ['layout', 'pages[].layout'],
  ['sourceNode', 'pages[].sourceNode'],
]);

const VECTOR_PATH_STYLE_FIELDS = Object.freeze([
  'fillColor',
  'fillOpacity',
  'strokeColor',
  'strokeWeight',
  'strokeOpacity',
  'opacity',
  'blendMode',
  'strokeStyle',
  'strokeLineCap',
  'strokeLineJoin',
  'strokeMiterLimit',
  'strokeAlignment',
  'lineStartMarker',
  'lineEndMarker',
]);

function auditForwardFidelity(input = {}, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const expectedModel = input.expectedModel || {};
  const actualModel = input.actualModel || {};
  const instructions = input.instructions || {};
  const actualSnapshot = input.actualSnapshot || {};
  const inputErrors = validateAuditInput({ expectedModel, actualModel, instructions, actualSnapshot });
  if (inputErrors.length) {
    return {
      kind: 'ForwardFidelityAuditReport',
      ok: false,
      capabilitySource: 'src/protocol',
      comparedPaths: [],
      tolerances: {
        bounds: opts.boundsTolerance,
        guides: opts.guideTolerance,
        number: opts.numberTolerance,
      },
      summary: { pages: 0, items: 0, parentPages: 0, assets: 0, errors: inputErrors.length, warnings: 0 },
      errors: inputErrors,
      warnings: [],
    };
  }
  const errors = [];
  const warnings = [];
  const comparedPaths = new Set();
  const context = {
    opts,
    errors,
    warnings,
    comparedPaths,
    instructions,
    actualSnapshot,
  };

  const expectedPages = array(instructions.pages);
  const actualPages = protocolMap(actualSnapshot.pages, 'page');
  const expectedModelPages = valueMap(expectedModel.pages);
  const actualModelPages = valueMap(actualModel.pages);

  comparePageCountAndOrder(expectedPages, actualSnapshot.pages, actualPages, errors);
  for (const expectedPage of expectedPages) {
    const actualPage = actualPages.get(String(expectedPage.id));
    if (!actualPage) continue;
    comparePage(
      expectedPage,
      actualPage,
      expectedModelPages.get(String(expectedPage.id)),
      actualModelPages.get(String(expectedPage.id)),
      context,
    );
  }

  compareParentPages(
    array(instructions.document && instructions.document.parentPages),
    array(actualSnapshot.parentPages),
    context,
  );
  compareAssets(array(instructions.assets), array(actualSnapshot.assets), context);
  compareStyleRegistrations(instructions.styles || {}, actualSnapshot.styles || {}, context);
  compareDocumentHealth(actualSnapshot, context);

  return {
    kind: 'ForwardFidelityAuditReport',
    ok: errors.length === 0,
    capabilitySource: 'src/protocol',
    comparedPaths: Array.from(comparedPaths).sort(),
    tolerances: {
      bounds: opts.boundsTolerance,
      guides: opts.guideTolerance,
      number: opts.numberTolerance,
    },
    summary: {
      pages: expectedPages.length,
      items: expectedPages.reduce((sum, page) => sum + pageInstructionItems(page).length, 0),
      parentPages: array(instructions.document && instructions.document.parentPages).length,
      assets: array(instructions.assets).length,
      errors: errors.length,
      warnings: warnings.length,
    },
    errors,
    warnings,
  };
}

function validateAuditInput({ expectedModel, actualModel, instructions, actualSnapshot }) {
  const errors = [];
  for (const [name, value] of [['expectedModel', expectedModel], ['actualModel', actualModel]]) {
    if (!value || value.kind !== 'DocumentModel' || !Array.isArray(value.pages) || value.pages.length < 1) {
      errors.push({
        code: 'FORWARD_FIDELITY_INPUT_INVALID',
        field: name,
        message: `${name} must be a DocumentModel with at least one page.`,
      });
    }
  }
  if (!instructions || !instructions.document || !Array.isArray(instructions.pages) || instructions.pages.length < 1) {
    errors.push({
      code: 'FORWARD_FIDELITY_INPUT_INVALID',
      field: 'instructions',
      message: 'instructions must contain a document and at least one page.',
    });
  }
  if (!actualSnapshot || !actualSnapshot.document || !Array.isArray(actualSnapshot.pages) || actualSnapshot.pages.length < 1) {
    errors.push({
      code: 'FORWARD_FIDELITY_INPUT_INVALID',
      field: 'actualSnapshot',
      message: 'actualSnapshot must contain a document and at least one page.',
    });
  }
  return errors;
}

function comparePageCountAndOrder(expectedPages, actualPageList, actualPages, errors) {
  const actualProtocolPages = array(actualPageList)
    .map((page) => ({ page, label: protocolLabel(page, 'page') }))
    .filter((entry) => entry.label && entry.label.id);
  if (expectedPages.length !== actualProtocolPages.length) {
    errors.push({
      code: 'FORWARD_PAGE_COUNT_CHANGED',
      field: 'pages',
      expected: expectedPages.length,
      actual: actualProtocolPages.length,
    });
  }
  expectedPages.forEach((page, index) => {
    const id = String(page.id);
    if (!actualPages.has(id)) {
      errors.push({ code: 'FORWARD_PAGE_MISSING', pageId: id, field: 'pages[].id', expected: id, actual: null });
      return;
    }
    const actualIdAtIndex = actualProtocolPages[index] && String(actualProtocolPages[index].label.id);
    if (actualIdAtIndex !== id) {
      errors.push({
        code: 'FORWARD_PAGE_ORDER_CHANGED',
        pageId: id,
        field: 'pages[].index',
        expected: index,
        actual: actualProtocolPages.findIndex((entry) => String(entry.label.id) === id),
      });
    }
  });
  const expectedIds = new Set(expectedPages.map((page) => String(page.id)));
  for (const entry of actualProtocolPages) {
    const id = String(entry.label.id);
    if (!expectedIds.has(id)) {
      errors.push({ code: 'FORWARD_PAGE_EXTRA', pageId: id, field: 'pages[].id', expected: null, actual: id });
    }
  }
}

function comparePage(expected, actual, expectedModelPage, actualModelPage, context) {
  const pageId = String(expected.id);
  compareField(context, 'pages[].width', expected.width, actual.bounds && actual.bounds.width, {
    code: 'FORWARD_PAGE_GEOMETRY_CHANGED', pageId, field: 'width', tolerance: context.opts.boundsTolerance,
  });
  compareField(context, 'pages[].height', expected.height, actual.bounds && actual.bounds.height, {
    code: 'FORWARD_PAGE_GEOMETRY_CHANGED', pageId, field: 'height', tolerance: context.opts.boundsTolerance,
  });
  compareField(context, 'pages[].margins', expected.margins || null, actual.margins || null, {
    code: 'FORWARD_PAGE_GEOMETRY_CHANGED', pageId, field: 'margins', tolerance: context.opts.boundsTolerance,
  });
  compareField(context, 'pages[].guides', guideFacts(expected.guides), guideFacts(actual.guides), {
    code: 'FORWARD_PAGE_GEOMETRY_CHANGED', pageId, field: 'guides', tolerance: context.opts.guideTolerance,
  });

  const expectedLabel = protocolLabel(expected, 'page') || {};
  const actualLabel = protocolLabel(actual, 'page') || {};
  compareLabelFacts(expectedLabel, actualLabel, PAGE_LABEL_FIELDS, { pageId }, context);
  if (expectedModelPage && actualModelPage) {
    for (const [field, protocolPath] of [['semantic', 'pages[].semantic'], ['layout', 'pages[].layout']]) {
      if (expectedModelPage[field] == null) continue;
      compareField(context, protocolPath, expectedModelPage[field], actualModelPage[field], {
        code: 'FORWARD_PAGE_SEMANTIC_CHANGED', pageId, field,
      });
    }
  }

  compareItems(pageInstructionItems(expected), array(actual.items), array(actualModelPage && actualModelPage.items), {
    scope: 'page',
    pageId,
  }, context);
}

function compareParentPages(expectedParents, actualParents, context) {
  const actualById = protocolMap(actualParents, 'parentPage');
  for (const expected of expectedParents) {
    const parentPageId = String(expected.id);
    const actual = actualById.get(parentPageId);
    if (!actual) {
      context.errors.push({
        code: 'FORWARD_PARENT_PAGE_MISSING',
        parentPageId,
        field: 'parentPages[].id',
        expected: parentPageId,
        actual: null,
      });
      continue;
    }
    compareField(context, 'pages[].width', expected.width || expected.bounds && expected.bounds.width, actual.bounds && actual.bounds.width, {
      code: 'FORWARD_PARENT_PAGE_GEOMETRY_CHANGED', parentPageId, field: 'width', tolerance: context.opts.boundsTolerance,
    });
    compareField(context, 'pages[].height', expected.height || expected.bounds && expected.bounds.height, actual.bounds && actual.bounds.height, {
      code: 'FORWARD_PARENT_PAGE_GEOMETRY_CHANGED', parentPageId, field: 'height', tolerance: context.opts.boundsTolerance,
    });
    compareItems(array(expected.items), array(actual.items), [], {
      scope: 'parentPage',
      parentPageId,
    }, context);
  }
  const expectedIds = new Set(expectedParents.map((parent) => String(parent.id)));
  for (const actual of actualParents) {
    const label = protocolLabel(actual, 'parentPage');
    if (!label || !label.id || expectedIds.has(String(label.id))) continue;
    if (array(actual.items).some((item) => protocolLabel(item, 'item'))) {
      context.errors.push({
        code: 'FORWARD_PARENT_PAGE_EXTRA',
        parentPageId: String(label.id),
        field: 'parentPages[].id',
        expected: null,
        actual: String(label.id),
      });
    }
  }
}

function compareItems(expectedItems, actualItems, actualModelItems, scope, context) {
  const actualById = protocolMap(actualItems, 'item');
  const actualModelById = valueMap(actualModelItems);
  const expectedIds = new Set();
  for (const expected of expectedItems) {
    const itemId = String(expected.id);
    expectedIds.add(itemId);
    const actual = actualById.get(itemId);
    if (!actual) {
      context.errors.push({
        code: 'FORWARD_ITEM_MISSING',
        ...scope,
        itemId,
        field: 'items[].id',
        expected: itemId,
        actual: null,
      });
      continue;
    }
    compareItem(expected, actual, actualModelById.get(itemId), { ...scope, itemId }, context);
  }
  for (const actual of actualItems) {
    const label = protocolLabel(actual, 'item');
    if (!label || !label.id || expectedIds.has(String(label.id))) continue;
    context.errors.push({
      code: 'FORWARD_ITEM_EXTRA',
      ...scope,
      itemId: String(label.id),
      field: 'items[].id',
      expected: null,
      actual: String(label.id),
    });
  }
}

function compareItem(expected, actual, actualModelItem, identity, context) {
  const expectedLabel = protocolLabel(expected, 'item') || {};
  const actualLabel = protocolLabel(actual, 'item') || {};
  compareLabelFacts(expectedLabel, actualLabel, ITEM_LABEL_FIELDS, identity, context);

  const hasVectorGeometry = Boolean(expected.vectorGeometry && array(expected.vectorGeometry.paths).length);
  if (hasVectorGeometry) {
    compareVectorGeometry(expected, actual, actualModelItem, identity, context);
  } else if (String(expected.type || '').toUpperCase() === 'LINE') {
    compareLineGeometry(expected, actual, identity, context);
  } else {
    compareItemBounds(expected, actual, identity, context);
  }

  compareExpectedScalar('items[].layer', 'layer', expected.layer, actual.layerName, identity, context);
  compareExpectedScalar('items[].paragraphStyle', 'paragraphStyle', expected.paragraphStyle, actual.paragraphStyleName, identity, context);
  compareExpectedScalar('items[].objectStyle', 'objectStyle', expected.objectStyle, actual.objectStyleName, identity, context);
  compareExpectedScalar('items[].table.tableStyle', 'tableStyle', expected.tableStyle, actual.table && actual.table.tableStyle, identity, context);

  if (String(expected.type || '').toUpperCase() === 'TABLE' || expected.role === 'table') {
    compareTable(expected.rows, actual.table, identity, context);
  } else {
    compareText(expected, actual, actualModelItem, identity, context);
  }
  comparePlacedAsset(expected, actual, identity, context);
  if (!hasVectorGeometry) compareVisualStyle(expected, actual, identity, context);
}

function compareVectorGeometry(expected, actual, actualModelItem, identity, context) {
  const expectedPaths = array(expected.vectorGeometry && expected.vectorGeometry.paths);
  const actualGeometry = actualModelItem && actualModelItem.vectorGeometry || actual.vectorGeometry || null;
  const actualPaths = array(actualGeometry && actualGeometry.paths);
  const styles = context.instructions.styles || {};
  const expectedFallbackStyle = effectiveExpectedVisualStyle(expected, styles) || {};
  const actualFallbackStyle = actualModelItem && actualModelItem.visualStyle || actual.visualStyle || {};
  const expectedFacts = expectedPaths.map((path) => expectedVectorPathFact(path, expectedFallbackStyle, styles.swatches || {}));
  const actualFacts = actualPaths.map((path, index) => actualVectorPathFact(
    path,
    actualFallbackStyle,
    expectedFacts[index] && expectedFacts[index].visualStyle || {},
  ));
  const protocolPath = 'items[].vectorGeometry.paths';
  if (!isComparableProtocolPath(protocolPath)) return;
  context.comparedPaths.add(protocolPath);
  if (deepEqualWithTolerance(expectedFacts, actualFacts, context.opts.boundsTolerance)) return;
  context.errors.push({
    code: 'FORWARD_VECTOR_GEOMETRY_CHANGED',
    ...identity,
    field: 'vectorGeometry.paths',
    expected: expectedFacts,
    actual: actualFacts,
  });
}

function expectedVectorPathFact(path = {}, fallbackStyle = {}, swatches = {}) {
  const hasPathStyle = Boolean(path.visualStyle || path.styleOverride);
  const rawStyle = {
    ...(hasPathStyle ? {} : fallbackStyle),
    ...(path.visualStyle || {}),
    ...(path.styleOverride || {}),
  };
  const visualStyle = {};
  for (const field of VECTOR_PATH_STYLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(rawStyle, field) || rawStyle[field] === undefined) continue;
    visualStyle[field] = normalizeVectorPathStyleValue(field, rawStyle[field], true, swatches);
  }
  return vectorPathFact(path, visualStyle);
}

function actualVectorPathFact(path = {}, fallbackStyle = {}, expectedStyle = {}) {
  const rawStyle = { ...fallbackStyle, ...(path.visualStyle || {}) };
  const visualStyle = {};
  for (const field of Object.keys(expectedStyle)) {
    let value = normalizeVectorPathStyleValue(field, rawStyle[field], false, {});
    if (field === 'strokeWeight' && expectedStyle[field] === 0 && value == null) value = 0;
    visualStyle[field] = value;
  }
  return vectorPathFact(path, visualStyle);
}

function vectorPathFact(path = {}, visualStyle = {}) {
  return {
    closed: Boolean(path.closed),
    points: array(path.points).map((point) => ({
      anchor: vectorCoordinateFact(point && point.anchor),
      leftDirection: vectorCoordinateFact(point && (point.leftDirection || point.anchor)),
      rightDirection: vectorCoordinateFact(point && (point.rightDirection || point.anchor)),
    })),
    visualStyle,
  };
}

function vectorCoordinateFact(value = {}) {
  return { x: Number(value.x || 0), y: Number(value.y || 0) };
}

function normalizeVectorPathStyleValue(field, value, expected, swatches) {
  if (field.endsWith('Color') && value == null) return null;
  if (field === 'lineStartMarker' || field === 'lineEndMarker') {
    if (!value) return null;
    if (typeof value === 'string') return { type: String(value).toLowerCase() };
    return { type: value.type ? String(value.type).toLowerCase() : null };
  }
  let normalized = expected
    ? normalizeExpectedVisualValue(field, value, swatches)
    : normalizeActualVisualValue(field, value);
  if (field === 'strokeStyle') {
    const text = String(normalized == null ? '' : normalized).trim().toLowerCase();
    if (!text || text === 'none' || text === 'solid' || text === '$id/solid' || text === '实底') return 'solid';
    const dashPattern = strokeDashPattern(text);
    if (dashPattern) return `dash:${dashPattern.map(formatDashNumber).join(',')}`;
    if (text.includes('dot') || text.includes('点')) return 'dotted';
    if (text.includes('dash') || text.includes('虚')) return 'dashed';
    return text;
  }
  if (['blendMode', 'strokeLineCap', 'strokeLineJoin', 'strokeAlignment'].includes(field) && normalized != null) {
    normalized = String(normalized).toLowerCase();
  }
  return normalized;
}

function strokeDashPattern(value) {
  const text = String(value == null ? '' : value).trim();
  const numericOnly = /^\s*(?:\d+(?:\.\d+)?|\.\d+)\s*(?:px|pt|mm)?(?:\s*(?:,\s*|\s+)(?:\d+(?:\.\d+)?|\.\d+)\s*(?:px|pt|mm)?)+\s*$/i.test(text);
  if (!numericOnly && !/dash|虚线|点线/i.test(text)) return null;
  const tokens = text.match(/(?:\d+(?:\.\d+)?|\.\d+)\s*(?:px|pt|mm)?/gi) || [];
  if (tokens.length < 2 || tokens.length > 10) return null;
  const pattern = tokens.map((token) => {
    const match = /^((?:\d+(?:\.\d+)?|\.\d+))\s*(px|pt|mm)?$/i.exec(token.trim());
    if (!match) return NaN;
    const number = Number(match[1]);
    return String(match[2] || '').toLowerCase() === 'mm' ? number * 72 / 25.4 : number;
  });
  if (pattern.some((number) => !Number.isFinite(number) || number < 0) || !pattern.some((number) => number > 0)) return null;
  if (pattern.length % 2 === 1) {
    if (pattern.length * 2 > 10) return null;
    return pattern.concat(pattern);
  }
  return pattern;
}

function formatDashNumber(value) {
  return String(Math.round(Number(value) * 1000000) / 1000000);
}

function compareLabelFacts(expected, actual, fields, identity, context) {
  for (const [field, protocolPath] of fields) {
    if (!Object.prototype.hasOwnProperty.call(expected, field)) continue;
    compareField(context, protocolPath, expected[field], actual[field], {
      code: 'FORWARD_TRUSTED_FACT_CHANGED', ...identity, field,
    });
  }
}

function compareText(expected, actual, actualModelItem, identity, context) {
  const expectedText = normalizeLineEndings(expected.text || '');
  const actualText = normalizeLineEndings(
    actualModelItem && actualModelItem.content && actualModelItem.content.text != null
      ? actualModelItem.content.text
      : actual.text || '',
  );
  compareField(context, 'items[].content.text', expectedText, actualText, {
    code: 'FORWARD_TEXT_CHANGED', ...identity, field: 'content.text',
  });

  const expectedRuns = runFacts(expected.runs);
  if (!expectedRuns.length) return;
  const actualRuns = runFacts(actual.textRuns || actualModelItem && actualModelItem.content && actualModelItem.content.runs);
  compareField(context, 'items[].content.runs', expectedRuns, actualRuns, {
    code: 'FORWARD_TEXT_RUNS_CHANGED', ...identity, field: 'content.runs',
  });
}

function compareTable(expectedRows, actualTable, identity, context) {
  const expected = tableFacts(expectedRows);
  const actual = tableFacts(actualTable && actualTable.rows);
  compareField(context, 'items[].table.rows', expected, actual, {
    code: 'FORWARD_TABLE_CHANGED', ...identity, field: 'table.rows', tolerance: context.opts.numberTolerance,
  });
}

function comparePlacedAsset(expected, actual, identity, context) {
  const placed = expected.placed || null;
  const actualAsset = actual.placedAsset || null;
  const expectedAsset = placed
    ? array(context.instructions.assets).find((asset) => asset.id === placed.assetId) || {}
    : {};
  if (!placed && !actualAsset) return;
  if (placed && !actualAsset && vectorAssetPreservedInDocument(expectedAsset, context.actualSnapshot.assets)) return;
  if (!placed || !actualAsset) {
    context.errors.push({
      code: 'FORWARD_ASSET_CHANGED',
      ...identity,
      field: 'asset',
      expected: placed,
      actual: actualAsset,
    });
    return;
  }
  compareField(context, 'assets[].path', normalizePath(expectedAsset.resolvedPath || expectedAsset.path), normalizePath(actualAsset.path), {
    code: 'FORWARD_ASSET_CHANGED', ...identity, field: 'asset.path',
  });
  if (actualAsset.status && !['NORMAL', 'LINK_EMBEDDED'].includes(String(actualAsset.status).toUpperCase())) {
    context.errors.push({
      code: 'FORWARD_ASSET_UNAVAILABLE',
      ...identity,
      field: 'asset.status',
      expected: 'NORMAL',
      actual: actualAsset.status,
    });
  }
  if (actualAsset.placement && actualAsset.placement.frameBounds) {
    compareField(context, 'items[].bounds', expected.bounds, actualAsset.placement.frameBounds, {
      code: 'FORWARD_ASSET_PLACEMENT_CHANGED', ...identity, field: 'asset.frameBounds', tolerance: context.opts.boundsTolerance,
    });
  }
  for (const [field, protocolPath] of [
    ['pageNumber', 'items[].asset.placement.pageNumber'],
    ['crop', 'items[].asset.placement.crop'],
    ['artboard', 'items[].asset.placement.artboard'],
    ['layerComp', 'items[].asset.placement.layerComp'],
    ['visibleLayers', 'items[].asset.placement.visibleLayers'],
    ['hiddenLayers', 'items[].asset.placement.hiddenLayers'],
  ]) {
    if (placed[field] == null) continue;
    compareField(context, protocolPath, placed[field], actualAsset.placement && actualAsset.placement[field], {
      code: 'FORWARD_ASSET_PLACEMENT_CHANGED', ...identity, field: `asset.placement.${field}`,
    });
  }
}

function compareVisualStyle(expected, actual, identity, context) {
  const expectedStyle = effectiveExpectedVisualStyle(expected, context.instructions.styles || {});
  if (!expectedStyle) return;
  const actualStyle = actual.visualStyle || {};
  const swatches = context.instructions.styles && context.instructions.styles.swatches || {};
  for (const [field, protocolPath] of [
    ['fillColor', 'items[].visualStyle.fillColor'],
    ['fillOpacity', 'items[].visualStyle.fillOpacity'],
    ['strokeColor', 'items[].visualStyle.strokeColor'],
    ['strokeWeight', 'items[].visualStyle.strokeWeight'],
    ['strokeOpacity', 'items[].visualStyle.strokeOpacity'],
    ['cornerRadius', 'items[].visualStyle.cornerRadius'],
    ['opacity', 'items[].visualStyle.opacity'],
    ['blendMode', 'items[].visualStyle.blendMode'],
  ]) {
    if (!Object.prototype.hasOwnProperty.call(expectedStyle, field) || expectedStyle[field] == null) continue;
    if (field === 'cornerRadius' && /%\s*$/.test(String(expectedStyle[field]))) continue;
    const expectedValue = normalizeExpectedVisualValue(field, expectedStyle[field], swatches);
    let actualValue = normalizeActualVisualValue(field, actualStyle[field]);
    if (expectedValue === 0 && actualValue == null && ['strokeWeight', 'cornerRadius'].includes(field)) actualValue = 0;
    if (field === 'cornerRadius' && equivalentPillRadius(
      expectedValue,
      actualValue,
      expected.bounds,
      actual.bounds,
      context.opts.boundsTolerance,
    )) continue;
    compareField(context, protocolPath, expectedValue, actualValue, {
      code: 'FORWARD_VISUAL_STYLE_CHANGED', ...identity, field: `visualStyle.${field}`, tolerance: context.opts.numberTolerance,
    });
  }
}

function compareItemBounds(expected, actual, identity, context) {
  const expectedBounds = expected.bounds || null;
  const actualBounds = actual.bounds || null;
  if (isBoundedTextFitAdjustment(expected, expectedBounds, actualBounds, context.opts.boundsTolerance)) {
    context.comparedPaths.add('items[].bounds');
    if (!deepEqualWithTolerance(expectedBounds, actualBounds, context.opts.boundsTolerance)) {
      context.warnings.push({
        code: 'FORWARD_TEXT_FIT_APPLIED',
        ...identity,
        field: 'bounds',
        expected: expectedBounds,
        actual: actualBounds,
        growX: Number(actualBounds.width) - Number(expectedBounds.width),
        growY: Number(actualBounds.height) - Number(expectedBounds.height),
      });
    }
    return;
  }
  compareField(context, 'items[].bounds', expectedBounds, actualBounds, {
    code: 'FORWARD_ITEM_GEOMETRY_CHANGED', ...identity, field: 'bounds', tolerance: context.opts.boundsTolerance,
  });
}

function isBoundedTextFitAdjustment(item, expected, actual, tolerance) {
  const policy = item && item.textFit;
  if (!policy || policy.mode !== 'expand-frame-to-content' || !expected || !actual) return false;
  const growX = Number(actual.width) - Number(expected.width);
  const growY = Number(actual.height) - Number(expected.height);
  if (![growX, growY].every(Number.isFinite)) return false;
  if (growX < -tolerance || growY < -tolerance) return false;
  if (growX > Number(policy.maxGrowX || 0) + tolerance) return false;
  if (growY > Number(policy.maxGrowY || 0) + tolerance) return false;
  if (Math.abs(Number(actual.y) - Number(expected.y)) > tolerance) return false;
  const anchor = String(policy.horizontalAnchor || 'start').toLowerCase();
  if (anchor === 'center') {
    return Math.abs(boundsCenterX(actual) - boundsCenterX(expected)) <= tolerance;
  }
  if (anchor === 'end' || anchor === 'right') {
    return Math.abs(boundsRight(actual) - boundsRight(expected)) <= tolerance;
  }
  return Math.abs(Number(actual.x) - Number(expected.x)) <= tolerance;
}

function boundsCenterX(bounds) {
  return Number(bounds.x) + Number(bounds.width) / 2;
}

function boundsRight(bounds) {
  return Number(bounds.x) + Number(bounds.width);
}

function equivalentPillRadius(expectedRadius, actualRadius, expectedBounds, actualBounds, tolerance) {
  const expectedCap = halfShortEdge(expectedBounds);
  const actualCap = halfShortEdge(actualBounds);
  if (![Number(expectedRadius), Number(actualRadius), expectedCap, actualCap].every(Number.isFinite)) return false;
  return Number(expectedRadius) >= expectedCap - tolerance
    && Number(actualRadius) >= actualCap - tolerance;
}

function halfShortEdge(bounds) {
  if (!bounds) return NaN;
  return Math.min(Number(bounds.width), Number(bounds.height)) / 2;
}

function compareAssets(expectedAssets, actualAssets, context) {
  const actualByPath = new Map(actualAssets.map((asset) => [normalizePath(asset && asset.path), asset]));
  for (const expected of expectedAssets) {
    const expectedPath = normalizePath(expected && (expected.resolvedPath || expected.path));
    if (!expectedPath) continue;
    const actual = actualByPath.get(expectedPath);
    if (!actual) {
      context.errors.push({
        code: 'FORWARD_ASSET_CHANGED',
        field: 'assets[].path',
        expected: expectedPath,
        actual: null,
      });
      continue;
    }
    if (actual.status && !['NORMAL', 'LINK_EMBEDDED'].includes(String(actual.status).toUpperCase())) {
      context.errors.push({
        code: 'FORWARD_ASSET_UNAVAILABLE',
        field: 'assets[].status',
        expected: 'NORMAL',
        actual: actual.status,
        asset: expectedPath,
      });
    }
  }
}

function compareStyleRegistrations(expectedStyles, actualStyles, context) {
  for (const collection of ['paragraphStyles', 'characterStyles', 'objectStyles', 'tableStyles', 'cellStyles']) {
    const protocolPath = `styles.${collection}`;
    if (!isComparableProtocolPath(protocolPath)) continue;
    context.comparedPaths.add(protocolPath);
    const expected = Object.values(expectedStyles[collection] || {});
    const actual = arrayOrValues(actualStyles[collection]);
    const actualTokens = new Set();
    const actualNames = new Set();
    for (const style of actual) {
      if (style && style.name) actualNames.add(String(style.name));
      const label = protocolLabel(style, 'style');
      if (label && label.token) actualTokens.add(String(label.token));
      if (label && label.id) actualTokens.add(String(label.id));
    }
    for (const style of expected) {
      if (!style) continue;
      const token = style.token || protocolLabel(style, 'style') && protocolLabel(style, 'style').token;
      const name = style.name || style.displayName;
      if ((token && actualTokens.has(String(token))) || (name && actualNames.has(String(name)))) continue;
      context.errors.push({
        code: 'FORWARD_STYLE_MISSING',
        field: `styles.${collection}`,
        expected: { token: token || null, name: name || null },
        actual: null,
      });
    }
  }
}

function compareDocumentHealth(snapshot, context) {
  const report = snapshot.report || {};
  for (const issue of array(report.errors)) {
    context.errors.push({
      code: issue.code || 'FORWARD_SNAPSHOT_REPORTED_ERROR',
      field: 'snapshot.report',
      message: issue.message || String(issue),
      actual: issue,
    });
  }
  for (const frame of array(report.oversetTextFrames)) {
    context.errors.push({
      code: 'FORWARD_OVERSET_TEXT',
      field: 'oversetTextFrames',
      pageId: frame.pageId || frame.page || null,
      itemId: frame.itemId || frame.id || null,
      actual: frame,
    });
  }
}

function compareLineGeometry(expected, actual, identity, context) {
  const expectedPoints = expectedLinePoints(expected);
  const pathPoints = actual.vectorGeometry && actual.vectorGeometry.paths
    && actual.vectorGeometry.paths[0] && actual.vectorGeometry.paths[0].points;
  const actualPoints = array(pathPoints).slice(0, 2).map((point) => point && point.anchor);
  const direct = linePointsEqual(expectedPoints, actualPoints, context.opts.boundsTolerance);
  const reversed = linePointsEqual(expectedPoints, actualPoints.slice().reverse(), context.opts.boundsTolerance);
  if (direct || reversed) {
    context.comparedPaths.add('items[].bounds');
    return;
  }
  context.errors.push({
    code: 'FORWARD_ITEM_GEOMETRY_CHANGED',
    ...identity,
    field: 'line.endpoints',
    expected: expectedPoints,
    actual: actualPoints,
  });
}

function expectedLinePoints(item) {
  const bounds = item.bounds || {};
  const x = Number(bounds.x || 0);
  const y = Number(bounds.y || 0);
  const length = Number(bounds.width || 0);
  const radians = Number(item.rotationAngle || 0) * Math.PI / 180;
  return [
    { x, y },
    { x: x + length * Math.cos(radians), y: y + length * Math.sin(radians) },
  ];
}

function linePointsEqual(left, right, tolerance) {
  return left.length === 2 && right.length === 2
    && left.every((point, index) => deepEqualWithTolerance(point, right[index], tolerance));
}

function compareExpectedScalar(protocolPath, field, expected, actual, identity, context) {
  if (expected == null || expected === '') return;
  if (!isComparableProtocolPath(protocolPath)) return;
  context.comparedPaths.add(protocolPath);
  if (String(expected) === String(actual || '')) return;
  context.errors.push({
    code: 'FORWARD_APPLIED_STYLE_CHANGED',
    ...identity,
    field,
    expected,
    actual: actual || null,
  });
}

function compareField(context, protocolPath, expected, actual, issue) {
  if (!isComparableProtocolPath(protocolPath)) return;
  context.comparedPaths.add(protocolPath);
  const left = normalizeComparableValue(protocolPath, expected);
  const right = normalizeComparableValue(protocolPath, actual);
  if (deepEqualWithTolerance(left, right, issue.tolerance || context.opts.numberTolerance)) return;
  context.errors.push({ ...issue, expected: left, actual: right });
}

function isComparableProtocolPath(protocolPath) {
  const field = fieldRegistry.getByPath(protocolPath);
  if (!field || field.lifecycle !== 'active') return false;
  const html = field.capabilities && field.capabilities.html;
  const indesign = field.capabilities && field.capabilities.indesign;
  return Boolean(html && indesign)
    && READABLE.has(html.read)
    && READABLE.has(indesign.read)
    && DURABLE.has(html.persist)
    && DURABLE.has(indesign.persist);
}

function normalizeComparableValue(protocolPath, value) {
  if (protocolPath.endsWith('.sourceFile') || protocolPath.endsWith('.path')) return normalizePath(value);
  if (protocolPath.includes('content.text') || protocolPath.endsWith('.sourceText')) return normalizeLineEndings(value || '');
  return value == null ? null : value;
}

function deepEqualWithTolerance(left, right, tolerance) {
  if (left == null || right == null) return left == null && right == null;
  if (typeof left === 'number' || typeof right === 'number') {
    const a = Number(left);
    const b = Number(right);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
  }
  if (typeof left !== typeof right) return false;
  if (typeof left !== 'object') return left === right;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqualWithTolerance(value, right[index], tolerance));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index]
    && deepEqualWithTolerance(left[key], right[key], tolerance));
}

function protocolMap(values, kind) {
  const out = new Map();
  for (const value of array(values)) {
    const label = protocolLabel(value, kind);
    if (label && label.id != null) out.set(String(label.id), value);
  }
  return out;
}

function valueMap(values) {
  const out = new Map();
  for (const value of array(values)) {
    if (value && value.id != null) out.set(String(value.id), value);
  }
  return out;
}

function protocolLabel(value, kind) {
  return array(value && value.labels).find((label) => label && label.kind === kind) || null;
}

function guideFacts(guides) {
  return array(guides)
    .map((guide) => ({
      orientation: normalizeGuideOrientation(guide && guide.orientation),
      position: Number(guide && (guide.position != null ? guide.position : guide.location)),
    }))
    .filter((guide) => guide.orientation && Number.isFinite(guide.position))
    .sort((left, right) => left.orientation.localeCompare(right.orientation) || left.position - right.position);
}

function normalizeGuideOrientation(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('vertical')) return 'vertical';
  if (text.includes('horizontal')) return 'horizontal';
  return text;
}

function runFacts(runs) {
  const normalized = array(runs).map((run) => ({
    text: normalizeLineEndings(run && run.text || ''),
    characterStyle: run && run.characterStyle || null,
  }));
  const merged = [];
  for (const run of normalized) {
    const previous = merged[merged.length - 1];
    if (previous && previous.characterStyle === run.characterStyle) previous.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}

function tableFacts(rows) {
  return array(rows).map((row, rowIndex) => {
    const cells = array(row && row.cells).map((cell, cellIndex) => ({
      index: cell && cell.index != null ? cell.index : cellIndex,
      text: normalizeLineEndings(cell && cell.text || ''),
      header: Boolean(cell && cell.header),
      rowSpan: Number(cell && cell.rowSpan || 1),
      colSpan: Number(cell && cell.colSpan || 1),
      ...(cell && cell.paragraphStyle ? { paragraphStyle: cell.paragraphStyle } : {}),
      ...(cell && cell.cellStyle && !isBuiltinNoneStyle(cell.cellStyle) ? { cellStyle: cell.cellStyle } : {}),
    }));
    return {
      index: row && row.index != null ? row.index : rowIndex,
      header: Boolean(row && row.header) || (cells.length > 0 && cells.every((cell) => cell.header)),
      cells,
    };
  });
}

function vectorAssetPreservedInDocument(expectedAsset, actualAssets) {
  if (!['svg', 'vector'].includes(String(expectedAsset && expectedAsset.kind || '').toLowerCase())) return false;
  const expectedPath = normalizePath(expectedAsset.resolvedPath || expectedAsset.path);
  return array(actualAssets).some((asset) => normalizePath(asset && asset.path) === expectedPath
    && (!asset.status || ['NORMAL', 'LINK_EMBEDDED'].includes(String(asset.status).toUpperCase())));
}

function isBuiltinNoneStyle(value) {
  return /^\[(?:无|none)\]$/i.test(String(value || ''));
}

function effectiveExpectedVisualStyle(item, styles) {
  const base = item.objectStyle && styles.objectStyles && styles.objectStyles[item.objectStyle] || null;
  const override = item.styleOverride || null;
  const direct = String(item.type || '').toUpperCase() === 'LINE'
    ? { strokeColor: item.strokeColor, strokeWeight: item.strokeWeight }
    : null;
  if (!base && !override && !direct) return null;
  return { ...(base || {}), ...(override || {}), ...(direct || {}) };
}

function normalizeExpectedVisualValue(field, value, swatches) {
  if (field.endsWith('Color')) {
    const swatch = swatches && swatches[value];
    return String(swatch && swatch.value || value).toLowerCase();
  }
  if (field === 'opacity' || field === 'fillOpacity' || field === 'strokeOpacity') {
    const number = Number(value);
    if (!Number.isFinite(number)) return value;
    return number <= 1 ? number * 100 : number;
  }
  if (field === 'cornerRadius') return numberFromMeasurement(value);
  return value;
}

function normalizeActualVisualValue(field, value) {
  if (field.endsWith('Color') && value != null) return String(value).toLowerCase();
  if (field === 'cornerRadius') return numberFromMeasurement(value);
  return value;
}

function numberFromMeasurement(value) {
  if (value == null || value === '') return null;
  const number = Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : value;
}

function normalizePath(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(/\\/g, '/');
  return path.win32.normalize(normalized.replace(/\//g, '\\')).replace(/\\/g, '/').toLowerCase();
}

function pageInstructionItems(page) {
  return array(page && page.items).concat(array(page && page.parentPageItemOverrides));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function arrayOrValues(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

module.exports = {
  auditForwardFidelity,
};
