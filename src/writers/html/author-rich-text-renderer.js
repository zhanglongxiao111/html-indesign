const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { mergeAttributes, attrsToHtml, escapeHtml } = require('./author-attribute-writer');
const { patchTableSourceHtmlCells, patchTableSourceHtmlRows, tableContent } = require('./author-table-renderer');
const { patchSourceHtmlStyles, runStyleCss } = require('./author-run-style');
const {
  isUsefulCharacterStyle,
  orderInlineAttrs,
  safeInlineTag,
} = require('./author-render-utils');

// options.writeRunStyles：对象的读回样式写进作者 HTML 时（未保留可信源码样式），
// 字符级外观与段落不同的 run 同样写内联 style（author-run-style）。
function ownContent(item, depth, options = {}) {
  const sourceHtml = !options.ignoreSourceHtml && item.content && typeof item.content.sourceHtml === 'string' && item.content.sourceHtml !== ''
    ? item.content.sourceHtml
    : null;
  const baseTextStyle = options.writeRunStyles ? item.textStyle || null : null;
  if (item.role === 'table' && sourceHtml) {
    const cellStyled = options.writeRunStyles && item.table
      ? patchTableSourceHtmlRows(patchTableSourceHtmlCells(sourceHtml, item.table, item.textStyle || null), item.table)
      : sourceHtml;
    return tableSourceHtmlContent(cellStyled, depth);
  }
  if (sourceHtml) {
    const styled = styledSourceHtml(item, sourceHtml, baseTextStyle);
    if (styled != null) return sourceHtmlContent(styled, depth);
    const rich = richTextContent(item, baseTextStyle);
    return rich != null ? rich : sourceHtmlContent(sourceHtml, depth);
  }
  if (item.role === 'table' && item.table) {
    const tableOptions = { writeRunStyles: options.writeRunStyles, baseTextStyle: item.textStyle || null };
    return `\n${tableContent(item.table, depth + 2, tableOptions)}\n${' '.repeat(depth)}`;
  }
  if (item.authorTextCompanion && item.authorTextCompanion.content) {
    return plainTextContent(item.authorTextCompanion.content.text || '');
  }
  const rich = richTextContent(item, baseTextStyle);
  if (rich != null) return rich;
  return plainTextContent((item.content && item.content.text) || '');
}

// 来源 HTML 片段原样保留，只给外观与段落不同的 run 按 id 合并 style；
// 有 run 定位不到（没有 id、id 不唯一）时返回 null，改由 run 重新渲染。
function styledSourceHtml(item, sourceHtml, baseTextStyle) {
  if (!baseTextStyle) return sourceHtml;
  const runs = Array.isArray(item.content && item.content.runs) ? item.content.runs : [];
  const patches = [];
  for (const run of runs) {
    const css = runStyleCss(run && run.textStyle, baseTextStyle);
    if (!css) continue;
    const id = run.attributes && run.attributes.id;
    if (!id) return null;
    patches.push({ id: String(id), css });
  }
  if (!patches.length) return sourceHtml;
  return patchSourceHtmlStyles(sourceHtml, patches);
}

function sourceHtmlContent(sourceHtml, depth) {
  const text = String(sourceHtml).replace(/\r\n|\r/g, '\n');
  if (!/^\s*\n/.test(text) || !/\n\s*$/.test(text)) return text;
  const lines = text.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (!lines.length) return '';
  const contentLines = lines.filter((line) => line.trim() !== '');
  const commonIndent = contentLines.reduce(
    (min, line) => Math.min(min, /^[ \t]*/.exec(line)[0].length),
    Infinity,
  );
  const contentIndent = ' '.repeat(depth + 2);
  const body = lines.map((line) => (
    line.trim() === '' ? '' : `${contentIndent}${line.slice(commonIndent)}`
  )).join('\n');
  return `\n${body}\n${' '.repeat(depth)}`;
}

function tableSourceHtmlContent(sourceHtml, depth) {
  const contentLines = String(sourceHtml).split(/\r\n|\r|\n/).filter((line) => line.trim() !== '');
  if (!contentLines.length) return '';
  const commonIndent = contentLines.reduce(
    (min, line) => Math.min(min, /^ */.exec(line)[0].length),
    Infinity,
  );
  const body = contentLines.map((line) => `${' '.repeat(depth + 2)}${line.slice(commonIndent)}`).join('\n');
  return `\n${body}\n${' '.repeat(depth)}`;
}

function richTextContent(item, baseTextStyle = null) {
  const content = item.content || {};
  const text = String(content.text == null ? '' : content.text);
  const runs = Array.isArray(content.runs)
    ? content.runs
      .filter((run) => run && run.text != null && String(run.text) !== '')
      .map((run) => withRunStyle(run, baseTextStyle))
    : [];
  if (!text || !runs.some((run) => hasRichRunMarkup(run))) return null;
  let cursor = 0;
  let html = '';
  for (const run of runs) {
    const runText = String(run.text);
    const index = text.indexOf(runText, cursor);
    if (index < cursor) return null;
    html += plainTextContent(text.slice(cursor, index));
    html += renderInlineRun(run);
    cursor = index + runText.length;
  }
  html += plainTextContent(text.slice(cursor));
  return html;
}

// 写出用的临时副本：authorStyle 是这次要写的内联 style（来源 run 上的 style 属性不直接透传）。
function withRunStyle(run, baseTextStyle) {
  const css = runStyleCss(run.textStyle, baseTextStyle);
  return css ? { ...run, authorStyle: css } : run;
}

function renderInlineRun(run) {
  if (!hasRichRunMarkup(run)) return plainTextContent(run.text);
  const tag = safeInlineTag(run.tagName);
  const attrs = mergeAttributes(run.attributes);
  if (isUsefulCharacterStyle(run.characterStyle) && !attrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE]) {
    attrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE] = run.characterStyle;
  }
  const classes = new Set(run.classList || []);
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  if (run.authorStyle) attrs.style = run.authorStyle;
  const attrHtml = attrsToHtml(orderInlineAttrs(attrs));
  return `<${tag}${attrHtml ? ` ${attrHtml}` : ''}>${plainTextContent(run.text)}</${tag}>`;
}

function hasRichRunMarkup(run) {
  if (run.authorStyle) return true;
  if (isUsefulCharacterStyle(run.characterStyle)) return true;
  if ((run.classList || []).length) return true;
  const attrs = mergeAttributes(run.attributes);
  if (Object.keys(attrs).some((name) => name !== 'id')) return true;
  const tag = safeInlineTag(run.tagName);
  return tag !== 'span';
}

function plainTextContent(value) {
  return escapeHtml(value)
    .replace(/\u00a0/g, '&nbsp;')
    .replace(/(\r\n|\r|\n)( +)/g, (match, lineBreak, spaces) => `\n${'&nbsp;'.repeat(spaces.length)}`)
    .replace(/\r\n|\r|\n/g, '<br>');
}

module.exports = {
  ownContent,
  sourceHtmlContent,
  richTextContent,
  renderInlineRun,
  hasRichRunMarkup,
  plainTextContent,
};
