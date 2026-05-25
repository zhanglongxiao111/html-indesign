const { createReport, addMessage } = require('../shared/report');
const { parseCssLength, round } = require('../shared/geometry');
const { compileStyles } = require('./style-compiler');
const { placementFromAttributes } = require('./asset-detector');
const { normalizeCssColor } = require('./style-utils');
const { assetSourceFromElementLike } = require('../shared/assets');

function compileInstructions(snapshot, options = {}) {
  const layout = resolveLayout(snapshot, options);
  const styled = styledSnapshotForLayout(snapshot, options, layout);
  const report = createReport();
  addMessage(report, 'info', 'INSTRUCTIONS_COMPILE_START', 'Build instructions compilation started', {
    pageCount: styled.pages.length,
  });
  mergeReport(report, styled.report);

  const pages = styled.pages.map((page) => {
    const dimensions = pageDimensions(page, layout);
    const margins = pageMargins(page, layout);
    const guides = pageGuides(page, dimensions, margins, layout);
    const background = pageBackgroundItemFor(page, styled.styles, dimensions, options);
    const items = [
      background,
      ...page.items.flatMap((item) => instructionItemsFor(item, styled.assets || [], page, layout, options)),
    ].filter(Boolean).sort((a, b) => a.zIndex - b.zIndex);
    return {
      id: page.id,
      index: page.index,
      width: dimensions.width,
      height: dimensions.height,
      margins,
      guides,
      items,
    };
  });
  const layers = collectLayers(pages, options);

  return {
    metadata: {
      source: styled.metadata && styled.metadata.source,
      generatedAt: new Date().toISOString(),
      compiler: 'html-indesign/paged-html-to-instructions',
      mode: options.mode || 'editable-first',
    },
    document: {
      coordinateUnit: layout.targetUnit,
      unitMode: layout.unitMode,
      pages: pages.map((page) => ({
        id: page.id,
        width: page.width,
        height: page.height,
        margins: page.margins,
        guides: page.guides,
      })),
    },
    styles: styled.styles,
    assets: styled.assets || [],
    layers,
    pages,
    warnings: styled.warnings || [],
    report,
  };
}

function instructionItemsFor(item, assets, page, layout, options) {
  const baseItem = instructionItemFor(item, assets, page, layout, options);
  if (!baseItem) return [];
  return [
    baseItem,
    ...decorationItemsFor(item, baseItem, layout),
  ];
}

function instructionItemFor(item, assets, page, layout, options) {
  const base = {
    id: item.id,
    role: item.role,
    bounds: itemBounds(item, page, layout),
    zIndex: item.zIndex || 0,
    layer: layerForItem(item, options),
    sourceSelector: item.sourceSelector,
    styleRefs: item.styleRefs,
    effects: effectsForInstruction(item.effects || null, page, layout),
  };
  if (item.role === 'text') {
    return {
      ...base,
      type: 'TEXT',
      bounds: textFrameBounds(item, base.bounds, layout),
      text: item.content.text,
      paragraphStyle: item.styleRefs.paragraphStyle,
      objectStyle: item.styleRefs.objectStyle,
      frameStyle: item.styleRefs.frameStyle,
      runs: item.content.runs,
    };
  }
  if (item.role === 'graphic') {
    const asset = assetForItem(item, assets);
    const placement = asset ? placementForItem(item, asset) : null;
    const contentBounds = graphicContentBounds(item, base.bounds, layout);
    return {
      ...base,
      type: 'GRAPHIC',
      objectStyle: item.styleRefs.objectStyle,
      frameStyle: item.styleRefs.frameStyle,
      contentBounds,
      placed: asset ? {
        assetId: asset.id,
        fit: placement.fit,
        position: placement.position,
        pageNumber: placement.pageNumber,
        crop: placement.crop,
        artboard: placement.artboard,
        layerComp: placement.layerComp,
        preserveVector: placement.preserveVector,
        contentBounds,
      } : null,
    };
  }
  if (item.role === 'table') {
    const rows = tableRowsForInstruction(item, page, layout);
    const rowHeights = tableRowHeightsForInstruction(item, rows, layout);
    const columnWidths = tableColumnWidthsForInstruction(item, rows, layout);
    return {
      ...base,
      type: 'TABLE',
      bounds: nativeTableBounds(base.bounds, rowHeights || [], layout),
      tableStyle: item.styleRefs.tableStyle,
      objectStyle: item.styleRefs.objectStyle,
      frameStyle: item.styleRefs.frameStyle,
      text: item.text,
      rows,
      columnCount: item.content.columnCount || 0,
      columnWidths,
      rowHeights,
    };
  }
  const line = nativeLineFor(item, base.bounds, layout);
  if (line) {
    return {
      ...base,
      ...line,
      type: 'LINE',
      objectStyle: item.styleRefs.objectStyle,
      frameStyle: null,
    };
  }
  return {
    ...base,
    type: 'SHAPE',
    objectStyle: item.styleRefs.objectStyle,
    frameStyle: item.styleRefs.frameStyle,
    shapeKind: shapeKindFor(item),
  };
}

