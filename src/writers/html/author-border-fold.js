// 正向构建把容器的非等宽 CSS border 拆成独立的边框对象（instruction-writer 的
// borderDecorationItemsFor：`<容器 id>-border-<side>`，填充色 = 该边颜色，
// 厚度 = 该边宽度，贴着容器外框内侧）。反向写作者 HTML 时按同一规则反推：
// 边框对象折回容器对应边的 CSS border，再次正向构建会重新生成同样的边框对象。
// 对不上这条规则的边框对象（容器缺失、几何不贴边、带描边或半透明等）不折回，按普通对象写出。
const { ITEM_ROLE } = require('../../protocol');

const BORDER_SIDES = Object.freeze(['top', 'right', 'bottom', 'left']);
const BORDER_ITEM_ID_RE = /^(.*)-border-(top|right|bottom|left)$/i;
const EDGE_TOLERANCE = 0.5;

// 返回 { byContainer: Map<容器 id, { top?: edge, right?: edge, ... }>, foldedItemIds: Set<边框对象 id> }。
function foldedBordersForPage(page) {
  const items = Array.isArray(page && page.items) ? page.items : [];
  const itemById = new Map(items.filter(Boolean).map((item) => [item.id, item]));
  const byContainer = new Map();
  const foldedItemIds = new Set();
  for (const item of items) {
    const match = BORDER_ITEM_ID_RE.exec(String(item && item.id || ''));
    if (!match) continue;
    const container = itemById.get(match[1]);
    const side = match[2].toLowerCase();
    const edge = foldableBorderEdge(item, container, side);
    if (!edge) continue;
    const sides = byContainer.get(container.id) || {};
    if (sides[side]) continue;
    sides[side] = edge;
    byContainer.set(container.id, sides);
    foldedItemIds.add(item.id);
  }
  return { byContainer, foldedItemIds };
}

function foldableBorderEdge(item, container, side) {
  if (!item || !container || container.virtual || !item.bounds || !container.bounds) return null;
  if (item.role && item.role !== ITEM_ROLE.DECORATION && item.role !== ITEM_ROLE.SHAPE) return null;
  if (hasOwnStroke(container)) return null;
  const content = item.content || {};
  if (String(content.text || '').trim()) return null;
  if (item.asset || item.table) return null;
  const style = item.visualStyle || {};
  if (!style.fillColor || hasOwnStroke(item)) return null;
  if (!fullyOpaque(style.opacity) || !fullyOpaque(style.fillOpacity)) return null;
  const width = borderThickness(item.bounds, container.bounds, side);
  if (!(width > 0)) return null;
  return { width: round(width), color: style.fillColor };
}

function hasOwnStroke(item) {
  const style = item && item.visualStyle || {};
  return Boolean(style.strokeColor) && Number(style.strokeWeight) > 0;
}

function fullyOpaque(value) {
  return value == null || !Number.isFinite(Number(value)) || Number(value) >= 100;
}

// 与 borderDecorationBounds 相反：边框条沿容器一条边铺满、贴在容器内侧，厚度不超过容器。
function borderThickness(bounds, box, side) {
  const x = Number(bounds.x);
  const y = Number(bounds.y);
  const w = Number(bounds.width);
  const h = Number(bounds.height);
  const bx = Number(box.x);
  const by = Number(box.y);
  const bw = Number(box.width);
  const bh = Number(box.height);
  if (![x, y, w, h, bx, by, bw, bh].every(Number.isFinite)) return 0;
  const near = (a, b) => Math.abs(a - b) <= EDGE_TOLERANCE;
  if (side === 'top' || side === 'bottom') {
    if (!near(x, bx) || !near(w, bw) || h > bh + EDGE_TOLERANCE) return 0;
    const flush = side === 'top' ? near(y, by) : near(y + h, by + bh);
    return flush ? h : 0;
  }
  if (!near(y, by) || !near(h, bh) || w > bw + EDGE_TOLERANCE) return 0;
  const flush = side === 'left' ? near(x, bx) : near(x + w, bx + bw);
  return flush ? w : 0;
}

// 折回后的容器 border：没有边框对象的边写 0，保证四边非等宽时正向构建走边框对象路径。
function foldedBorderCss(sides) {
  if (!sides) return '';
  return BORDER_SIDES.map((side) => {
    const edge = sides[side];
    return edge
      ? `border-${side}:${formatNumber(edge.width)}px solid ${edge.color}`
      : `border-${side}:0 solid transparent`;
  }).join(';');
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
}

module.exports = {
  BORDER_ITEM_ID_RE,
  foldedBordersForPage,
  foldedBorderCss,
};
