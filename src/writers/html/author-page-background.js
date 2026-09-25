// 页面底色（pages[].visualStyle）写回作者 HTML：多数页面共用的底色进 tokens.css 的 --id-page-bg，
// 与之不同的页面在 section 上覆盖 --id-page-bg。layout.css 的 .page 用 var(--id-page-bg) 画底色，
// 正向构建读 section 的 background-color 重建背景母版。
const { colorWithOpacity } = require('./css-values');

const DEFAULT_PAGE_BACKGROUND = '#ffffff';

function pageBackgroundColor(page) {
  const visualStyle = page && page.visualStyle;
  if (!visualStyle || !visualStyle.fillColor) return DEFAULT_PAGE_BACKGROUND;
  return colorWithOpacity(visualStyle.fillColor, visualStyle.fillOpacity);
}

// 出现次数最多的页面底色；并列时取先出现的，保证输出稳定。
function deckPageBackground(model) {
  const counts = new Map();
  for (const page of model && model.pages || []) {
    const color = pageBackgroundColor(page);
    counts.set(color, (counts.get(color) || 0) + 1);
  }
  let best = DEFAULT_PAGE_BACKGROUND;
  let bestCount = 0;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}

function pageBackgroundOverride(page, deckBackground) {
  const color = pageBackgroundColor(page);
  return color === (deckBackground || DEFAULT_PAGE_BACKGROUND) ? null : color;
}

module.exports = {
  deckPageBackground,
  pageBackgroundOverride,
};
