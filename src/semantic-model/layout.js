const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const {
  parseCssLength,
  cssLengthStringToMmOrZero,
  round,
} = require('../shared/geometry');

function resolveLayout(snapshot, options = {}) {
  if (options && options.layout) return options.layout;
  const unitMode = options.unitMode || 'print';
  if (unitMode !== 'presentation') {
    return {
      unitMode: 'print',
      targetUnit: 'mm',
      scale: 1,
      targetSize: null,
    };
  }
  const firstPage = snapshot.pages && snapshot.pages[0];
  const source = {
    width: firstPage && firstPage.rectPx ? Number(firstPage.rectPx.width) : Number((firstPage && firstPage.widthMm) || 0),
    height: firstPage && firstPage.rectPx ? Number(firstPage.rectPx.height) : Number((firstPage && firstPage.heightMm) || 0),
  };
  const target = targetSizeFor(options.targetSize, source);
  assertCompatibleAspectRatio(source, target);
  return {
    unitMode: 'presentation',
    targetUnit: 'pt',
    sourceSize: source,
    targetSize: target,
    scale: target.width / source.width,
  };
}

function targetSizeFor(value, source) {
  if (!value || value === 'same' || value === 'source') {
    return {
      width: round(source.width, 2),
      height: round(source.height, 2),
      name: 'source',
    };
  }
  const presets = {
    fhd: { width: 1920, height: 1080 },
    qhd: { width: 2560, height: 1440 },
    uhd: { width: 3840, height: 2160 },
    'dci-2k': { width: 2048, height: 1080 },
  };
  const key = String(value).toLowerCase();
  if (presets[key]) return { ...presets[key], name: key };
  const match = key.match(/^(\d+)x(\d+)$/);
  if (match) return { width: Number(match[1]), height: Number(match[2]), name: key };
  throw new Error(`Unsupported targetSize: ${value}`);
}

function assertCompatibleAspectRatio(source, target) {
  if (!source.width || !source.height || !target.width || !target.height) return;
  const sourceRatio = source.width / source.height;
  const targetRatio = target.width / target.height;
  if (Math.abs(sourceRatio - targetRatio) > 0.01) {
    throw new Error(`targetSize aspect ratio ${target.width}x${target.height} does not match source ${round(source.width, 2)}x${round(source.height, 2)}.`);
  }
}

function pageDimensions(page, layout) {
  if (layout.unitMode !== 'presentation') {
    return {
      width: page.widthMm,
      height: page.heightMm,
    };
  }
  return {
    width: round(layout.targetSize.width, 2),
    height: round(layout.targetSize.height, 2),
  };
}

function pageMargins(page, layout) {
  const attrs = page.attributes || {};
  const semantic = boxLengths(attrs[HTML_DATA_ID_ATTRIBUTES.MARGIN], layout);
  if (semantic) return semantic;
  const style = page.computedStyle || {};
  return {
    top: pageStyleLength(attrs[HTML_DATA_ID_ATTRIBUTES.MARGIN_TOP] || style.paddingTop, layout),
    right: pageStyleLength(attrs[HTML_DATA_ID_ATTRIBUTES.MARGIN_RIGHT] || style.paddingRight, layout),
    bottom: pageStyleLength(attrs[HTML_DATA_ID_ATTRIBUTES.MARGIN_BOTTOM] || style.paddingBottom, layout),
    left: pageStyleLength(attrs[HTML_DATA_ID_ATTRIBUTES.MARGIN_LEFT] || style.paddingLeft, layout),
  };
}

function pageStyleLength(value, layout) {
  if (layout.unitMode === 'presentation') return cssLengthToTarget(value, layout);
  return normalizeVisualMm(cssLengthToPrintMmOrZero(value));
}

function boxLengths(value, layout) {
  if (!value) return null;
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  const values = parts.length === 1
    ? [parts[0], parts[0], parts[0], parts[0]]
    : parts.length === 2
      ? [parts[0], parts[1], parts[0], parts[1]]
      : parts.length === 3
        ? [parts[0], parts[1], parts[2], parts[1]]
        : parts;
  return {
    top: pageStyleLength(values[0], layout),
    right: pageStyleLength(values[1], layout),
    bottom: pageStyleLength(values[2], layout),
    left: pageStyleLength(values[3], layout),
  };
}

function pageGuides(page, dimensions, margins, layout) {
  const attrs = page.attributes || {};
  if (usesUsedSnapGuides(attrs)) {
    return uniqueGuides(usedSnapGuides(page, dimensions, margins, layout));
  }
  const semantic = semanticGridSpec(attrs);
  const guides = semantic
    ? semanticGridGuides(semantic, attrs, page.computedStyle || {}, dimensions, margins, layout)
    : cssGridGuides(page.computedStyle || {}, dimensions, margins, layout);
  return uniqueGuides(guides);
}

function usesUsedSnapGuides(attrs) {
  const mode = String(attrs[HTML_DATA_ID_ATTRIBUTES.GUIDE_MODE] || '').trim().toLowerCase();
  return mode === 'used-snap' || mode === 'snap-used' || mode === 'used';
}

