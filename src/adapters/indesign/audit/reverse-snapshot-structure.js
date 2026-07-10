const { normalizeLineEndings } = require('../../../shared/text');

const VISUAL_STYLE_FIELDS = Object.freeze([
  'fillColor',
  'fillTint',
  'fillOpacity',
  'strokeColor',
  'strokeTint',
  'strokeWeight',
  'strokeOpacity',
  'strokeStyle',
  'strokeLineCap',
  'strokeLineJoin',
  'strokeMiterLimit',
  'strokeAlignment',
  'lineStartMarker',
  'lineEndMarker',
  'cornerRadius',
  'opacity',
  'blendMode',
]);

const ASSET_METADATA_FIELDS = Object.freeze([
  'name',
  'path',
  'status',
  'graphicType',
  'imageTypeName',
  'cropped',
]);

const ASSET_NUMERIC_FIELDS = Object.freeze([
  'bounds',
]);

const ASSET_PLACEMENT_NUMERIC_FIELDS = Object.freeze([
  'frameBounds',
  'contentBounds',
  'contentOffset',
  'contentSize',
  'contentScale',
]);

const DEFAULT_OPTIONS = Object.freeze({
  boundsTolerance: 1,
  geometryTolerance: 0.25,
  guideTolerance: 0.25,
  numberTolerance: 0.01,
  coverageThreshold: 0.75,
  fuzzyMatchMinScore: 14,
});

function reverseSnapshotStructureSignature(snapshot, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pages = (snapshot.pages || []).map((page) => pageSignature(page, opts));
  return {
    kind: 'ReverseSnapshotStructureSignature',
    metadata: {
      sourceDocument: snapshot.metadata && snapshot.metadata.sourceDocument || null,
      exportedAt: snapshot.metadata && snapshot.metadata.exportedAt || null,
      coordinateUnit: snapshot.metadata && snapshot.metadata.coordinateUnit || null,
    },
    pages,
    summary: summaryForPages(pages),
  };
}

function compareReverseSnapshotStructures(expectedInput, actualInput, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const expected = ensureSignature(expectedInput, opts);
  const actual = ensureSignature(actualInput, opts);
  const errors = [];
  const warnings = [];
  validateReverseSnapshotStructureInput(expected, 'expected', errors);
  validateReverseSnapshotStructureInput(actual, 'actual', errors);

  if ((expected.pages || []).length !== (actual.pages || []).length) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_PAGE_COUNT_CHANGED',
      expected: (expected.pages || []).length,
      actual: (actual.pages || []).length,
    });
  }

  const expectedPages = new Map((expected.pages || []).map((page) => [page.id, page]));
  const actualPages = new Map((actual.pages || []).map((page) => [page.id, page]));
  for (const expectedPage of expected.pages || []) {
    const actualPage = actualPages.get(expectedPage.id);
    if (!actualPage) {
      errors.push({ code: 'REVERSE_SNAPSHOT_PAGE_MISSING', pageId: expectedPage.id });
      continue;
    }
    comparePage(expectedPage, actualPage, errors, opts);
  }
  for (const actualPage of actual.pages || []) {
    if (!expectedPages.has(actualPage.id)) {
      errors.push({ code: 'REVERSE_SNAPSHOT_PAGE_EXTRA', pageId: actualPage.id });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    expected: expected.summary,
    actual: actual.summary,
  };
}

function ensureSignature(input, options) {
  if (input && input.kind === 'ReverseSnapshotStructureSignature') return input;
  return reverseSnapshotStructureSignature(input || {}, options);
}

function validateReverseSnapshotStructureInput(signature, side, errors) {
  if (!signature || !Array.isArray(signature.pages)) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_INPUT_INVALID',
      side,
      reason: 'pages must be a non-empty array',
    });
    return;
  }
  if (signature.pages.length === 0) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_INPUT_INVALID',
      side,
      reason: 'pages must not be empty',
    });
  }
  for (const page of signature.pages) {
    validateBounds(page && page.bounds, {
      side,
      pageId: page && page.id,
      field: 'bounds',
      reason: 'page bounds are required',
    }, errors);
    for (const item of page && page.items || []) {
      validateBounds(item && item.bounds, {
        side,
        pageId: page && page.id,
        itemId: item && (item.rawId || item.id),
        field: 'bounds',
        reason: 'item bounds are required',
      }, errors);
      if (item && item.asset && !isEmbeddedPreviewAssetSignature(item.asset)) {
        validateBounds(item.asset.bounds, {
          side,
          pageId: page && page.id,
          itemId: item.rawId || item.id,
          field: 'asset.bounds',
          reason: 'asset bounds are required',
        }, errors);
      }
    }
  }
}

