const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { isDegenerateInvisibleVector } = require('./vector-svg');
const { rendersBakedVectorSvg, vectorContainerIdsForPage } = require('./author-vector-renderer');
const { tableBoxHeight } = require('./table-html');
const { cssLengthStringToPx } = require('../../shared/geometry');
const { foldedBordersForPage } = require('./author-border-fold');

// 反向作者包的外框规划：每个对象的外框落在哪里，由这里统一决定，
// reverse-overrides.css（author-css-writer）与页面 HTML（author-node-attrs / author-vector-renderer）共用同一份结果。
//
// 观察态对象的外框以 InDesign 读回 bounds 为准：
// - 作者包带着源码样式（sourceRoot 且源码 CSS 已拷回）时，有源码节点的对象沿用源码定位；
// - 否则源码 class 上的定位、尺寸都不在包里（例如满版图、页码靠 class 绝对定位），
//   一律按读回 bounds 写兜底几何，否则这些对象会掉进页面网格的自动排布。
// - 网格对象：网格区域与读回 bounds 的左、上、宽一致时保留网格放置（Agent 改 --grid-* 就能挪动），
//   只是高度不同（文字框、表格按内容高）时写 align-self:start 并钉住读回高度；
//   左、上、宽对不上时，对象退出网格，按读回 bounds 绝对定位——不改写网格变量，
//   因为把对象硬凑到另一组格子上同样对不上读回 bounds。
const GRID_FIT_TOLERANCE_PX = 0.5;


// 返回 { boxes, vectorContainerIds, foldedBordersByContainer }：boxes 按对象 id 记外框写法——
// { keepsGrid: true } 留在网格、钉住读回高度；{ keepsGrid: false, exitsGrid } 按读回 bounds 绝对定位。
// 不在 boxes 里的对象不写兜底几何。折回容器 CSS border 的边框对象（author-border-fold）不写外框，
// 容器按各边宽扣子对象偏移（author-css-writer.authorPosition）。
function reverseGeometryPlanForPage(page, options = {}) {
  const items = (page && page.items || []).filter(Boolean);
  const vectorContainerIds = options.vectorContainerIds || vectorContainerIdsForPage(page, options);
  const folded = foldedBordersForPage(page);
  const context = {
    itemIds: new Set(items.map((item) => item.id)),
    vectorContainerIds,
    foldedBorderItemIds: folded.foldedItemIds,
    sourceLayoutCarried: options.sourceLayoutCarried === true,
  };
  const grid = authorPageGridGeometry(page);
  const boxes = new Map();
  for (const item of items) {
    if (item.virtual || !item.bounds) continue;
    if (shouldOmitReverseBox(item, context, options)) continue;
    const box = reverseBoxForItem(item, grid, options.unitMode);
    if (box) boxes.set(item.id, box);
  }
  return { boxes, vectorContainerIds, foldedBordersByContainer: folded.byContainer };
}

function reverseBoxForItem(item, grid, unitMode) {
  const placement = gridPlacementForItem(item);
  if (!placement) return { keepsGrid: false, exitsGrid: false };
  const area = gridArea(grid, placement);
  // 页面网格读不出来（缺网格声明或长度单位不认识）时无从核对，保留作者网格放置。
  if (!area) return null;
  const bounds = item.bounds;
  const fits = (a, b) => Math.abs(Number(a) - Number(b)) <= GRID_FIT_TOLERANCE_PX;
  if (!fits(bounds.x, area.x) || !fits(bounds.y, area.y) || !fits(bounds.width, area.width)) {
    return { keepsGrid: false, exitsGrid: true };
  }
  if (fits(reverseBoxHeight(item, unitMode), area.height)) return null;
  return { keepsGrid: true, exitsGrid: false };
}

