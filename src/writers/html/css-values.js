// 作者 HTML 的填充、描边写法：读回的不透明度和描边类型要落进 CSS，
// 否则浏览器和再次正向构建都会退回实色实线（#34）。
function colorWithOpacity(color, opacityPercent) {
  const opacity = Number(opacityPercent);
  if (!color || opacityPercent == null || !Number.isFinite(opacity) || opacity >= 100 || opacity < 0) return color;
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${formatNumber(opacity / 100)})`;
}

// InDesign 描边类型名（中文界面「实底」「虚线」「点线」、英文 Solid/Dashed/Dotted 及 $ID/ 内部名）转 CSS border-style。
// 其余类型（双线、粗-细等）CSS border 画不出，按实线写，类型名仍由 data-id-stroke-style 保留。
function cssBorderStyle(strokeStyle) {
  const text = String(strokeStyle == null ? '' : strokeStyle).trim();
  if (/dot|点/i.test(text)) return 'dotted';
  if (/dash|虚/i.test(text)) return 'dashed';
  return 'solid';
}

// InDesign 大小写（textStyle.capitalization）：allCaps 与正向 capitalizationFor 的 text-transform:uppercase 互逆；
// smallCaps 只保证浏览器显示，正向构建暂不从 font-variant-caps 读回。
function capitalizationCss(capitalization) {
  const value = String(capitalization || '').trim().toLowerCase();
  if (value === 'allcaps') return 'text-transform:uppercase';
  if (value === 'smallcaps') return 'font-variant-caps:small-caps';
  return '';
}

function hexToRgb(value) {
  const match = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const full = match[1].length === 3 ? match[1].split('').map((char) => `${char}${char}`).join('') : match[1];
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
}

module.exports = {
  capitalizationCss,
  colorWithOpacity,
  cssBorderStyle,
};