function validateBounds(bounds, context, errors) {
  if (hasValidBounds(bounds)) return;
  errors.push({
    code: 'REVERSE_SNAPSHOT_INPUT_INVALID',
    ...context,
  });
}

function hasValidBounds(bounds) {
  return Boolean(bounds)
    && finiteNumber(bounds.x)
    && finiteNumber(bounds.y)
    && finiteNumber(bounds.width)
    && finiteNumber(bounds.height);
}

function isEmbeddedPreviewAssetSignature(asset) {
  return asset && asset.path === 'embedded-image-preview';
}

function pageSignature(page, options) {
  const sourceItems = Array.isArray(page.auditItems) && page.auditItems.length ? page.auditItems : (page.items || []);
  const items = uniqueItemIds(sourceItems
    .map((item, index) => itemSignature(item, page, index))
    .filter(hasEffectiveItemFootprint));
  return {
    id: String(page.id || page.name || `page-${Number(page.index || 0) + 1}`),
    index: numberOrNull(page.index),
    bounds: normalizeBounds(page.bounds),
    margins: normalizePlainObject(page.margins || null),
    guides: normalizeGuides(page.guides || []),
    items,
    summary: summaryForItems(items),
    occlusionCandidates: filledVectorCoverageCandidates(items, options),
  };
}

function itemSignature(item, page, index) {
  const identity = protocolItemIdentity(item);
  const visualStyle = visualStyleSignature(item.visualStyle, item);
  const vectorGeometry = vectorGeometrySignature(item.vectorGeometry, item);
  const signature = {
    key: null,
    id: null,
    fingerprint: null,
    identityKind: identity.kind,
    rawId: item.id != null ? String(item.id) : null,
    pageId: String(page.id || page.name || ''),
    type: canonicalItemType(item),
    layerName: item.layerName || null,
    visible: item.visible !== false,
    printable: item.printable !== false,
    nonprinting: item.nonprinting === true,
    objectStyleName: item.objectStyleName || null,
    paragraphStyleName: item.paragraphStyleName || null,
    parent: parentSignature(item.parent),
    bounds: normalizeBounds(item.bounds),
    zIndex: numberOrNull(item.zIndex),
    text: normalizeLineEndings(item.text),
    asset: placedAssetSignature(item.placedAsset),
    visualStyle,
    effects: normalizeDeep(item.effects || null),
    vectorGeometry,
  };
  signature.fingerprint = structuralFingerprint(signature, index);
  signature.id = identity.value || signature.fingerprint;
  signature.key = signature.id;
  return signature;
}

function parentSignature(parent) {
  if (!parent) return null;
  return {
    id: parent.id != null ? String(parent.id) : null,
    type: parent.type || null,
    labelId: parent.labelId || null,
  };
}

function protocolItemIdentity(item) {
  const label = firstLabel(item.labels, 'item');
  if (label && label.id) return { kind: 'label', value: String(label.id) };
  const labelIdMatch = String(item.label || '').match(/(?:^|;)id=([^;]+)/);
  if (labelIdMatch) return { kind: 'legacy-label', value: labelIdMatch[1] };
  return { kind: 'fingerprint', value: null };
}

function uniqueItemIds(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.id, (counts.get(item.id) || 0) + 1);
  const seen = new Map();
  return items.map((item) => {
    if ((counts.get(item.id) || 0) <= 1) return item;
    const next = (seen.get(item.id) || 0) + 1;
    seen.set(item.id, next);
    return {
      ...item,
      id: `${item.id}#${next}`,
      key: `${item.key}#${next}`,
    };
  });
}