function mergeReport(target, source) {
  if (!source || !Array.isArray(source.messages)) return;
  for (const message of source.messages) {
    target.messages.push(message);
    if (message.level === 'error') target.errorCount += 1;
    if (message.level === 'warning') target.warningCount += 1;
  }
}

function styledSnapshotForLayout(snapshot, options, layout) {
  if (snapshot.styles && stylesCompatibleWithLayout(snapshot.styleLayout, layout)) return snapshot;
  return compileStyles(snapshot, { ...options, layout });
}

function stylesCompatibleWithLayout(styleLayout, layout) {
  if (!styleLayout) return layout.unitMode !== 'presentation';
  if (styleLayout.unitMode !== layout.unitMode) return false;
  if (layout.unitMode !== 'presentation') return true;
  if ((styleLayout.targetUnit || 'pt') !== (layout.targetUnit || 'pt')) return false;
  if (Math.abs(Number(styleLayout.scale || 1) - Number(layout.scale || 1)) > 0.0001) return false;
  const expected = layout.targetSize || {};
  const actual = styleLayout.targetSize || {};
  return Math.abs(Number(actual.width || 0) - Number(expected.width || 0)) < 0.01
    && Math.abs(Number(actual.height || 0) - Number(expected.height || 0)) < 0.01;
}

function resolveLayout(snapshot, options) {
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
    width: firstPage && firstPage.rectPx ? Number(firstPage.rectPx.width) : Number(firstPage && firstPage.widthMm || 0),
    height: firstPage && firstPage.rectPx ? Number(firstPage.rectPx.height) : Number(firstPage && firstPage.heightMm || 0),
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
  const semantic = boxLengths(attrs['data-id-margin'], layout);
  if (semantic) return semantic;
  const style = page.computedStyle || {};
  return {
    top: pageStyleLength(attrs['data-id-margin-top'] || style.paddingTop, layout),
    right: pageStyleLength(attrs['data-id-margin-right'] || style.paddingRight, layout),
    bottom: pageStyleLength(attrs['data-id-margin-bottom'] || style.paddingBottom, layout),
    left: pageStyleLength(attrs['data-id-margin-left'] || style.paddingLeft, layout),
  };
}

function pageStyleLength(value, layout) {
  if (layout.unitMode === 'presentation') return cssLengthToTarget(value, layout);
  return normalizeVisualMm(cssLengthToMm(value));
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
  const mode = String(attrs['data-id-guide-mode'] || attrs['data-id-guides-mode'] || '').trim().toLowerCase();
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
  if (attrs['data-id-guide-ignore'] != null) return false;
  if (attrs['data-id-role'] === 'annotation') return false;
  if ((item.classList || []).includes('page-number')) return false;
  if (attrs['data-id-paragraph-style'] === 'folio') return false;
  if ((item.ancestorCandidateIndexes || []).length) return false;
  const bounds = itemBounds(item, page, layout);
  if (!bounds || coversWholePage(bounds, page, layout)) return false;
  if (attrs['data-id-object'] != null) return true;
  if (item.role === 'graphic' || item.role === 'table') return true;
  return item.role === 'text' && attrs['data-id-paragraph-style'];
}