// 读回对象的网格放置：通常在对象自己的源码节点上；源码把对象包在同 id 的网格包裹层里时
// （如 PDF 图框 div.drawing-frame.grid-item > object），读回的就是包裹层，网格放置取包裹层上的 --grid-*。
function gridPlacementForItem(item) {
  if (item.layout && item.layout.grid) return item.layout.grid;
  const wrapper = (item.sourceAncestorNodes || []).find((node) => node
    && node.id
    && String(node.id) === String(item.id)
    && (node.classList || []).includes('grid-item'));
  if (!wrapper) return null;
  const vars = cssCustomProperties(wrapper.attributes && wrapper.attributes.style);
  if (!vars.has('--grid-col') || !vars.has('--grid-row')) return null;
  return {
    col: Number(vars.get('--grid-col')),
    span: vars.has('--grid-span') ? Number(vars.get('--grid-span')) : 1,
    row: Number(vars.get('--grid-row')),
    rowSpan: vars.has('--grid-row-span') ? Number(vars.get('--grid-row-span')) : 1,
  };
}

function cssCustomProperties(style) {
  const vars = new Map();
  for (const declaration of String(style || '').split(';')) {
    const index = declaration.indexOf(':');
    if (index <= 0) continue;
    const name = declaration.slice(0, index).trim();
    if (name.startsWith('--')) vars.set(name, declaration.slice(index + 1).trim());
  }
  return vars;
}

// 作者 HTML 里对象盒子的高度：一般就是读回高度；表格见 table-html.tableBoxHeight。
function reverseBoxHeight(item, unitMode) {
  if (item && item.role === 'table') return tableBoxHeight(item, unitMode);
  return Number(item && item.bounds && item.bounds.height) || 0;
}

function shouldOmitReverseBox(item, context, options = {}) {
  if (isDegenerateInvisibleVector(item)) return true;
  // 源码样式随包时，有源码节点的对象沿用源码定位；但走已烘焙矢量写出路径（svg 或矢量容器）的对象
  // 只能用读回 bounds 定外框，其源码定位、尺寸和变换已在写出时剥掉（见 author-vector-renderer）。
  // 矢量容器的直接子对象同理：容器不再按源码排版，子对象按读回 bounds 定位。
  if (item.sourceNode
    && context.sourceLayoutCarried
    && !rendersBakedVectorSvg(item, options)
    && !isVectorContainerChild(item, context)) return true;
  if (context.foldedBorderItemIds.has(item.id)) return true;
  if (isGeneratedLabel(item)) return true;
  const id = String(item.id || '');
  if (item.semantic == null && /-background$/i.test(id)) return true;
  if (/-text$/i.test(id) && context.itemIds.has(id.replace(/-text$/i, ''))) return true;
  return false;
}

function isVectorContainerChild(item, context) {
  const parentId = item && item.structure && item.structure.parentId;
  return Boolean(parentId && context.vectorContainerIds.has(parentId));
}

function isGeneratedLabel(item) {
  return (item.labels || []).some((label) => label && (label.generated === true || label.kind === 'generated'));
}

// 作者页 <section> 上的网格与版心变量：页面源码属性里的原始长度（如 6mm）优先，否则用模型数值（px）。
function authorPageStyleVarPairs(page) {
  const pairs = [];
  const attrs = (page && page.sourceNode && page.sourceNode.attributes) || {};
  if (page && page.grid) {
    pairs.push(['--id-grid-columns', page.grid.columns]);
    pairs.push(['--id-grid-rows', page.grid.rows]);
    if (page.grid.columnGutter != null || attrs[HTML_DATA_ID_ATTRIBUTES.COLUMN_GUTTER]) {
      pairs.push(['--id-column-gutter', attrs[HTML_DATA_ID_ATTRIBUTES.COLUMN_GUTTER] || `${page.grid.columnGutter}px`]);
    }
    if (page.grid.rowGutter != null || attrs[HTML_DATA_ID_ATTRIBUTES.ROW_GUTTER]) {
      pairs.push(['--id-row-gutter', attrs[HTML_DATA_ID_ATTRIBUTES.ROW_GUTTER] || `${page.grid.rowGutter}px`]);
    }
    if (page.grid.baseline != null || attrs[HTML_DATA_ID_ATTRIBUTES.BASELINE]) {
      pairs.push(['--id-baseline', attrs[HTML_DATA_ID_ATTRIBUTES.BASELINE] || `${page.grid.baseline}px`]);
    }
  }
  const marginTokens = marginTokensFor(attrs[HTML_DATA_ID_ATTRIBUTES.MARGIN]);
  if (marginTokens) {
    pairs.push(['--id-margin-top', marginTokens.top]);
    pairs.push(['--id-margin-right', marginTokens.right]);
    pairs.push(['--id-margin-bottom', marginTokens.bottom]);
    pairs.push(['--id-margin-left', marginTokens.left]);
  } else if (page && page.margins) {
    pairs.push(['--id-margin-top', `${page.margins.top}px`]);
    pairs.push(['--id-margin-right', `${page.margins.right}px`]);
    pairs.push(['--id-margin-bottom', `${page.margins.bottom}px`]);
    pairs.push(['--id-margin-left', `${page.margins.left}px`]);
  }
  return pairs;
}