function structuralFingerprint(item, index) {
  const bounds = item.bounds || {};
  const parts = [
    item.type || 'unknown',
    round(bounds.x, 1),
    round(bounds.y, 1),
    round(bounds.width, 1),
    round(bounds.height, 1),
    item.asset && item.asset.path || '',
    item.text ? compactText(item.text) : '',
    item.vectorGeometry && item.vectorGeometry.kind || '',
  ];
  const value = parts.map((part) => String(part).replace(/[|#]/g, '-')).join('|');
  return value ? `fingerprint:${value}` : `fingerprint:item-${index}`;
}

function firstLabel(labels, kind) {
  return (labels || []).find((label) => label && label.kind === kind) || null;
}

function placedAssetSignature(asset) {
  if (!asset) return null;
  const path = placedAssetPathSignature(asset);
  const embeddedPreview = path === 'embedded-image-preview';
  return {
    name: embeddedPreview ? null : (asset.name || null),
    path,
    status: embeddedPreview ? null : (asset.status || null),
    graphicType: asset.graphicType || null,
    imageTypeName: embeddedPreview ? null : (asset.imageTypeName || null),
    bounds: embeddedPreview ? null : normalizeBounds(asset.bounds),
    cropped: embeddedPreview ? null : (typeof asset.cropped === 'boolean' ? asset.cropped : null),
    placement: embeddedPreview ? null : normalizeDeep(asset.placement || null),
  };
}

function placedAssetPathSignature(asset) {
  const path = assetPathSignature(asset && asset.path);
  if (isPathlessEmbeddedImageAsset(asset)) return 'embedded-image-preview';
  if (path && /^generated-preview:.*-asset\.png$/i.test(path) && isImageAsset(asset)) return 'embedded-image-preview';
  return path;
}

function isPathlessEmbeddedImageAsset(asset) {
  return Boolean(asset && !asset.path && isImageAsset(asset));
}

function isImageAsset(asset) {
  return String(asset && asset.graphicType || '').toLowerCase() === 'image';
}

function visualStyleSignature(visualStyle, item = null) {
  const style = visualStyle || {};
  const out = {};
  for (const field of VISUAL_STYLE_FIELDS) {
    out[field] = normalizeVisualValue(field, style[field]);
  }
  const visibleStroke = hasVisibleStrokeStyle(out);
  const lineLikeItem = isLineLikeItem(item);
  if (!visibleStroke) {
    out.strokeWeight = null;
    out.strokeStyle = null;
    out.strokeLineCap = null;
    out.strokeLineJoin = null;
    out.strokeMiterLimit = null;
    out.lineStartMarker = null;
    out.lineEndMarker = null;
  }
  if (!visibleStroke || lineLikeItem) out.strokeAlignment = null;
  return out;
}

function assetPathSignature(value) {
  if (!value) return null;
  const text = String(value);
  const normalized = text.replace(/\\/g, '/');
  const parts = normalized.toLowerCase().split('/').filter(Boolean);
  const previewIndex = parts.lastIndexOf('previews');
  if (previewIndex >= 0 && previewIndex === parts.length - 2) {
    return `generated-preview:${parts[parts.length - 1]}`;
  }
  return text;
}

function hasVisibleStrokeStyle(style) {
  return Boolean(style && style.strokeColor && Number(style.strokeWeight || 0) > 0);
}

function hasEffectiveItemFootprint(item) {
  if (!item) return false;
  if (normalizeLineEndings(item.text).trim()) return true;
  if (item.asset) return true;
  if (item.effects) return true;
  return hasFillPaint(item) || hasStrokePaint(item);
}

function canonicalItemType(item) {
  if (isLineLikeItem(item)) return 'GraphicLine';
  if (item && item.placedAsset) return 'GraphicFrame';
  return item && item.type || null;
}

function isLineLikeItem(item) {
  if (!item) return false;
  const type = String(item.type || '');
  if (type === 'GraphicLine') return true;
  if (!['Polygon', 'Rectangle'].includes(type)) return false;
  if (item.placedAsset) return false;
  const visual = item.visualStyle || {};
  if (visual.fillColor) return false;
  return hasLineLikeBounds(item.bounds) || hasLineLikeGeometry(item.vectorGeometry);
}

function hasLineLikeBounds(bounds) {
  if (!bounds) return false;
  const width = Math.abs(Number(bounds.width || 0));
  const height = Math.abs(Number(bounds.height || 0));
  return width <= 0.01 || height <= 0.01;
}

function hasLineLikeGeometry(vectorGeometry) {
  if (!vectorGeometry) return false;
  const paths = vectorGeometry.paths || [];
  if (paths.length !== 1) return false;
  const path = paths[0] || {};
  return path.closed !== true && (path.points || []).length === 2;
}

function normalizeVisualValue(field, value) {
  if (value == null) return null;
  if (/Color$/.test(field) && typeof value === 'string') return value.toLowerCase();
  if (field === 'lineStartMarker' || field === 'lineEndMarker') return markerSignature(value);
  return normalizeDeep(value);
}

function markerSignature(value) {
  if (!value) return null;
  if (typeof value === 'string') return { type: value, rawName: value };
  return {
    type: value.type || null,
    rawName: value.rawName || null,
  };
}

function vectorGeometrySignature(vectorGeometry, item = null) {
  if (!vectorGeometry) return null;
  return {
    kind: isLineLikeItem(item) ? 'line' : (vectorGeometry.kind || null),
    paths: (vectorGeometry.paths || []).map((path) => ({
      closed: Boolean(path && path.closed),
      points: (path && path.points || []).map(vectorPointSignature),
    })),
  };
}

function vectorPointSignature(point = {}) {
  return {
    anchor: normalizePoint(point.anchor),
    leftDirection: normalizePoint(point.leftDirection || point.anchor),
    rightDirection: normalizePoint(point.rightDirection || point.anchor),
    pointType: point.pointType || null,
  };
}

function normalizePoint(point = {}) {
  return {
    x: numberOrZero(point.x),
    y: numberOrZero(point.y),
  };
}

function normalizeBounds(bounds) {
  if (!hasValidBounds(bounds)) return null;
  return {
    x: numberOrZero(bounds.x),
    y: numberOrZero(bounds.y),
    width: numberOrZero(bounds.width),
    height: numberOrZero(bounds.height),
  };
}

function normalizeGuides(guides) {
  return (guides || []).map((guide) => ({
    orientation: guide.orientation || null,
    location: numberOrZero(guide.position != null ? guide.position : guide.location),
  })).sort((a, b) => String(a.orientation).localeCompare(String(b.orientation)) || a.location - b.location);
}

function normalizePlainObject(value) {
  if (!value) return null;
  return normalizeDeep(value);
}

function normalizeDeep(value) {
  if (value == null) return null;
  if (typeof value === 'number') return finiteNumber(value) ? value : null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalizeDeep);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = normalizeDeep(value[key]);
  return out;
}

function summaryForPages(pages) {
  const summary = {
    pages: pages.length,
    items: 0,
    byType: {},
    vectorPaint: {
      vectors: 0,
      filled: 0,
      nonBackgroundFilled: 0,
      stroked: 0,
      markers: 0,
      effects: 0,
      coveredByAssets: 0,
      nonBackgroundCoveredByAssets: 0,
    },
  };
  for (const page of pages) {
    summary.items += page.items.length;
    mergeCounts(summary.byType, page.summary.byType);
    for (const key of Object.keys(summary.vectorPaint)) {
      summary.vectorPaint[key] += page.summary.vectorPaint[key] || 0;
    }
    summary.vectorPaint.coveredByAssets += page.occlusionCandidates.length;
    summary.vectorPaint.nonBackgroundCoveredByAssets += page.occlusionCandidates.filter((candidate) => !candidate.backgroundLike).length;
  }
  return summary;
}

function summaryForItems(items) {
  const summary = {
    byType: {},
    vectorPaint: {
      vectors: 0,
      filled: 0,
      nonBackgroundFilled: 0,
      stroked: 0,
      markers: 0,
      effects: 0,
      coveredByAssets: 0,
      nonBackgroundCoveredByAssets: 0,
    },
  };
  for (const item of items) {
    const type = item.type || 'Unknown';
    summary.byType[type] = (summary.byType[type] || 0) + 1;
    if (!isVectorItem(item)) continue;
    summary.vectorPaint.vectors += 1;
    if (hasFillPaint(item)) {
      summary.vectorPaint.filled += 1;
      if (!isBackgroundLike(item)) summary.vectorPaint.nonBackgroundFilled += 1;
    }
    if (hasStrokePaint(item)) summary.vectorPaint.stroked += 1;
    if (item.visualStyle.lineStartMarker || item.visualStyle.lineEndMarker) summary.vectorPaint.markers += 1;
    if (item.effects) summary.vectorPaint.effects += 1;
  }
  return summary;
}

function mergeCounts(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    target[key] = (target[key] || 0) + value;
  }
}

function filledVectorCoverageCandidates(items, options) {
  const threshold = Number(options.coverageThreshold || DEFAULT_OPTIONS.coverageThreshold);
  const vectors = items.filter((item) => isVectorItem(item) && hasFillPaint(item) && item.bounds);
  const assets = items.filter((item) => item.asset && item.bounds);
  const out = [];
  for (const vector of vectors) {
    const vectorArea = area(vector.bounds);
    if (vectorArea <= 0) continue;
    for (const asset of assets) {
      if (numberOrNull(asset.zIndex) === null || numberOrNull(vector.zIndex) === null) continue;
      if (Number(asset.zIndex) <= Number(vector.zIndex)) continue;
      const ratio = intersectionArea(vector.bounds, asset.bounds) / vectorArea;
      if (ratio >= threshold) {
        out.push({
          vectorId: vector.id,
          assetId: asset.id,
          overlapRatio: round(ratio, 4),
          vectorZIndex: vector.zIndex,
          assetZIndex: asset.zIndex,
          backgroundLike: isBackgroundLike(vector),
        });
      }
    }
  }
  return out;
}

function comparePage(expected, actual, errors, options) {
  compareNumericObject('REVERSE_SNAPSHOT_PAGE_BOUNDS_CHANGED', expected.id, null, 'bounds', expected.bounds, actual.bounds, errors, options.boundsTolerance);
  compareNumericObject('REVERSE_SNAPSHOT_PAGE_MARGINS_CHANGED', expected.id, null, 'margins', expected.margins, actual.margins, errors, options.boundsTolerance);
  if (!deepEqualWithTolerance(expected.guides, actual.guides, options.guideTolerance)) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_PAGE_GUIDES_CHANGED',
      pageId: expected.id,
      expected: expected.guides,
      actual: actual.guides,
    });
  }

  const expectedItems = new Map(expected.items.map((item) => [item.id, item]));
  const actualItems = new Map(actual.items.map((item) => [item.id, item]));
  const actualByFingerprint = itemsByFingerprint(actual.items);
  const usedActualIds = new Set();
  const matchedItems = [];
  for (const expectedItem of expected.items) {
    const actualItem = matchActualItem(expectedItem, actualItems, actualByFingerprint, actual.items, usedActualIds, options);
    if (!actualItem) {
      errors.push({
        code: 'REVERSE_SNAPSHOT_ITEM_MISSING',
        pageId: expected.id,
        itemId: expectedItem.id,
        type: expectedItem.type,
        visualStyle: expectedItem.visualStyle,
        bounds: expectedItem.bounds,
        text: expectedItem.text || null,
        asset: expectedItem.asset || null,
      });
      continue;
    }
    usedActualIds.add(actualItem.id);
    matchedItems.push({ expected: expectedItem, actual: actualItem });
    compareItem(expected.id, expectedItem, actualItem, errors, options);
  }
  for (const actualItem of actual.items) {
    if (!expectedItems.has(actualItem.id) && !usedActualIds.has(actualItem.id)) {
      errors.push({
        code: 'REVERSE_SNAPSHOT_ITEM_EXTRA',
        pageId: actual.id,
        itemId: actualItem.id,
        type: actualItem.type,
        visualStyle: actualItem.visualStyle,
        bounds: actualItem.bounds,
        text: actualItem.text || null,
        asset: actualItem.asset || null,
      });
    }
  }
  compareRelativeZOrder(expected.id, matchedItems, errors);
}