function coversWholePage(bounds, page, layout) {
  const dimensions = pageDimensions(page, layout);
  return Math.abs(Number(bounds.x || 0)) < 0.01
    && Math.abs(Number(bounds.y || 0)) < 0.01
    && Math.abs(Number(bounds.width || 0) - Number(dimensions.width || 0)) < 0.01
    && Math.abs(Number(bounds.height || 0) - Number(dimensions.height || 0)) < 0.01;
}

function semanticGridSpec(attrs) {
  const raw = attrs['data-id-grid'] || attrs['data-id-guides'];
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
    attrs['data-id-column-gutter']
      || attrs['data-id-column-gap']
      || attrs['data-id-gutter']
      || attrs['data-id-gap']
      || style.columnGap,
    layout
  );
  const rowGap = pageStyleLength(
    attrs['data-id-row-gutter']
      || attrs['data-id-row-gap']
      || attrs['data-id-gutter']
      || attrs['data-id-gap']
      || style.rowGap,
    layout
  );
  const baseline = pageStyleLength(attrs['data-id-baseline'] || attrs['data-id-baseline-grid'], layout);
  const baselineGuides = String(attrs['data-id-baseline-guides'] || '').trim().toLowerCase();
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

function effectsForInstruction(effects, page, layout) {
  if (!effects || layout.unitMode !== 'presentation') return effects || null;
  const out = { ...effects };
  if (effects.gradientFeather) {
    out.gradientFeather = {
      ...effects.gradientFeather,
      start: pagePointToTarget(effects.gradientFeather.start, page, layout),
      length: pageLengthToTarget(effects.gradientFeather.length, page, layout),
    };
  }
  return out;
}

function pagePointToTarget(point, page, layout) {
  const scale = pageScaleFromMm(page, layout);
  return {
    x: roundEffectCoordinate(Number(point && point.x || 0) * scale.x),
    y: roundEffectCoordinate(Number(point && point.y || 0) * scale.y),
  };
}

function pageLengthToTarget(length, page, layout) {
  if (!Number.isFinite(Number(length))) return length;
  return roundEffectCoordinate(Number(length) * pageScaleFromMm(page, layout).x);
}

function pageScaleFromMm(page, layout) {
  return {
    x: Number(layout.targetSize && layout.targetSize.width || 0) / Number(page.widthMm || 1),
    y: Number(layout.targetSize && layout.targetSize.height || 0) / Number(page.heightMm || 1),
  };
}

function roundEffectCoordinate(value) {
  const rounded = round(value, 2);
  const nearestInteger = Math.round(rounded);
  return Math.abs(rounded - nearestInteger) < 0.05 ? nearestInteger : rounded;
}

function itemBounds(item, page, layout) {
  if (layout.unitMode !== 'presentation' || !item.rectPx || !page.rectPx) {
    return item.boundsMm;
  }
  return boundsFromRect(item.rectPx, page.rectPx, layout);
}

function textFrameBounds(item, bounds, layout) {
  if (layout.unitMode !== 'presentation') return bounds;
  const minHeight = minimumTextFrameHeight(item, layout);
  const minWidth = minimumTextFrameWidth(item, layout);
  return {
    ...bounds,
    width: minWidth && Number(bounds.width || 0) < minWidth ? round(minWidth, 2) : bounds.width,
    height: minHeight && Number(bounds.height || 0) < minHeight ? round(minHeight, 2) : bounds.height,
  };
}

function minimumTextFrameHeight(item, layout) {
  const style = item.computedStyle || {};
  const lineHeight = cssLengthToTarget(style.lineHeight, layout)
    || round(cssLengthToTarget(style.fontSize, layout) * 1.2, 2);
  if (!lineHeight) return 0;
  return round(lineHeight * textLineCount(item), 2);
}

function textLineCount(item) {
  const text = item && item.content && item.content.text ? item.content.text : item && item.text;
  return Math.max(1, String(text || '').split(/\r\n|\r|\n/).length);
}

