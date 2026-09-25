// 字符级外观：读回的 run 外观（content.runs[].textStyle）与所在段落（item.textStyle）不同的部分
// 写成 run 元素上的内联 style。没有源码 CSS 可拷时（observation 模式），来源 class（如 .accent）
// 不带任何样式，不写这一步红字、加粗等字符样式就会丢（#34）。
const { capitalizationCss, textStrokeCss } = require('./css-values');

function runStyleCss(runTextStyle, baseTextStyle) {
  if (!runTextStyle || !baseTextStyle) return '';
  const styles = [];
  if (runTextStyle.fontFamily && runTextStyle.fontFamily !== baseTextStyle.fontFamily) {
    styles.push(`font-family:"${runTextStyle.fontFamily}", Arial, sans-serif`);
  }
  if (fontWeight(runTextStyle.fontWeight) !== fontWeight(baseTextStyle.fontWeight)) {
    styles.push(`font-weight:${fontWeight(runTextStyle.fontWeight)}`);
  }
  if (fontStyle(runTextStyle.fontStyle) !== fontStyle(baseTextStyle.fontStyle)) {
    styles.push(`font-style:${fontStyle(runTextStyle.fontStyle)}`);
  }
  if (numberDiffers(runTextStyle.pointSize, baseTextStyle.pointSize)) styles.push(`font-size:${formatNumber(runTextStyle.pointSize)}px`);
  if (runTextStyle.fillColor && color(runTextStyle.fillColor) !== color(baseTextStyle.fillColor)) {
    styles.push(`color:${runTextStyle.fillColor}`);
  }
  if (Number(runTextStyle.tracking || 0) !== Number(baseTextStyle.tracking || 0)) {
    styles.push(`letter-spacing:${formatNumber(Number(runTextStyle.tracking || 0) / 1000)}em`);
  }
  const runCaps = capitalizationCss(runTextStyle.capitalization);
  const baseCaps = capitalizationCss(baseTextStyle.capitalization);
  if (runCaps !== baseCaps) styles.push(runCaps || resetCapitalizationCss(baseCaps));
  const runStroke = textStrokeCss(runTextStyle);
  const baseStroke = textStrokeCss(baseTextStyle);
  if (runStroke !== baseStroke) styles.push(runStroke || '-webkit-text-stroke:0 transparent');
  return styles.join(';');
}

// run 恢复正常大小写时，抵消段落上的大小写声明。
function resetCapitalizationCss(baseCaps) {
  return baseCaps.startsWith('text-transform') ? 'text-transform:none' : 'font-variant-caps:normal';
}

function fontWeight(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (!text || text === 'normal') return '400';
  if (text === 'bold') return '700';
  return text;
}

function fontStyle(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return text || 'normal';
}

function color(value) {
  return String(value || '').trim().toLowerCase();
}

function numberDiffers(value, base) {
  if (value == null || !Number.isFinite(Number(value))) return false;
  if (base == null || !Number.isFinite(Number(base))) return true;
  return Math.abs(Number(value) - Number(base)) > 0.01;
}

// 在来源 HTML 片段里给 id 对应的开始标签合并 style。找不到或 id 不唯一时返回 null，由调用方改走 run 渲染。
function patchSourceHtmlStyles(sourceHtml, patches) {
  let html = String(sourceHtml);
  for (const { id, css } of patches) {
    const pattern = new RegExp(`<[a-zA-Z][\\w-]*\\b[^<>]*\\sid\\s*=\\s*"${escapeRegExp(escapeAttr(id))}"[^<>]*>`, 'g');
    const matches = html.match(pattern) || [];
    if (matches.length !== 1) return null;
    const tag = matches[0];
    html = html.replace(tag, () => tagWithMergedStyle(tag, css));
  }
  return html;
}

function tagWithMergedStyle(tag, css) {
  const styleAttr = /\sstyle\s*=\s*"([^"]*)"/i.exec(tag);
  if (styleAttr) {
    const merged = mergeDeclarations(decodeAttr(styleAttr[1]), css);
    return tag.replace(styleAttr[0], ` style="${escapeAttr(merged)}"`);
  }
  const closing = /\s*\/?>$/.exec(tag)[0];
  return `${tag.slice(0, tag.length - closing.length)} style="${escapeAttr(css)}"${closing}`;
}

function mergeDeclarations(existing, css) {
  const order = [];
  const values = new Map();
  for (const declaration of `${existing};${css}`.split(';')) {
    const index = declaration.indexOf(':');
    if (index <= 0) continue;
    const property = declaration.slice(0, index).trim();
    const value = declaration.slice(index + 1).trim();
    if (!property || !value) continue;
    if (!values.has(property)) order.push(property);
    values.set(property, value);
  }
  return order.map((property) => `${property}:${values.get(property)}`).join(';');
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function decodeAttr(value) {
  return String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
}

module.exports = {
  mergeDeclarations,
  patchSourceHtmlStyles,
  runStyleCss,
  tagWithMergedStyle,
};
