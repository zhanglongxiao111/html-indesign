const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { mergeAttributes, attrsToHtml, escapeHtml } = require('./author-attribute-writer');
const { tableContent } = require('./author-table-renderer');
const {
  isUsefulCharacterStyle,
  orderInlineAttrs,
  safeInlineTag,
} = require('./author-render-utils');

function ownContent(item, depth, options = {}) {
  const sourceHtml = !options.ignoreSourceHtml && item.content && typeof item.content.sourceHtml === 'string' && item.content.sourceHtml !== ''
    ? item.content.sourceHtml
    : null;
  if (item.role === 'table' && sourceHtml) return tableSourceHtmlContent(sourceHtml, depth);
  if (sourceHtml) return sourceHtmlContent(sourceHtml, depth);
  if (item.role === 'table' && item.table) return `\n${tableContent(item.table, depth + 2)}\n${' '.repeat(depth)}`;
  if (item.authorTextCompanion && item.authorTextCompanion.content) {
    return plainTextContent(item.authorTextCompanion.content.text || '');
  }
  const rich = richTextContent(item);
  if (rich != null) return rich;
  return plainTextContent((item.content && item.content.text) || '');
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

function richTextContent(item) {
  const content = item.content || {};
  const text = String(content.text == null ? '' : content.text);
  const runs = Array.isArray(content.runs) ? content.runs.filter((run) => run && run.text != null && String(run.text) !== '') : [];
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

function renderInlineRun(run) {
  if (!hasRichRunMarkup(run)) return plainTextContent(run.text);
  const tag = safeInlineTag(run.tagName);
  const attrs = mergeAttributes(run.attributes);
  if (isUsefulCharacterStyle(run.characterStyle) && !attrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE]) {
    attrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE] = run.characterStyle;
  }
  const classes = new Set(run.classList || []);
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  const attrHtml = attrsToHtml(orderInlineAttrs(attrs));
  return `<${tag}${attrHtml ? ` ${attrHtml}` : ''}>${plainTextContent(run.text)}</${tag}>`;
}

function hasRichRunMarkup(run) {
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