function marginTokensFor(value) {
  const tokens = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  if (tokens.length === 1) {
    return { top: tokens[0], right: tokens[0], bottom: tokens[0], left: tokens[0] };
  }
  if (tokens.length === 2) {
    return { top: tokens[0], right: tokens[1], bottom: tokens[0], left: tokens[1] };
  }
  if (tokens.length === 3) {
    return { top: tokens[0], right: tokens[1], bottom: tokens[2], left: tokens[1] };
  }
  return { top: tokens[0], right: tokens[1], bottom: tokens[2], left: tokens[3] };
}

// 与 author-css-writer 的 .page 规则同构：border-box 页面、内边距为版心、
// repeat(N, minmax(0, 1fr)) 等分轨道、gap 为栏间距/行间距。
function authorPageGridGeometry(page) {
  if (!page || !page.grid) return null;
  const vars = new Map(authorPageStyleVarPairs(page));
  const columns = Number(vars.get('--id-grid-columns'));
  const rows = Number(vars.get('--id-grid-rows'));
  const width = Number(page.width);
  const height = Number(page.height);
  if (![columns, rows, width, height].every((value) => Number.isFinite(value) && value > 0)) return null;
  const lengths = {};
  for (const [key, name] of [
    ['columnGap', '--id-column-gutter'],
    ['rowGap', '--id-row-gutter'],
    ['top', '--id-margin-top'],
    ['right', '--id-margin-right'],
    ['bottom', '--id-margin-bottom'],
    ['left', '--id-margin-left'],
  ]) {
    const value = vars.has(name) ? cssLengthStringToPx(vars.get(name)) : 0;
    if (value == null) return null;
    lengths[key] = value;
  }
  const columnWidth = (width - lengths.left - lengths.right - lengths.columnGap * (columns - 1)) / columns;
  const rowHeight = (height - lengths.top - lengths.bottom - lengths.rowGap * (rows - 1)) / rows;
  if (!(columnWidth > 0) || !(rowHeight > 0)) return null;
  return { ...lengths, columns, rows, columnWidth, rowHeight };
}

function gridArea(grid, placement) {
  if (!grid || !placement) return null;
  const col = Number(placement.col);
  const row = Number(placement.row);
  const span = Number(placement.span == null ? 1 : placement.span);
  const rowSpan = Number(placement.rowSpan == null ? 1 : placement.rowSpan);
  if (![col, row, span, rowSpan].every((value) => Number.isInteger(value) && value >= 1)) return null;
  return {
    x: grid.left + (col - 1) * (grid.columnWidth + grid.columnGap),
    y: grid.top + (row - 1) * (grid.rowHeight + grid.rowGap),
    width: span * grid.columnWidth + (span - 1) * grid.columnGap,
    height: rowSpan * grid.rowHeight + (rowSpan - 1) * grid.rowGap,
  };
}

module.exports = {
  authorPageGridGeometry,
  authorPageStyleVarPairs,
  gridArea,
  reverseBoxHeight,
  reverseGeometryPlanForPage,
};