function usedSnapGuides(page, dimensions, margins, layout) {
  const guides = [
    { orientation: 'vertical', position: margins.left, source: 'used-snap' },
    { orientation: 'vertical', position: dimensions.width - margins.right, source: 'used-snap' },
    { orientation: 'horizontal', position: margins.top, source: 'used-snap' },
    { orientation: 'horizontal', position: dimensions.height - margins.bottom, source: 'used-snap' },
  ];
  for (const item of page.items || []) {
    if (!usedSnapGuideCandidate(item, page, layout)) continue;
    const bounds = itemBounds(item, page, layout);
    if (!bounds) continue;
    guides.push({ orientation: 'vertical', position: bounds.x, source: 'used-snap' });
    guides.push({ orientation: 'vertical', position: round(bounds.x + bounds.width, 2), source: 'used-snap' });
    guides.push({ orientation: 'horizontal', position: bounds.y, source: 'used-snap' });
    if (item.role !== 'text') {
      guides.push({ orientation: 'horizontal', position: round(bounds.y + bounds.height, 2), source: 'used-snap' });
    }
  }
  return guides;
}

function usedSnapGuideCandidate(item, page, layout) {
  if (!item || !item.boundsMm) return false;
  const attrs = item.attributes || {};
  if (attrs[HTML_DATA_ID_ATTRIBUTES.GUIDE_IGNORE] != null) return false;
  if (attrs[HTML_DATA_ID_ATTRIBUTES.ROLE] === 'annotation') return false;
  if (attrs[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE] === 'folio') return false;
  if ((item.ancestorCandidateIndexes || []).length) return false;
  const bounds = itemBounds(item, page, layout);
  if (!bounds || coversWholePage(bounds, page, layout)) return false;
  if (attrs[HTML_DATA_ID_ATTRIBUTES.OBJECT] != null) return true;
  if (item.role === 'graphic' || item.role === 'table') return true;
  return item.role === 'text';
}

function coversWholePage(bounds, page, layout) {
  const dimensions = pageDimensions(page, layout);
  return Math.abs(Number(bounds.x || 0)) < 0.01
    && Math.abs(Number(bounds.y || 0)) < 0.01
    && Math.abs(Number(bounds.width || 0) - Number(dimensions.width || 0)) < 0.01
    && Math.abs(Number(bounds.height || 0) - Number(dimensions.height || 0)) < 0.01;
}

function semanticGridSpec(attrs) {
  const raw = attrs[HTML_DATA_ID_ATTRIBUTES.GRID];
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d+)(?:\s*[xX*]\s*(\d+))?$/);
  if (!match) return null;
  return {
    columns: Math.max(0, Number(match[1])),
    rows: Math.max(0, Number(match[2] || 0)),
  };
}

function semanticGridGuides(spec, attrs, style, dimensions, margins, layout) {
  const columnGap = pageStyleLength(
    attrs[HTML_DATA_ID_ATTRIBUTES.COLUMN_GUTTER]
      || style.columnGap,
    layout
  );
  const rowGap = pageStyleLength(
    attrs[HTML_DATA_ID_ATTRIBUTES.ROW_GUTTER]
      || style.rowGap,
    layout
  );
  const baseline = pageStyleLength(attrs[HTML_DATA_ID_ATTRIBUTES.BASELINE], layout);
  const baselineGuides = String(attrs[HTML_DATA_ID_ATTRIBUTES.BASELINE_GUIDES] || '').trim().toLowerCase();
  const horizontal = baseline > 0 && baselineGuides === 'all'
    ? baselineGridGuides(margins.top, dimensions.height - margins.bottom, baseline)
    : evenGridGuides('horizontal', margins.top, dimensions.height - margins.top - margins.bottom, spec.rows, rowGap);
  return [
    ...evenGridGuides('vertical', margins.left, dimensions.width - margins.left - margins.right, spec.columns, columnGap),
    ...horizontal,
  ];
}

function baselineGridGuides(start, end, step) {
  const guides = [];
  const safeStart = Number(start || 0);
  const safeEnd = Number(end || 0);
  const safeStep = Number(step || 0);
  if (safeStep <= 0 || safeEnd <= safeStart) return guides;
  for (let cursor = safeStart + safeStep; cursor <= safeEnd + 0.0001; cursor += safeStep) {
    guides.push({ orientation: 'horizontal', position: round(cursor, 2), source: 'baseline-grid' });
  }
  return guides;
}

function cssGridGuides(style, dimensions, margins, layout) {
  if (!String(style.display || '').includes('grid')) return [];
  return [
    ...trackGuides('vertical', margins.left, parseTrackLengths(style.gridTemplateColumns, layout), pageStyleLength(style.columnGap || style.gap, layout)),
    ...trackGuides('horizontal', margins.top, parseTrackLengths(style.gridTemplateRows, layout), pageStyleLength(style.rowGap || style.gap, layout)),
  ].filter((guide) => guide.position > 0
    && (guide.orientation === 'vertical' ? guide.position < dimensions.width : guide.position < dimensions.height));
}

