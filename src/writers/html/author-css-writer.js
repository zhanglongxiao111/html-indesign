const { isDegenerateInvisibleVector } = require('./vector-svg');
const { rendersBakedVectorSvg, vectorContainerIdsForPage } = require('./author-vector-renderer');
const { safeAuthorClassToken } = require('../../shared/style-utils');
const { synthesizedStyleDeclarations } = require('./author-style-residual');
const { VECTOR_SVG_BOX_PAINT_RESET, vectorSvgBoxPaintResetRule } = require('../../shared/vector-svg-box-paint');
const { foldedBordersForPage } = require('./author-border-fold');
const { deckPageBackground } = require('./author-page-background');

function writeAuthorCssFiles(model, options = {}) {
  return {
    'styles/tokens.css': tokensCss(model),
    'styles/layout.css': layoutCss(model),
    'styles/components.css': componentsCss(model),
    'styles/pages.css': pagesCss(model),
    'styles/reverse-overrides.css': reverseOverridesCss(model, options),
  };
}

function tokensCss(model) {
  return [
    ':root {',
    `  --id-page-bg: ${deckPageBackground(model)};`,
    '  --id-text: #14324a;',
    '}',
    '',
  ].join('\n');
}

function layoutCss(model) {
  const first = (model.pages && model.pages[0]) || {};
  return [
    '* { box-sizing: border-box; }',
    'body { margin: 0; background: #f3f5f6; color: var(--id-text); font-family: Arial, "Microsoft YaHei", sans-serif; }',
    '.deck { display: flex; flex-direction: column; gap: 40px; padding: 40px; }',
    `.page { width: ${px(first.width || 0)}; height: ${px(first.height || 0)}; background: var(--id-page-bg); overflow: hidden; position: relative; isolation: isolate; display: grid; grid-template-columns: repeat(var(--id-grid-columns, 12), minmax(0, 1fr)); grid-template-rows: repeat(var(--id-grid-rows, 8), minmax(0, 1fr)); column-gap: var(--id-column-gutter, 0px); row-gap: var(--id-row-gutter, 0px); padding: var(--id-margin-top, 0px) var(--id-margin-right, 0px) var(--id-margin-bottom, 0px) var(--id-margin-left, 0px); }`,
    '.page :where(p, h1, h2, h3, h4, h5, h6, figure, figcaption, ul, ol) { margin: 0; }',
    // InDesign 表格相邻单元格共用描边，对应 CSS 的合并边框模型。
    '.page :where(table) { border-collapse: collapse; }',
    '.grid-item { grid-column: var(--grid-col) / span var(--grid-span, 1); grid-row: var(--grid-row) / span var(--grid-row-span, 1); min-width: 0; min-height: 0; }',
    '.id-object { margin: 0; overflow: hidden; }',
    '.observed-text.id-object { overflow: visible; }',
    '.id-parent-page-object { pointer-events: none; }',
    '',
  ].join('\n');
}

function componentsCss(model) {
  const styles = model.styles || {};
  return [
    styleCollectionCss(styles.paragraphStyles, 'pstyle'),
    styleCollectionCss(styles.characterStyles, 'cstyle'),
    styleCollectionCss(styles.objectStyles, 'ostyle'),
    synthesizedStyleCss(styles.synthesized),
    '',
  ].filter(Boolean).join('\n');
}

function synthesizedStyleCss(styles) {
  return (Array.isArray(styles) ? styles : []).map((style) => {
    if (!style || !style.token) return '';
    const declarations = synthesizedStyleDeclarations(style);
    return [
      `/* ${String(style.displayName || style.token)} */`,
      `.synth-${safeAuthorClassToken(style.token)} { ${declarations} }`,
    ].join('\n');
  }).filter(Boolean).join('\n');
}

function pagesCss(model) {
  return [
    '/* Page-specific reverse styles are emitted here when a page cannot use shared components. */',
    '',
  ].join('\n');
}