function minimumTextFrameWidth(item, layout) {
  if (!usesAutoInlineWidth(item)) return 0;
  const style = item.computedStyle || {};
  const fontSize = cssLengthToTarget(style.fontSize, layout);
  if (!fontSize) return 0;
  const text = String(item && item.content && item.content.text ? item.content.text : item && item.text || '');
  const longestLine = text.split(/\r\n|\r|\n/).reduce((max, line) => Math.max(max, line.length), 0);
  return round(longestLine * fontSize * 0.65 + fontSize * 0.35, 2);
}

function usesAutoInlineWidth(item) {
  const style = item.computedStyle || {};
  const authored = item.authoredStyle || {};
  return (String(item.tagName || '').toLowerCase() === 'span' && !authored.width)
    || String(style.display || '').toLowerCase() === 'inline'
    || String(style.width || '').toLowerCase() === 'auto';
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
  if (layout.unitMode !== 'presentation') return normalizeVisualMm(cssLengthToMm(value));
  const parsed = parseCssLength(value);
  if (!parsed) return 0;
  let px = parsed.value;
  if (parsed.unit === 'pt') px = parsed.value * 96 / 72;
  if (parsed.unit === 'mm') px = parsed.value * 96 / 25.4;
  return round(px * Number(layout.scale || 1), 2);
}

function tableRowsForInstruction(item, page, layout) {
  const rows = item.content.rows || [];
  if (layout.unitMode !== 'presentation') return rows;
  return rows.map((row) => ({
    ...row,
    cells: (row.cells || []).map((cell) => {
      const raw = tableCellSnapshot(item, row.index, cell.index);
      return {
        ...cell,
        bounds: raw && raw.rectPx ? boundsFromRect(raw.rectPx, page.rectPx, layout) : scaleBounds(cell.bounds, layout),
      };
    }),
  }));
}

function tableCellSnapshot(item, rowIndex, cellIndex) {
  const row = (item.table || []).find((candidate) => Number(candidate.index) === Number(rowIndex));
  if (!row) return null;
  return (row.cells || []).find((candidate) => Number(candidate.index) === Number(cellIndex)) || null;
}

function tableColumnWidthsForInstruction(item, rows, layout) {
  if (layout.unitMode !== 'presentation') return item.content.columnWidths || [];
  const sourceRow = (rows || []).find((row) => (row.cells || []).every((cell) => cell.bounds && Number(cell.bounds.width) > 0));
  if (!sourceRow) return [];
  const widths = [];
  for (const cell of sourceRow.cells || []) {
    const span = Math.max(1, Number(cell.colSpan || 1));
    const width = Number(cell.bounds.width || 0) / span;
    for (let index = 0; index < span; index += 1) widths.push(round(width, 2));
  }
  return widths;
}

function tableRowHeightsForInstruction(item, rows, layout) {
  if (layout.unitMode !== 'presentation') return item.content.rowHeights || [];
  return (rows || []).map((row) => {
    const height = (row.cells || []).reduce((max, cell) => Math.max(max, Number(cell.bounds && cell.bounds.height || 0), minimumTableCellHeight(cell)), 0);
    return round(height, 2);
  });
}

function minimumTableCellHeight(cell) {
  const padding = cell.padding || {};
  const leading = Number(cell.leading || 0) || Number(cell.pointSize || 0) * 1.2;
  const stroke = Number(cell.borderWeight || 0);
  return Number(padding.top || 0) + Number(padding.bottom || 0) + leading + stroke * 2;
}

function scaleBounds(bounds, layout) {
  if (!bounds) return null;
  const scale = Number(layout.scale || 1);
  return {
    x: round(Number(bounds.x || 0) * scale, 2),
    y: round(Number(bounds.y || 0) * scale, 2),
    width: round(Number(bounds.width || 0) * scale, 2),
    height: round(Number(bounds.height || 0) * scale, 2),
  };
}

function nativeTableBounds(bounds, rowHeights, layout) {
  const rowTotal = (rowHeights || []).reduce((sum, height) => sum + Number(height || 0), 0);
  const slack = layout && layout.unitMode === 'presentation' ? 12 : 1;
  const requiredHeight = rowTotal > 0 ? rowTotal + slack : 0;
  if (requiredHeight <= Number(bounds.height || 0)) return bounds;
  return {
    ...bounds,
    height: round(requiredHeight, 2),
  };
}

