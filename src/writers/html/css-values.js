const { roundTypeSize } = require('../../shared/geometry');
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

// 段落对齐（textStyle.justification）-> CSS。与正向 style-synthesis justificationFor 互逆：
// justify 是 InDesign「左对齐两端」（末行靠起始边，CSS 默认）；justify-all / justify-center / justify-right
// 只在末行不同，写成 text-align:justify 加 text-align-last。
function justificationCss(justification) {
  const value = String(justification || '').trim();
  if (!value) return '';
  const last = { 'justify-all': 'justify', 'justify-center': 'center', 'justify-right': 'right' }[value];
  return last ? `text-align:justify;text-align-last:${last}` : `text-align:${value}`;
}

// 文字描边（textStyle.strokeColor / strokeWeight，InDesign 字符描边）-> CSS -webkit-text-stroke（描边居中于字形轮廓）。
// 正向从 -webkit-text-stroke-width / -color 读回成段落、字符样式或局部覆盖的描边。
function textStrokeCss(textStyle) {
  const weight = Number(textStyle && textStyle.strokeWeight);
  if (!textStyle || !textStyle.strokeColor || !Number.isFinite(weight) || weight <= 0) return '';
  return `-webkit-text-stroke:${formatNumber(weight)}px ${textStyle.strokeColor}`;
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

// 字号、行距统一按 TYPE_SIZE_DIGITS 写（正向读回同一精度），1/3 px 一类的字号（11.3333）不丢位。
// 旧版本按页面比例漂出来的万分位抖动（45.0001、72.0002）离三位小数不到 0.00025，收回到三位小数；
// k/3、k/6 这类字号离三位小数 0.0003，不受影响。
const TYPE_SIZE_JITTER = 0.00025;

function typeSizePx(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0px';
  const precise = roundTypeSize(number);
  const snapped = Math.round(number * 1000) / 1000;
  return `${Math.abs(precise - snapped) <= TYPE_SIZE_JITTER ? snapped : precise}px`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
}

module.exports = {
  typeSizePx,
  capitalizationCss,
  colorWithOpacity,
  cssBorderStyle,
  justificationCss,
  textStrokeCss,
};