function reverseOverridesCss(model, options = {}) {
  const lines = [
    '/* Generated fallback geometry for reverse-exported objects. */',
    '/* Vector svg paints only through its paths; class styles must not add a box frame, fill or inset. */',
    vectorSvgBoxPaintResetRule(),
  ];
  const itemIds = new Set();
  for (const page of model.pages || []) {
    for (const item of page.items || []) itemIds.add(item.id);
  }
  for (const page of model.pages || []) {
    const itemById = new Map((page.items || []).map((item) => [item && item.id, item]));
    const folded = foldedBordersForPage(page);
    const context = {
      itemIds,
      vectorContainerIds: vectorContainerIdsForPage(page, options),
      foldedBorderItemIds: folded.foldedItemIds,
      foldedBordersByContainer: folded.byContainer,
    };
    for (const item of page.items || []) {
      if (shouldOmitAuthorOverride(item, context, options)) continue;
      if (item.layout && item.layout.grid) continue;
      if (!item.bounds) continue;
      const position = authorPosition(item, itemById, context, options);
      const declarations = [
        'position:absolute',
        `left:${px(position.x)}`,
        `top:${px(position.y)}`,
        `width:${px(item.bounds.width)}`,
        `height:${px(item.bounds.height)}`,
      ];
      for (const minDeclaration of vectorMinSizeDeclarations(item)) declarations.push(minDeclaration);
      for (const reset of bakedVectorSourceResetDeclarations(item, context, options)) declarations.push(reset);
      if (isVectorContainerChild(item, context) && !declarations.includes('margin:0')) declarations.push('margin:0');
      lines.push(`[id="${cssString(item.id)}"] { ${declarations.join('; ')}; }`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function authorPosition(item, itemById, context, options) {
  const position = {
    x: Number(item && item.bounds && item.bounds.x) || 0,
    y: Number(item && item.bounds && item.bounds.y) || 0,
  };
  const parentId = item && item.structure && item.structure.parentId;
  const parent = parentId && itemById.get(parentId);
  if (!parent || parent.virtual === true || !parent.bounds || !establishesAuthorPositioning(parent, context, options)) {
    return position;
  }
  // 绝对定位以容器的内边距盒为参照；矢量容器的描边、折回容器的边框对象都写成 CSS border，
  // 要扣掉左、上边宽，子对象才能落回读回 bounds（正向构建累加祖先偏移时同样计入祖先 border）。
  const inset = containerBorderInset(parent, context);
  return {
    x: position.x - (Number(parent.bounds.x) || 0) - inset.left,
    y: position.y - (Number(parent.bounds.y) || 0) - inset.top,
  };
}

function containerBorderInset(parent, context) {
  const folded = context.foldedBordersByContainer && context.foldedBordersByContainer.get(parent.id);
  if (folded) {
    return {
      left: folded.left ? folded.left.width : 0,
      top: folded.top ? folded.top.width : 0,
    };
  }
  const border = context.vectorContainerIds.has(parent.id) ? containerBorderWidth(parent) : 0;
  return { left: border, top: border };
}

// 与 author-style-attrs.visualStyleCss 写出的 border 宽度一致。
function containerBorderWidth(item) {
  const visualStyle = item && item.visualStyle || {};
  const weight = Number(visualStyle.strokeWeight);
  if (!visualStyle.strokeColor || !Number.isFinite(weight) || weight <= 0) return 0;
  return Math.round(weight * 100) / 100;
}

function establishesAuthorPositioning(item, context, options) {
  // 网格对象不是定位参照：它的子对象按页面坐标定位（正向构建只累加绝对定位祖先的偏移）。
  // 非网格矢量容器走兜底绝对定位，下面按「写了兜底几何」成为参照。
  if (!item || !item.bounds || item.layout && item.layout.grid) return false;
  if (!shouldOmitAuthorOverride(item, context, options)) return true;
  const style = item.sourceNode && item.sourceNode.attributes && item.sourceNode.attributes.style || '';
  return /(?:^|;)\s*position\s*:\s*(?:absolute|relative|fixed|sticky)\b/i.test(style);
}

function isVectorContainerChild(item, context) {
  const parentId = item && item.structure && item.structure.parentId;
  return Boolean(parentId && context.vectorContainerIds.has(parentId));
}

function shouldOmitAuthorOverride(item, context, options = {}) {
  if (!item) return true;
  if (isDegenerateInvisibleVector(item)) return true;
  // 有源码节点的对象沿用源码定位；但走已烘焙矢量写出路径（svg 或矢量容器）的对象只能用
  // 读回 bounds 定外框，其源码定位、尺寸和变换已在写出时剥掉（见 author-vector-renderer）。
  // 矢量容器的直接子对象同理：容器不再按源码排版，子对象按读回 bounds 定位。
  if (item.sourceNode && !rendersBakedVectorSvg(item, options) && !isVectorContainerChild(item, context)) return true;
  if (context.foldedBorderItemIds && context.foldedBorderItemIds.has(item.id)) return true;
  if (isGeneratedLabel(item)) return true;
  const itemIds = context.itemIds;
  const id = String(item.id || '');
  if (item.semantic == null && /-background$/i.test(id)) return true;
  if (/-text$/i.test(id) && itemIds.has(id.replace(/-text$/i, ''))) return true;
  return false;
}

function isGeneratedLabel(item) {
  return (item.labels || []).some((label) => label && (label.generated === true || label.kind === 'generated'));
}

// 带 sourceRoot 时源码组件样式会被拷回；源码 class 上的变换、外边距描述的是旋转前的
// 盒子，落在已烘焙的矢量 svg 上同样会二次旋转或挪位，兜底几何里一并归零。源码 class 上的
// 边框、底色、内边距（如 .line 的 border-top）同理只属于旧盒子，描边已在 path 上；
// 矢量容器（#27）的盒子画的正是读回的填充和描边，不归零这几项。
function bakedVectorSourceResetDeclarations(item, context, options) {
  if (!item || !item.sourceNode || !rendersBakedVectorSvg(item, options)) return [];
  const reset = ['margin:0', 'transform:none', 'rotate:none', 'translate:none', 'scale:none'];
  return context.vectorContainerIds.has(item.id) ? reset : [...reset, ...VECTOR_SVG_BOX_PAINT_RESET];
}

function vectorMinSizeDeclarations(item) {
  if (!item || !item.bounds || !item.visualStyle) return [];
  if (!item.vectorGeometry && item.role !== 'line') return [];
  const stroke = Number(item.visualStyle.strokeWeight);
  const markerExtent = hasLineMarker(item.visualStyle) ? 1 : 0;
  const extent = Number.isFinite(stroke) && stroke > 0 ? stroke : markerExtent;
  if (!extent) return [];
  const declarations = [];
  if (Number(item.bounds.width || 0) <= 0) declarations.push(`min-width:${px(extent)}`);
  if (Number(item.bounds.height || 0) <= 0) declarations.push(`min-height:${px(extent)}`);
  return declarations;
}

function hasLineMarker(visualStyle) {
  return Boolean(visualStyle && (visualStyle.lineStartMarker || visualStyle.lineEndMarker));
}

function styleCollectionCss(collection, prefix) {
  return Object.values(collection || {}).filter((style) => style && style.css).map((style) => {
    return `.${prefix}-${safeAuthorClassToken(style.safeName || style.token || style.name)} { ${String(style.css).replace(/pt\b/g, 'px')} }`;
  }).join('\n');
}

function px(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0}px`;
}

function cssString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

module.exports = {
  writeAuthorCssFiles,
};