function itemsByFingerprint(items) {
  const map = new Map();
  for (const item of items || []) {
    if (!item.fingerprint) continue;
    if (!map.has(item.fingerprint)) map.set(item.fingerprint, []);
    map.get(item.fingerprint).push(item);
  }
  return map;
}

function matchActualItem(expectedItem, actualItems, actualByFingerprint, actualItemList, usedActualIds, options) {
  const byId = actualItems.get(expectedItem.id);
  if (byId && !usedActualIds.has(byId.id)) return byId;
  const candidates = actualByFingerprint.get(expectedItem.fingerprint) || [];
  const byFingerprint = candidates.find((candidate) => !usedActualIds.has(candidate.id));
  if (byFingerprint) return byFingerprint;
  return fuzzyMatchActualItem(expectedItem, actualItemList, usedActualIds, options);
}

function fuzzyMatchActualItem(expectedItem, actualItems, usedActualIds, options) {
  let best = null;
  let bestScore = 0;
  for (const actualItem of actualItems || []) {
    if (!actualItem || usedActualIds.has(actualItem.id)) continue;
    const score = structuralMatchScore(expectedItem, actualItem, options);
    if (score <= bestScore) continue;
    best = actualItem;
    bestScore = score;
  }
  return bestScore >= Number(options.fuzzyMatchMinScore || DEFAULT_OPTIONS.fuzzyMatchMinScore) ? best : null;
}

