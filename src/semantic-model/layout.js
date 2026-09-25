const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const {
  parseCssLength,
  cssLengthStringToMmOrZero,
  cssLengthStringToPx,
  round,
  roundPresentationLength,
} = require('../shared/geometry');

// Chromium 按 1/64 px 排版：页面外框（getBoundingClientRect、computed width）会把作者写的 595.276px 截成
// 595.265625、1587.39px 截成 1587.375。页面尺寸是作者契约，与量出的外框相差不到这个量化误差时取作者声明值。
const LAYOUT_UNIT_TOLERANCE_PX = 0.02;

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
  const source = pageSourceSize(firstPage);
  const target = targetSizeFor(options.targetSize, source);
  assertCompatibleAspectRatio(source, target);
  return {
    unitMode: 'presentation',
    targetUnit: 'pt',
    sourceSize: source,
    targetSize: target,
    // 保持源尺寸时 1 px 就是 1 pt：比例恒为 1，不能拿舍入后的目标尺寸除以量出的尺寸（那样每代多出 0.0001pt 字号）。
    scale: target.name === 'source' ? 1 : target.width / source.width,
  };
}

function pageSourceSize(page) {
  if (!page) return { width: 0, height: 0 };
  if (!page.rectPx) return { width: Number(page.widthMm || 0), height: Number(page.heightMm || 0) };
  return {
    width: declaredPageLength(page, 'width', Number(page.rectPx.width)),
    height: declaredPageLength(page, 'height', Number(page.rectPx.height)),
  };
}

function declaredPageLength(page, prop, measured) {
  const declared = cssLengthStringToPx(page.authoredStyle && page.authoredStyle[prop]);
  if (declared == null || !Number.isFinite(measured)) return measured;
  return Math.abs(declared - measured) <= LAYOUT_UNIT_TOLERANCE_PX ? declared : measured;
}

