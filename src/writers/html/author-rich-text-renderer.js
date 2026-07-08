const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { mergeAttributes, attrsToHtml, escapeHtml } = require('./author-attribute-writer');
const { tableContent } = require('./author-table-renderer');
const {
  isUsefulCharacterStyle,
  orderInlineAttrs,
  safeInlineTag,
} = require('./author-render-utils');

function ownContent(item, depth) {
  if (item.role === 'table' && item.table) return `\n${tableContent(item.table, depth + 2)}\n${' '.repeat(depth)}`;
  if (item.authorTextCompanion && item.authorTextCompanion.content) {
    return plainTextContent(item.authorTextCompanion.content.text || '');
  }
  if (item.content && typeof item.content.sourceHtml === 'string' && item.content.sourceHtml !== '') {
    return item.content.sourceHtml;
  }
  const rich = richTextContent(item);
  if (rich != null) return rich;
  return escapeHtml((item.content && item.content.text) || '').replace(/\r\n|\r|\n/g, '<br>');
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
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
}

module.exports = {
  ownContent,
  richTextContent,
  renderInlineRun,
  hasRichRunMarkup,
  plainTextContent,
};