function structuralMatchScore(expected, actual, options) {
  if (!expected || !actual) return 0;
  const sameType = expected.type === actual.type;
  const bothVector = isVectorItem(expected) && isVectorItem(actual);
  if (!sameType && !bothVector) return 0;

  let score = sameType ? 6 : 3;
  const expectedText = normalizeLineEndings(expected.text);
  const actualText = normalizeLineEndings(actual.text);
  if (expectedText || actualText) {
    if (effectiveText(expectedText) !== effectiveText(actualText)) return 0;
    score += expectedText.length > 20 ? 10 : 8;
  } else if (sameType && expected.type === 'TextFrame') {
    score += 4;
  }

  const expectedAssetPath = expected.asset && expected.asset.path || null;
  const actualAssetPath = actual.asset && actual.asset.path || null;
  if (expectedAssetPath || actualAssetPath) {
    if (!expectedAssetPath || !actualAssetPath || expectedAssetPath !== actualAssetPath) return 0;
    score += 10;
  }

  score += boundsMatchScore(expected.bounds, actual.bounds, options);
  if (paintKey(expected.visualStyle) && paintKey(expected.visualStyle) === paintKey(actual.visualStyle)) score += 2;
  return score;
}

function boundsMatchScore(expected, actual, options) {
  if (!expected || !actual) return 0;
  const tolerance = Math.max(Number(options.boundsTolerance || DEFAULT_OPTIONS.boundsTolerance), 1);
  let score = 0;
  for (const field of ['x', 'y', 'width', 'height']) {
    if (numbersEqual(expected[field], actual[field], tolerance)) score += 2;
  }
  const overlap = intersectionArea(expected, actual) / Math.max(area(expected), area(actual), 1);
  if (overlap >= 0.9) score += 4;
  else if (overlap >= 0.6) score += 2;
  return score;
}

