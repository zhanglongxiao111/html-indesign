const { createReport, addMessage } = require('../shared/report');
const { parseCssLength, round } = require('../shared/geometry');
const { compileStyles } = require('./style-compiler');
const { normalizeCssColor } = require('./style-utils');

function compileInstructions(snapshot, options = {}) {
  const styled = snapshot.styles ? snapshot : compileStyles(snapshot, options);
  const report = createReport();
  addMessage(report, 'info', 'INSTRUCTIONS_COMPILE_START', 'Build instructions compilation started', {
    pageCount: styled.pages.length,
  });

  const pages = styled.pages.map((page) => {
    const background = pageBackgroundItemFor(page, styled.styles);
    const items = [
      background,
      ...page.items.flatMap((item) => instructionItemsFor(item, styled.assets || [])),
    ].filter(Boolean).sort((a, b) => a.zIndex - b.zIndex);
    return {
      id: page.id,
      index: page.index,
      width: page.widthMm,
      height: page.heightMm,
      items,
    };
  });
  const layers = collectLayers(pages);

  return {
    metadata: {
      source: styled.metadata && styled.metadata.source,
      generatedAt: new Date().toISOString(),
      compiler: 'html-indesign/paged-html-to-instructions',
      mode: options.mode || 'editable-first',
    },
    document: {
      pages: styled.pages.map((page) => ({
        id: page.id,
        width: page.widthMm,
        height: page.heightMm,
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

function instructionItemsFor(item, assets) {
  const baseItem = instructionItemFor(item, assets);
  if (!baseItem) return [];
  return [
    baseItem,
    ...decorationItemsFor(item, baseItem),
  ];
}

function instructionItemFor(item, assets) {
  const base = {
    id: item.id,
    role: item.role,
    bounds: item.boundsMm,
    zIndex: item.zIndex || 0,
    layer: layerForItem(item),
    sourceSelector: item.sourceSelector,
    styleRefs: item.styleRefs,
    effects: item.effects || null,
  };
  if (item.role === 'text') {
    return {
      ...base,
      type: 'TEXT',
      text: item.content.text,
      paragraphStyle: item.styleRefs.paragraphStyle,
      runs: item.content.runs,
    };
  }
  if (item.role === 'graphic') {
    const asset = assetForItem(item, assets);
    return {
      ...base,
      type: 'GRAPHIC',
      objectStyle: item.styleRefs.objectStyle,
      frameStyle: item.styleRefs.frameStyle,
      placed: asset ? {
        assetId: asset.id,
        fit: asset.placement.fit,
        position: asset.placement.position,
        pageNumber: asset.placement.pageNumber,
        crop: asset.placement.crop,
        artboard: asset.placement.artboard,
        layerComp: asset.placement.layerComp,
        preserveVector: asset.placement.preserveVector,
      } : null,
    };
  }
  if (item.role === 'table') {
    return {
      ...base,
      type: 'TABLE',
      bounds: nativeTableBounds(base.bounds, item.content.rowHeights || []),
      tableStyle: item.styleRefs.tableStyle,
      text: item.text,
      rows: item.content.rows || [],
      columnCount: item.content.columnCount || 0,
      columnWidths: item.content.columnWidths || [],
      rowHeights: item.content.rowHeights || [],
    };
  }
  const line = nativeLineFor(item);
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

function nativeTableBounds(bounds, rowHeights) {
  const rowTotal = (rowHeights || []).reduce((sum, height) => sum + Number(height || 0), 0);
  const requiredHeight = rowTotal > 0 ? rowTotal + 1 : 0;
  if (requiredHeight <= Number(bounds.height || 0)) return bounds;
  return {
    ...bounds,
    height: round(requiredHeight, 2),
  };
}

function pageBackgroundItemFor(page, styles) {
  const style = page.computedStyle || {};
  const fill = normalizeCssColor(style.backgroundColor);
  if (!fill) return null;
  ensureInstructionSwatch(styles, fill);
  return {
    id: `${page.id}-background`,
    role: 'background',
    type: 'SHAPE',
    bounds: { x: 0, y: 0, width: page.widthMm, height: page.heightMm },
    zIndex: -1000,
    layer: 'background',
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

function nativeLineFor(item) {
  if (!item || item.role !== 'shape') return null;
  const classNames = item.classList || [];
  const objectStyle = item.styleRefs && item.styleRefs.objectStyle;
  const explicitLine = classNames.includes('line') || /(^|-)line($|-)/.test(String(objectStyle || ''));
  const edge = item.box && item.box.borders && item.box.borders.top;
  if (!explicitLine || !visibleBorder(edge)) return null;
  const bounds = {
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

function styleValue(item, prop) {
  return (item.authoredStyle && item.authoredStyle[prop])
    || (item.computedStyle && item.computedStyle[prop])
    || '';
}

function decorationItemsFor(item, baseItem) {
  if (baseItem.type !== 'SHAPE' && baseItem.type !== 'GRAPHIC') return [];
  const decorations = [];
  const leftBorder = asymmetricLeftBorder(item);
  if (leftBorder) {
    decorations.push({
      id: `${item.id}-border-left`,
      role: 'decoration',
      type: 'SHAPE',
      bounds: {
        x: baseItem.bounds.x,
        y: baseItem.bounds.y,
        width: Math.min(leftBorder.widthMm, baseItem.bounds.width),
        height: baseItem.bounds.height,
      },
      zIndex: round((baseItem.zIndex || 0) + 0.02, 2),
      layer: baseItem.layer,
      sourceSelector: baseItem.sourceSelector,
      styleRefs: {},
      objectStyle: null,
      frameStyle: null,
      styleOverride: {
        fillColor: leftBorder.color,
        strokeWeight: 0,
      },
    });
  }
  const objectText = objectTextItemFor(item, baseItem);
  if (objectText) decorations.push(objectText);
  return decorations;
}

function objectTextItemFor(item, baseItem) {
  if (baseItem.type !== 'SHAPE') return null;
  if (!item.content || !item.content.text) return null;
  const padding = paddingMmFor(item.computedStyle || {});
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

function paddingMmFor(style) {
  return {
    top: normalizeVisualMm(cssLengthToMm(style.paddingTop)),
    right: normalizeVisualMm(cssLengthToMm(style.paddingRight)),
    bottom: normalizeVisualMm(cssLengthToMm(style.paddingBottom)),
    left: normalizeVisualMm(cssLengthToMm(style.paddingLeft)),
  };
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

function asymmetricLeftBorder(item) {
  const borders = item.box && item.box.borders;
  if (!borders || !visibleBorder(borders.left)) return null;
  const leftWidthMm = cssLengthToMm(borders.left.widthCss);
  if (!leftWidthMm) return null;
  const horizontalSame = sameBorder(borders.left, borders.top)
    && sameBorder(borders.left, borders.right)
    && sameBorder(borders.left, borders.bottom);
  if (horizontalSame) return null;
  return {
    color: borders.left.color,
    widthMm: normalizeVisualMm(leftWidthMm),
  };
}

function visibleBorder(edge) {
  return edge
    && edge.color
    && edge.style !== 'none'
    && edge.style !== 'hidden'
    && Number(edge.widthPt || 0) > 0;
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
  const source = item.attributes && (item.attributes.src || item.attributes.data);
  return assets.find((asset) => source && asset.src === source)
    || assets.find((asset) => asset.sourceSelector === item.sourceSelector)
    || null;
}

function layerForItem(item) {
  if (item.attributes && item.attributes['data-id-layer']) return item.attributes['data-id-layer'];
  if (item.role === 'text') return 'text';
  if (item.role === 'graphic') return 'graphics';
  if (item.role === 'table') return 'tables';
  return 'content';
}

function collectLayers(pages) {
  const names = new Map();
  for (const name of ['background', 'image', 'drawing', 'graphics', 'content', 'overlay', 'tables', 'text', 'annotation', 'annotations']) {
    names.set(name, names.size);
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
    image: 10,
    drawing: 20,
    graphics: 30,
    content: 40,
    overlay: 50,
    tables: 60,
    text: 70,
    annotation: 80,
    annotations: 80,
  };
  return ranks[name] == null ? 45 : ranks[name];
}

module.exports = {
  compileInstructions,
};