function targetSizeFor(value, source) {
  if (!value || value === 'same' || value === 'source') {
    return {
      width: roundPresentationLength(source.width),
      height: roundPresentationLength(source.height),
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
    width: roundPresentationLength(layout.targetSize.width),
    height: roundPresentationLength(layout.targetSize.height),
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
  const measured = boundsFromRect(item.rectPx, page.rectPx, layout);
  const pinnedHeight = observedPinnedHeight(item, page, layout);
  return pinnedHeight == null ? measured : { ...measured, height: pinnedHeight };
}

// 留在网格里、高度按读回钉住的观察对象（reverse-overrides.css 写 align-self:start; height:…）：
// 左、上、宽由网格排出（量出的外框），高度取作者声明值，不取按 1/64 px 截断后的外框高。
function observedPinnedHeight(item, page, layout) {
  if (!isObservedReverseItem(item, page)) return null;
  const style = item && item.authoredStyle || {};
  const parsed = parseCssLength(style.height);
  if (!parsed || item.gridPlaced !== true || String(style.position || '').trim().toLowerCase() === 'absolute') return null;
  const height = cssLengthToTarget(style.height, layout);
  return Number.isFinite(height) && height > 0 ? height : null;
}

function observedAuthoredBounds(item, page, layout) {
  if (!isObservedReverseItem(item, page)) return null;
  const style = item && item.authoredStyle || {};
  if (String(style.position || '').toLowerCase() !== 'absolute') return null;
  if (![style.left, style.top, style.width, style.height].every((value) => String(value || '').trim())) return null;
  const ancestorOffset = observedAncestorOffset(item, page, layout);
  return {
    x: roundPresentationLength(cssLengthToTarget(style.left, layout) + ancestorOffset.x),
    y: roundPresentationLength(cssLengthToTarget(style.top, layout) + ancestorOffset.y),
    width: cssLengthToTarget(style.width, layout),
    height: cssLengthToTarget(style.height, layout),
  };
}

function observedAncestorOffset(item, page, layout) {
  const ids = Array.isArray(item && item.ancestorCandidateIds) ? item.ancestorCandidateIds : [];
  if (!ids.length) return { x: 0, y: 0 };
  const itemsById = new Map((page && page.items || []).map((candidate) => [candidate && candidate.id, candidate]));
  let x = 0;
  let y = 0;
  for (const id of ids) {
    const ancestor = itemsById.get(id);
    const style = ancestor && ancestor.authoredStyle || {};
    if (String(style.position || '').toLowerCase() !== 'absolute') continue;
    if (!String(style.left || '').trim() || !String(style.top || '').trim()) continue;
    // 绝对定位子对象以祖先的内边距盒为参照：祖先的 CSS border 也要计入偏移，
    // 否则带描边的观察容器（反向导出的矢量容器）里的子对象会整体偏一个描边宽。
    const computed = ancestor && ancestor.computedStyle || {};
    x += cssLengthToTarget(style.left, layout) + borderOffset(computed.borderLeftWidth, layout);
    y += cssLengthToTarget(style.top, layout) + borderOffset(computed.borderTopWidth, layout);
  }
  return { x, y };
}

function borderOffset(value, layout) {
  if (!String(value || '').trim()) return 0;
  const offset = cssLengthToTarget(value, layout);
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

function isObservedReverseItem(item, page) {
  const pageAttrs = page && page.attributes || {};
  const itemAttrs = item && item.attributes || {};
  if (pageAttrs[HTML_DATA_ID_ATTRIBUTES.OBSERVED] === 'true' || pageAttrs[HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE] === 'observation') return true;
  if (itemAttrs[HTML_DATA_ID_ATTRIBUTES.OBSERVED] === 'true' || itemAttrs[HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE] === 'observation') return true;
  const classList = item && item.classList || [];
  return classList.includes('observed-text');
}

// 量出的外框按 1/64 px 截断，页面尺寸取的是作者声明值：贴着页面右 / 下边的对象（满版底图、蒙版）
// 延伸到页面边，不因截断差出一条缝。
function boundsFromRect(rect, pageRect, layout) {
  const scale = Number(layout.scale || 1);
  const x = round((Number(rect.x) - Number(pageRect.x)) * scale, 2);
  const y = round((Number(rect.y) - Number(pageRect.y)) * scale, 2);
  return {
    x,
    y,
    width: extentToPageEdge(rect.x, rect.width, pageRect.x, pageRect.width, x, layout, 'width'),
    height: extentToPageEdge(rect.y, rect.height, pageRect.y, pageRect.height, y, layout, 'height'),
  };
}

function extentToPageEdge(start, size, pageStart, pageSize, targetStart, layout, prop) {
  const scaled = round(Number(size) * Number(layout.scale || 1), 2);
  const pageTarget = Number(layout.targetSize && layout.targetSize[prop]);
  if (!Number.isFinite(pageTarget) || pageTarget <= 0) return scaled;
  const gap = (Number(pageStart) + Number(pageSize)) - (Number(start) + Number(size));
  if (Math.abs(gap) > LAYOUT_UNIT_TOLERANCE_PX) return scaled;
  return roundPresentationLength(pageTarget - targetStart);
}

function cssLengthToTarget(value, layout) {
  if (layout.unitMode !== 'presentation') return normalizeVisualMm(cssLengthToPrintMmOrZero(value));
  const parsed = parseCssLength(value);
  if (!parsed) return 0;
  let px = parsed.value;
  if (parsed.unit === 'pt') px = parsed.value * 96 / 72;
  if (parsed.unit === 'mm') px = parsed.value * 96 / 25.4;
  return roundPresentationLength(px * Number(layout.scale || 1));
}

// 目标坐标系里的长度舍入：presentation（pt）按作者长度精度，print（mm）按两位小数。
function roundTargetLength(value, layout) {
  return layout && layout.unitMode === 'presentation' ? roundPresentationLength(value) : round(value, 2);
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
  roundTargetLength,
  cssLengthToMm: cssLengthToPrintMmOrZero,
  normalizeVisualMm,
};