function paintKey(visualStyle) {
  if (!visualStyle) return '';
  return [
    visualStyle.fillColor || '',
    visualStyle.strokeColor || '',
    visualStyle.strokeWeight == null ? '' : String(visualStyle.strokeWeight),
  ].join('|');
}

function compareItem(pageId, expected, actual, errors, options) {
  for (const field of ['type', 'layerName', 'visible', 'printable', 'nonprinting', 'objectStyleName', 'paragraphStyleName']) {
    if (!deepEqualWithTolerance(expected[field], actual[field], options.numberTolerance)) {
      errors.push({
        code: 'REVERSE_SNAPSHOT_ITEM_FIELD_CHANGED',
        pageId,
        itemId: expected.id,
        field,
        expected: expected[field],
        actual: actual[field],
      });
    }
  }
  compareNumericObject('REVERSE_SNAPSHOT_BOUNDS_CHANGED', pageId, expected.id, 'bounds', expected.bounds, actual.bounds, errors, options.boundsTolerance);
  if (expected.text !== actual.text) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_TEXT_CHANGED',
      pageId,
      itemId: expected.id,
      expected: expected.text,
      actual: actual.text,
    });
  }
  comparePlacedAsset(pageId, expected.id, expected.asset, actual.asset, errors, options);
  compareVisualStyle(pageId, expected, actual, errors, options);
  if (!deepEqualWithTolerance(expected.effects, actual.effects, options.numberTolerance)) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_EFFECTS_CHANGED',
      pageId,
      itemId: expected.id,
      expected: expected.effects,
      actual: actual.effects,
    });
  }
  if (requiresVectorGeometry(expected) && requiresVectorGeometry(actual) && !expected.vectorGeometry && !actual.vectorGeometry) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_VECTOR_GEOMETRY_MISSING',
      pageId,
      itemId: expected.id,
      expected: expected.vectorGeometry,
      actual: actual.vectorGeometry,
    });
    return;
  }
  compareVectorGeometry(pageId, expected, actual, errors, options);
}

function requiresVectorGeometry(item) {
  if (!item || item.asset || !isVectorItem(item)) return false;
  return hasFillPaint(item)
    || hasStrokePaint(item)
    || Boolean(item.effects)
    || item.type === 'GraphicLine';
}

function compareRelativeZOrder(pageId, matchedItems, errors) {
  const items = (matchedItems || []).filter((match) => (
    numberOrNull(match.expected && match.expected.zIndex) !== null
    && numberOrNull(match.actual && match.actual.zIndex) !== null
  ));
  if (items.length < 2) return;

  let inversionCount = 0;
  let firstInversion = null;
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex];
      const right = items[rightIndex];
      const expectedOrder = Math.sign(Number(left.expected.zIndex) - Number(right.expected.zIndex));
      const actualOrder = Math.sign(Number(left.actual.zIndex) - Number(right.actual.zIndex));
      if (expectedOrder === 0 || expectedOrder === actualOrder) continue;
      inversionCount += 1;
      if (!firstInversion) firstInversion = zOrderInversion(left, right);
    }
  }
  if (!inversionCount || !firstInversion) return;
  errors.push({
    code: 'REVERSE_SNAPSHOT_Z_ORDER_CHANGED',
    pageId,
    count: inversionCount,
    items: firstInversion.items,
    expected: firstInversion.expected,
    actual: firstInversion.actual,
  });
}