function pageBackgroundItemFor(page, styles, dimensions, options) {
  const style = page.computedStyle || {};
  const fill = normalizeCssColor(style.backgroundColor);
  if (!fill) return null;
  ensureInstructionSwatch(styles, fill);
  return {
    id: `${page.id}-background`,
    role: 'background',
    type: 'SHAPE',
    bounds: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
    zIndex: -1000,
    layer: mappedLayerName('background', options),
    sourceSelector: `#${page.id}`,
    styleRefs: {},
    objectStyle: null,
    frameStyle: null,
    styleOverride: {
      fillColor: fill.name,
      fillOpacity: fill.alpha == null ? null : fill.alpha,
      strokeWeight: 0,
    },
  };
}

function ensureInstructionSwatch(styles, normalized) {
  if (!styles || !normalized || !normalized.name) return;
  styles.swatches = styles.swatches || {};
  if (!styles.swatches[normalized.name]) {
    styles.swatches[normalized.name] = {
      name: normalized.name,
      model: 'process',
      space: 'RGB',
      value: normalized.hex,
    };
  }
}

function nativeLineFor(item, baseBounds, layout) {
  if (!item || item.role !== 'shape') return null;
  const classNames = item.classList || [];
  const objectStyle = item.styleRefs && item.styleRefs.objectStyle;
  const explicitLine = classNames.includes('line') || /(^|-)line($|-)/.test(String(objectStyle || ''));
  const edge = item.box && item.box.borders && item.box.borders.top;
  if (!explicitLine || !visibleBorder(edge)) return null;
  const bounds = layout.unitMode === 'presentation'
    ? {
      x: styleLengthTarget(item, 'left', baseBounds.x, layout),
      y: styleLengthTarget(item, 'top', baseBounds.y, layout),
      width: styleLengthTarget(item, 'width', baseBounds.width, layout),
      height: styleLengthTarget(item, 'height', 0, layout),
    }
    : {
      x: styleLengthMm(item, 'left', item.boundsMm.x),
      y: styleLengthMm(item, 'top', item.boundsMm.y),
      width: styleLengthMm(item, 'width', item.boundsMm.width),
      height: styleLengthMm(item, 'height', 0),
    };
  return {
    bounds,
    rotationAngle: rotationAngleFor(item),
    strokeColor: edge.color,
    strokeWeight: edge.widthPt,
  };
}

function shapeKindFor(item) {
  if (!item || item.role !== 'shape') return 'rectangle';
  const radius = styleValue(item, 'borderRadius');
  const bounds = item.boundsMm || {};
  if (String(radius || '').trim() === '50%' && Math.abs(Number(bounds.width || 0) - Number(bounds.height || 0)) < 0.5) {
    return 'oval';
  }
  return 'rectangle';
}

