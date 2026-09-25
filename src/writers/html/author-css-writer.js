const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { rendersBakedVectorSvg } = require('./author-vector-renderer');
const { reverseBoxHeight, reverseGeometryPlanForPage } = require('./author-reverse-geometry');
const { isIndesignBuiltinStyleName, safeAuthorClassToken } = require('../../shared/style-utils');
const { synthesizedStyleDeclarations } = require('./author-style-residual');
const { VECTOR_SVG_BOX_PAINT_RESET, vectorSvgBoxPaintResetRule } = require('../../shared/vector-svg-box-paint');
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
    // 置入图的内容图按图框内偏移绝对定位，留在网格里的图框要成为它的定位参照（只含内容图、不含子对象）。
    '.grid-item:has(> .placed-asset-content, > .placed-asset-preview) { position: relative; }',
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
    // 置入图框写成 figure；带 sourceRoot 时 layout.css 换成源码包的，源码包没用过 figure 就不会清
    // 浏览器默认外边距（16px 40px），图框整体错位。零特异度，源码 CSS 仍可覆盖（#32）。
    '/* Reverse-written placed-asset frames are figures; neutralize the UA figure margin even when source CSS replaced layout.css. */',
    '.page :where(figure) { margin: 0; }',
    // 表格所在文本框比表格高时写成 data-id-ignore 包裹层（author-html-tree），外框在包裹层上，表格占满框宽、高度随行。
    '/* A table whose text frame is taller than its rows sits in an ignored frame wrapper that carries the read-back bounds. */',
    `.page [${HTML_DATA_ID_ATTRIBUTES.IGNORE}] > table { width: 100%; }`,
  ];
  for (const page of model.pages || []) {
    const itemById = new Map((page.items || []).map((item) => [item && item.id, item]));
    const plan = reverseGeometryPlanForPage(page, options);
    for (const item of page.items || []) {
      const box = item && plan.boxes.get(item.id);
      if (!box) continue;
      if (box.keepsGrid) {
        // 留在网格里：左、上、宽由网格给出，高度按读回 bounds 钉住，不再被网格行拉高。
        lines.push(`[id="${cssString(item.id)}"] { align-self:start; height:${px(reverseBoxHeight(item, options.unitMode))}; }`);
        continue;
      }
      const position = authorPosition(item, itemById, plan);
      const declarations = [
        'position:absolute',
        `left:${px(position.x)}`,
        `top:${px(position.y)}`,
        `width:${px(item.bounds.width)}`,
        `height:${px(reverseBoxHeight(item, options.unitMode))}`,
      ];
      for (const minDeclaration of vectorMinSizeDeclarations(item)) declarations.push(minDeclaration);
      for (const reset of bakedVectorSourceResetDeclarations(item, plan, options)) declarations.push(reset);
      if (!declarations.includes('margin:0')) declarations.push('margin:0');
      lines.push(`[id="${cssString(item.id)}"] { ${declarations.join('; ')}; }`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function authorPosition(item, itemById, context) {
  const position = {
    x: Number(item && item.bounds && item.bounds.x) || 0,
    y: Number(item && item.bounds && item.bounds.y) || 0,
  };
  const parentId = item && item.structure && item.structure.parentId;
  const parent = parentId && itemById.get(parentId);
  if (!parent || parent.virtual === true || !parent.bounds || !establishesAuthorPositioning(parent, context)) {
    return position;
  }
  // 绝对定位以容器的内边距盒为参照；矢量容器的描边、折回容器的边框对象都写成 CSS border，
  // 要扣掉左、上边宽，子对象才能落回读回 bounds。
  const inset = containerBorderInset(parent, context);
  return {
    x: position.x - (Number(parent.bounds.x) || 0) - inset.left,
    y: position.y - (Number(parent.bounds.y) || 0) - inset.top,
  };
}

// 折回的边框对象按各边宽写成 border（author-border-fold），其余矢量容器按读回描边写等宽 border。
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

// 子对象的定位参照：写了兜底绝对几何的对象，以及源码内联声明了定位的对象。
// 网格对象（含留在网格里、只钉住高度的对象）不是定位参照：它的子对象按页面坐标定位
// （正向构建对观察态对象只累加绝对定位祖先的 left/top，见 semantic-model/layout.observedAncestorOffset）。
function establishesAuthorPositioning(item, context) {
  if (!item || !item.bounds) return false;
  const box = context.boxes.get(item.id);
  if (box) return !box.keepsGrid;
  if (item.layout && item.layout.grid) return false;
  const style = item.sourceNode && item.sourceNode.attributes && item.sourceNode.attributes.style || '';
  return /(?:^|;)\s*position\s*:\s*(?:absolute|relative|fixed|sticky)\b/i.test(style);
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

// InDesign 内置样式（[基本段落]、[无段落样式]、[基本图形框架] 等）不写样式类规则：作者 HTML 不会引用它们
// （内置名不生成样式类，见 author-style-attrs），规则只会是无人使用的死代码。
function styleCollectionCss(collection, prefix) {
  return Object.values(collection || {}).filter((style) => style && style.css && !isIndesignBuiltinStyleName(style.name)).map((style) => {
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