function evenGridGuides(orientation, start, total, count, gap) {
  if (count < 2 || total <= 0) return [];
  const guides = [];
  const safeGap = Math.max(0, Number(gap || 0));
  const track = (total - safeGap * (count - 1)) / count;
  if (track <= 0) return [];
  for (let index = 1; index < count; index += 1) {
    const beforeGap = round(start + index * track + (index - 1) * safeGap, 2);
    guides.push({ orientation, position: beforeGap, source: 'grid' });
    if (safeGap > 0) {
      guides.push({ orientation, position: round(beforeGap + safeGap, 2), source: 'grid' });
    }
  }
  return guides;
}

function trackGuides(orientation, start, tracks, gap) {
  if (tracks.length < 2) return [];
  const guides = [];
  let cursor = Number(start || 0);
  const safeGap = Math.max(0, Number(gap || 0));
  for (let index = 0; index < tracks.length - 1; index += 1) {
    cursor += tracks[index];
    guides.push({ orientation, position: round(cursor, 2), source: 'grid' });
    if (safeGap > 0) {
      cursor += safeGap;
      guides.push({ orientation, position: round(cursor, 2), source: 'grid' });
    }
  }
  return guides;
}

function parseTrackLengths(value, layout) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((part) => pageStyleLength(part, layout))
    .filter((length) => Number.isFinite(length) && length > 0);
}

function uniqueGuides(guides) {
  const unique = [];
  for (const guide of (guides || [])
    .filter((guide) => Number.isFinite(Number(guide.position)))
    .map((guide) => ({
      orientation: guide.orientation,
      position: round(Number(guide.position), 2),
      source: guide.source || 'grid',
    }))
    .sort((a, b) => {
      if (a.orientation !== b.orientation) return a.orientation === 'vertical' ? -1 : 1;
      return a.position - b.position;
    })) {
    const previous = unique[unique.length - 1];
    if (previous && previous.orientation === guide.orientation && Math.abs(previous.position - guide.position) <= 0.05) {
      continue;
    }
    unique.push(guide);
  }
  return unique;
}

function itemBounds(item, page, layout) {
  if (layout.unitMode === 'presentation') {
    const authoredBounds = observedAuthoredBounds(item, page, layout);
    if (authoredBounds) return authoredBounds;
  }
  if (layout.unitMode !== 'presentation' || !item.rectPx || !page.rectPx) {
    return item.boundsMm;
  }
  return boundsFromRect(item.rectPx, page.rectPx, layout);
}

function observedAuthoredBounds(item, page, layout) {
  if (!isObservedReverseItem(item, page)) return null;
  const style = item && item.authoredStyle || {};
  if (String(style.position || '').toLowerCase() !== 'absolute') return null;
  if (![style.left, style.top, style.width, style.height].every((value) => String(value || '').trim())) return null;
  return {
    x: cssLengthToTarget(style.left, layout),
    y: cssLengthToTarget(style.top, layout),
    width: cssLengthToTarget(style.width, layout),
    height: cssLengthToTarget(style.height, layout),
  };
}

function isObservedReverseItem(item, page) {
  const pageAttrs = page && page.attributes || {};
  const itemAttrs = item && item.attributes || {};
  if (pageAttrs[HTML_DATA_ID_ATTRIBUTES.OBSERVED] === 'true' || pageAttrs[HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE] === 'observation') return true;
  if (itemAttrs[HTML_DATA_ID_ATTRIBUTES.OBSERVED] === 'true' || itemAttrs[HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE] === 'observation') return true;
  const classList = item && item.classList || [];
  return classList.includes('observed-text');
}

function boundsFromRect(rect, pageRect, layout) {
  const scale = Number(layout.scale || 1);
  return {
    x: round((Number(rect.x) - Number(pageRect.x)) * scale, 2),
    y: round((Number(rect.y) - Number(pageRect.y)) * scale, 2),
    width: round(Number(rect.width) * scale, 2),
    height: round(Number(rect.height) * scale, 2),
  };
}

function cssLengthToTarget(value, layout) {
  if (layout.unitMode !== 'presentation') return normalizeVisualMm(cssLengthToPrintMmOrZero(value));
  const parsed = parseCssLength(value);
  if (!parsed) return 0;
  let px = parsed.value;
  if (parsed.unit === 'pt') px = parsed.value * 96 / 72;
  if (parsed.unit === 'mm') px = parsed.value * 96 / 25.4;
  return round(px * Number(layout.scale || 1), 2);
}

function cssLengthToPrintMmOrZero(value) {
  return cssLengthStringToMmOrZero(value);
}

function normalizeVisualMm(value) {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.15) return rounded;
  return round(value, 2);
}

module.exports = {
  resolveLayout,
  targetSizeFor,
  pageDimensions,
  pageMargins,
  pageGuides,
  itemBounds,
  cssLengthToTarget,
  cssLengthToMm: cssLengthToPrintMmOrZero,
  normalizeVisualMm,
};