function rotationAngleFor(item) {
  const raw = styleValue(item, 'transform');
  const rotate = String(raw || '').match(/rotate\(\s*([+-]?(?:\d+|\d*\.\d+))deg\s*\)/i);
  if (rotate) return round(Number(rotate[1]), 2);
  const matrix = String(raw || '').match(/^matrix\(\s*([+-]?(?:\d+|\d*\.\d+)),\s*([+-]?(?:\d+|\d*\.\d+)),/i);
  if (matrix) return round(Math.atan2(Number(matrix[2]), Number(matrix[1])) * 180 / Math.PI, 2);
  return 0;
}

function styleLengthMm(item, prop, fallback) {
  const raw = styleValue(item, prop);
  const parsed = parseCssLength(raw);
  if (!parsed) return normalizeVisualMm(Number(fallback || 0));
  return normalizeVisualMm(cssLengthToMm(raw));
}

function styleLengthTarget(item, prop, fallback, layout) {
  const raw = styleValue(item, prop);
  const parsed = parseCssLength(raw);
  if (!parsed) return round(Number(fallback || 0), 2);
  return cssLengthToTarget(raw, layout);
}

function styleValue(item, prop) {
  return (item.authoredStyle && item.authoredStyle[prop])
    || (item.computedStyle && item.computedStyle[prop])
    || '';
}

function decorationItemsFor(item, baseItem, layout) {
  if (baseItem.type !== 'SHAPE' && baseItem.type !== 'GRAPHIC') return [];
  const decorations = borderDecorationItemsFor(item, baseItem, layout);
  const objectText = objectTextItemFor(item, baseItem, layout);
  if (objectText) decorations.push(objectText);
  return decorations;
}

function borderDecorationItemsFor(item, baseItem, layout) {
  const borders = item.box && item.box.borders;
  if (!borders || bordersAreUniform(borders)) return [];
  const decorations = [];
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const edge = borders[side];
    if (!visibleBorder(edge)) continue;
    const width = borderEdgeWidth(edge, layout);
    if (!width) continue;
    decorations.push({
      id: `${item.id}-border-${side}`,
      role: 'decoration',
      type: 'SHAPE',
      bounds: borderDecorationBounds(baseItem.bounds, side, width),
      zIndex: round((baseItem.zIndex || 0) + 0.02, 2),
      layer: baseItem.layer,
      sourceSelector: baseItem.sourceSelector,
      styleRefs: {},
      objectStyle: null,
      frameStyle: null,
      styleOverride: {
        fillColor: edge.color,
        strokeWeight: 0,
      },
    });
  }
  return decorations;
}

function borderEdgeWidth(edge, layout) {
  const raw = layout.unitMode === 'presentation'
    ? Number(edge.widthPt || 0)
    : cssLengthToMm(edge.widthCss);
  return normalizeVisualMm(raw);
}

function borderDecorationBounds(bounds, side, width) {
  const safeWidth = Math.min(width, bounds.width);
  const safeHeight = Math.min(width, bounds.height);
  if (side === 'top') {
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: safeHeight };
  }
  if (side === 'right') {
    return { x: round(bounds.x + bounds.width - safeWidth, 2), y: bounds.y, width: safeWidth, height: bounds.height };
  }
  if (side === 'bottom') {
    return { x: bounds.x, y: round(bounds.y + bounds.height - safeHeight, 2), width: bounds.width, height: safeHeight };
  }
  return { x: bounds.x, y: bounds.y, width: safeWidth, height: bounds.height };
}

function objectTextItemFor(item, baseItem, layout) {
  if (baseItem.type !== 'SHAPE') return null;
  if (!item.content || !item.content.text) return null;
  const padding = paddingForItem(item, layout);
  return {
    id: `${item.id}-text`,
    role: 'text',
    type: 'TEXT',
    bounds: insetBounds(baseItem.bounds, padding),
    zIndex: round((baseItem.zIndex || 0) + 0.03, 2),
    layer: baseItem.layer,
    sourceSelector: baseItem.sourceSelector,
    styleRefs: item.styleRefs,
    text: item.content.text,
    paragraphStyle: item.styleRefs.paragraphStyle,
    runs: item.content.runs || [{ text: item.content.text, characterStyle: null }],
  };
}

function paddingForItem(item, layout) {
  if (layout.unitMode === 'presentation') {
    const style = item.computedStyle || {};
    return {
      top: cssLengthToTarget(style.paddingTop, layout),
      right: cssLengthToTarget(style.paddingRight, layout),
      bottom: cssLengthToTarget(style.paddingBottom, layout),
      left: cssLengthToTarget(style.paddingLeft, layout),
    };
  }
  const style = item.computedStyle || {};
  return {
    top: normalizeVisualMm(cssLengthToMm(style.paddingTop)),
    right: normalizeVisualMm(cssLengthToMm(style.paddingRight)),
    bottom: normalizeVisualMm(cssLengthToMm(style.paddingBottom)),
    left: normalizeVisualMm(cssLengthToMm(style.paddingLeft)),
  };
}

function graphicContentBounds(item, bounds, layout) {
  const padding = paddingForItem(item, layout);
  if (!padding.top && !padding.right && !padding.bottom && !padding.left) return null;
  return insetBounds(bounds, padding);
}