function zOrderInversion(left, right) {
  const leftWasBehind = Number(left.expected.zIndex) < Number(right.expected.zIndex);
  const behind = leftWasBehind ? left : right;
  const inFront = leftWasBehind ? right : left;
  return {
    items: {
      behind: behind.expected.id,
      inFront: inFront.expected.id,
    },
    expected: {
      behindZIndex: behind.expected.zIndex,
      inFrontZIndex: inFront.expected.zIndex,
    },
    actual: {
      behindZIndex: behind.actual.zIndex,
      inFrontZIndex: inFront.actual.zIndex,
    },
  };
}

function comparePlacedAsset(pageId, itemId, expected, actual, errors, options) {
  if (!expected && !actual) return;
  if (!expected || !actual) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_ASSET_CHANGED',
      pageId,
      itemId,
      field: 'asset',
      expected,
      actual,
    });
    return;
  }

  for (const field of ASSET_METADATA_FIELDS) {
    if (!deepEqualWithTolerance(expected[field], actual[field], options.numberTolerance)) {
      errors.push({
        code: 'REVERSE_SNAPSHOT_ASSET_FIELD_CHANGED',
        pageId,
        itemId,
        field: `asset.${field}`,
        expected: expected[field],
        actual: actual[field],
      });
    }
  }
  for (const field of ASSET_NUMERIC_FIELDS) {
    compareNumericObject(
      'REVERSE_SNAPSHOT_ASSET_FIELD_CHANGED',
      pageId,
      itemId,
      `asset.${field}`,
      expected[field],
      actual[field],
      errors,
      options.numberTolerance,
    );
  }
  comparePlacedAssetPlacement(pageId, itemId, expected.placement, actual.placement, errors, options);
}

function comparePlacedAssetPlacement(pageId, itemId, expected, actual, errors, options) {
  if (!expected && !actual) return;
  if (!expected || !actual) {
    errors.push({
      code: 'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED',
      pageId,
      itemId,
      field: 'placement',
      expected,
      actual,
    });
    return;
  }

  const numericFields = new Set(ASSET_PLACEMENT_NUMERIC_FIELDS);
  const fields = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const field of Array.from(fields).sort()) {
    const issueField = `placement.${field}`;
    if (numericFields.has(field)) {
      compareNumericObject(
        'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED',
        pageId,
        itemId,
        issueField,
        expected[field],
        actual[field],
        errors,
        options.numberTolerance,
      );
      continue;
    }
    if (!deepEqualWithTolerance(expected[field], actual[field], options.numberTolerance)) {
      errors.push({
        code: 'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED',
        pageId,
        itemId,
        field: issueField,
        expected: expected[field],
        actual: actual[field],
      });
    }
  }
}

function compareVisualStyle(pageId, expected, actual, errors, options) {
  for (const field of VISUAL_STYLE_FIELDS) {
    const left = expected.visualStyle && expected.visualStyle[field];
    const right = actual.visualStyle && actual.visualStyle[field];
    if (!deepEqualWithTolerance(left, right, options.numberTolerance)) {
      errors.push({
        code: 'REVERSE_SNAPSHOT_VISUAL_STYLE_CHANGED',
        pageId,
        itemId: expected.id,
        field,
        expected: left,
        actual: right,
      });
    }
  }
}

function compareVectorGeometry(pageId, expected, actual, errors, options) {
  const changes = vectorGeometryChanges(expected.vectorGeometry, actual.vectorGeometry, options.geometryTolerance);
  if (!changes.length) return;
  errors.push({
    code: 'REVERSE_SNAPSHOT_VECTOR_GEOMETRY_CHANGED',
    pageId,
    itemId: expected.id,
    changes: changes.slice(0, 25),
  });
}

function vectorGeometryChanges(expected, actual, tolerance) {
  const changes = [];
  if (!expected && !actual) return changes;
  if (!expected || !actual) {
    changes.push({ field: 'vectorGeometry', expected, actual });
    return changes;
  }
  if (expected.kind !== actual.kind) changes.push({ field: 'kind', expected: expected.kind, actual: actual.kind });
  const expectedPaths = expected.paths || [];
  const actualPaths = actual.paths || [];
  if (expectedPaths.length !== actualPaths.length) {
    changes.push({ field: 'paths.length', expected: expectedPaths.length, actual: actualPaths.length });
    return changes;
  }
  for (let pathIndex = 0; pathIndex < expectedPaths.length; pathIndex += 1) {
    const leftPath = expectedPaths[pathIndex];
    const rightPath = actualPaths[pathIndex];
    if (leftPath.closed !== rightPath.closed) {
      changes.push({ field: `paths[${pathIndex}].closed`, expected: leftPath.closed, actual: rightPath.closed });
    }
    const leftPoints = leftPath.points || [];
    const rightPoints = rightPath.points || [];
    if (leftPoints.length !== rightPoints.length) {
      changes.push({ field: `paths[${pathIndex}].points.length`, expected: leftPoints.length, actual: rightPoints.length });
      continue;
    }
    for (let pointIndex = 0; pointIndex < leftPoints.length; pointIndex += 1) {
      compareVectorPoint(changes, `paths[${pathIndex}].points[${pointIndex}]`, leftPoints[pointIndex], rightPoints[pointIndex], tolerance);
    }
  }
  return changes;
}