function insetBounds(bounds, padding) {
  const width = Math.max(0, bounds.width - padding.left - padding.right);
  const height = Math.max(0, bounds.height - padding.top - padding.bottom);
  return {
    x: round(bounds.x + padding.left, 2),
    y: round(bounds.y + padding.top, 2),
    width: round(width, 2),
    height: round(height, 2),
  };
}

function visibleBorder(edge) {
  return edge
    && edge.color
    && edge.style !== 'none'
    && edge.style !== 'hidden'
    && Number(edge.widthPt || 0) > 0;
}

function bordersAreUniform(borders) {
  return sameBorder(borders.top, borders.right)
    && sameBorder(borders.top, borders.bottom)
    && sameBorder(borders.top, borders.left);
}

function sameBorder(a, b) {
  if (!visibleBorder(a) && !visibleBorder(b)) return true;
  if (!visibleBorder(a) || !visibleBorder(b)) return false;
  return a.color === b.color
    && a.style === b.style
    && Math.abs(Number(a.widthPt || 0) - Number(b.widthPt || 0)) < 0.01;
}

function cssLengthToMm(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return 0;
  if (parsed.unit === 'mm') return parsed.value;
  if (parsed.unit === 'pt') return parsed.value * 25.4 / 72;
  return parsed.value * 25.4 / 96;
}

function normalizeVisualMm(value) {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.15) return rounded;
  return round(value, 2);
}

function assetForItem(item, assets) {
  const source = assetSourceFromElementLike({
    tagName: item.tagName,
    attributes: item.attributes,
    computedStyle: item.computedStyle,
    authoredStyle: item.authoredStyle,
  }).src;
  return assets.find((asset) => source && asset.src === source)
    || assets.find((asset) => asset.sourceSelector === item.sourceSelector)
    || null;
}

function placementForItem(item, asset) {
  const itemPlacement = placementFromAttributes(item.attributes || {}, item.computedStyle || {});
  const assetPlacement = asset.placement || {};
  return {
    fit: itemPlacement.fit || assetPlacement.fit || 'fill',
    position: itemPlacement.position || assetPlacement.position || '50% 50%',
    pageNumber: itemPlacement.pageNumber,
    crop: itemPlacement.crop,
    artboard: itemPlacement.artboard,
    layerComp: itemPlacement.layerComp,
    preserveVector: itemPlacement.preserveVector,
  };
}

function layerForItem(item, options) {
  let token = 'content';
  if (item.attributes && item.attributes['data-id-layer']) token = item.attributes['data-id-layer'];
  else if (item.role === 'text') token = 'text';
  else if (item.role === 'graphic') token = 'graphics';
  else if (item.role === 'table') token = 'tables';
  return mappedLayerName(token, options);
}

function collectLayers(pages, options) {
  const names = new Map();
  for (const token of ['background', 'image', 'drawing', 'graphics', 'content', 'overlay', 'tables', 'text', 'annotation', 'annotations']) {
    names.set(mappedLayerName(token, options), names.size);
  }
  for (const page of pages) {
    for (const item of page.items) {
      if (!names.has(item.layer)) names.set(item.layer, names.size);
    }
  }
  return Array.from(names.keys()).sort((a, b) => {
    const rankA = layerRank(a);
    const rankB = layerRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return names.get(a) - names.get(b);
  }).map((name, index) => ({
    name,
    order: index,
  }));
}

function layerRank(name) {
  const ranks = {
    background: 0,
    '背景': 0,
    image: 10,
    '图片': 10,
    drawing: 20,
    '图纸': 20,
    graphics: 30,
    '图形': 30,
    content: 40,
    '内容': 40,
    overlay: 50,
    '遮罩': 50,
    tables: 60,
    '表格': 60,
    text: 70,
    '文字': 70,
    annotation: 80,
    '标注': 80,
    annotations: 80,
    '标注组': 80,
  };
  return ranks[name] == null ? 45 : ranks[name];
}

function mappedLayerName(token, options) {
  const map = (options && options.layerNameMap)
    || (options && options.styleNameMap && options.styleNameMap.layers)
    || null;
  return map && map[token] ? map[token] : token;
}

module.exports = {
  compileInstructions,
};