function compareVectorPoint(changes, prefix, expected, actual, tolerance) {
  for (const handle of ['anchor', 'leftDirection', 'rightDirection']) {
    for (const axis of ['x', 'y']) {
      const left = expected[handle] && expected[handle][axis];
      const right = actual[handle] && actual[handle][axis];
      if (!numbersEqual(left, right, tolerance)) {
        changes.push({ field: `${prefix}.${handle}.${axis}`, expected: left, actual: right });
      }
    }
  }
  if ((expected.pointType || null) !== (actual.pointType || null)) {
    changes.push({ field: `${prefix}.pointType`, expected: expected.pointType || null, actual: actual.pointType || null });
  }
}

function compareNumericObject(code, pageId, itemId, field, expected, actual, errors, tolerance) {
  if (deepEqualWithTolerance(expected, actual, tolerance)) return;
  const issue = { code, pageId, field, expected, actual };
  if (itemId) issue.itemId = itemId;
  errors.push(issue);
}

function deepEqualWithTolerance(left, right, tolerance) {
  if (left == null || right == null) return left == null && right == null;
  if (typeof left === 'number' || typeof right === 'number') return numbersEqual(left, right, tolerance);
  if (typeof left !== typeof right) return false;
  if (typeof left !== 'object') return left === right;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => deepEqualWithTolerance(value, right[index], tolerance));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index]) return false;
    if (!deepEqualWithTolerance(left[key], right[key], tolerance)) return false;
  }
  return true;
}

function isVectorItem(item) {
  if (!item) return false;
  if (item.vectorGeometry) return true;
  return ['GraphicLine', 'Rectangle', 'Oval', 'Polygon'].includes(String(item.type || ''));
}

function hasFillPaint(item) {
  const visual = item.visualStyle || {};
  return Boolean(visual.fillColor || item.effects);
}

function hasStrokePaint(item) {
  const visual = item.visualStyle || {};
  return Boolean(visual.strokeColor && Number(visual.strokeWeight || 0) > 0);
}

function isBackgroundLike(item) {
  const id = String(item && item.id || '').toLowerCase();
  const rawId = String(item && item.rawId || '').toLowerCase();
  const objectStyleName = String(item && item.objectStyleName || '').toLowerCase();
  return id.includes('background')
    || rawId.includes('background')
    || objectStyleName.includes('background')
    || objectStyleName.includes('背景');
}

function area(bounds) {
  return Math.max(0, Number(bounds.width || 0)) * Math.max(0, Number(bounds.height || 0));
}

function intersectionArea(left, right) {
  const x1 = Math.max(Number(left.x || 0), Number(right.x || 0));
  const y1 = Math.max(Number(left.y || 0), Number(right.y || 0));
  const x2 = Math.min(Number(left.x || 0) + Number(left.width || 0), Number(right.x || 0) + Number(right.width || 0));
  const y2 = Math.min(Number(left.y || 0) + Number(left.height || 0), Number(right.y || 0) + Number(right.height || 0));
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

function compactText(value) {
  const text = normalizeLineEndings(value).replace(/\s+/g, ' ').trim();
  if (text.length <= 80) return text;
  return `${text.slice(0, 40)}...${text.slice(-20)}`;
}

function effectiveText(value) {
  return normalizeLineEndings(value)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n+$/g, '')
    .trim();
}

function numberOrZero(value) {
  const n = Number(value);
  return finiteNumber(n) ? n : 0;
}

function numberOrNull(value) {
  const n = Number(value);
  return finiteNumber(n) ? n : null;
}

function numbersEqual(left, right, tolerance) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!finiteNumber(leftNumber) || !finiteNumber(rightNumber)) return left === right;
  return Math.abs(leftNumber - rightNumber) <= tolerance;
}

function finiteNumber(value) {
  return Number.isFinite(Number(value)) && Math.abs(Number(value)) < 100000000;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(Number(value || 0) * factor) / factor;
}

module.exports = {
  reverseSnapshotStructureSignature,
  compareReverseSnapshotStructures,
  VISUAL_STYLE_FIELDS,
};
