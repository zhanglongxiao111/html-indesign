const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { mergeAttributes, attrsToHtml, escapeHtml } = require('./author-attribute-writer');
const {
  indent,
  isUsefulCharacterStyle,
  orderAttrs,
  orderInlineAttrs,
  safeInlineTag,
} = require('./author-render-utils');

function tableContent(table, depth) {
  const rows = table.rows || [];
  const headRows = rows.filter((row) => row.header || (row.cells || []).some((cell) => cell.header));
  const bodyRows = rows.filter((row) => !headRows.includes(row));
  const sections = [];
  if (headRows.length) sections.push(tableSection('thead', headRows, depth));
  if (bodyRows.length) sections.push(tableSection('tbody', bodyRows, depth));
  return sections.join('\n');
}

function tableSection(tag, rows, depth) {
  const rowHtml = rows.map((row) => tableRow(row, depth + 2)).join('\n');
  return `${indent(depth)}<${tag}>\n${rowHtml}\n${indent(depth)}</${tag}>`;
}

function tableRow(row, depth) {
  const cells = (row.cells || []).map((cell) => tableCell(cell, depth + 2)).join('\n');
  return `${indent(depth)}<tr>\n${cells}\n${indent(depth)}</tr>`;
}

function tableCell(cell, depth) {
  const tag = cell.header ? 'th' : 'td';
  const attrs = {};
  if (cell.paragraphStyle) attrs[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE] = cell.paragraphStyle;
  const rowSpan = tableCellSpan(cell.rowSpan, 'rowSpan');
  const colSpan = tableCellSpan(cell.colSpan, 'colSpan');
  if (rowSpan) attrs.rowspan = rowSpan;
  if (colSpan) attrs.colspan = colSpan;
  const attrHtml = attrsToHtml(orderAttrs(attrs));
  return `${indent(depth)}<${tag}${attrHtml ? ` ${attrHtml}` : ''}>${tableCellContent(cell)}</${tag}>`;
}

function tableCellSpan(value, fieldName) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid table cell ${fieldName}: expected positive integer, received "${value}".`);
  }
  return number > 1 ? String(number) : null;
}

function tableCellContent(cell) {
  const rich = richTableCellContent(cell);
  if (rich != null) return rich;
  return plainTextContent(cell.text || '');
}

function richTableCellContent(cell) {
  const text = String(cell.text == null ? '' : cell.text);
  const runs = tableCellRuns(cell);
  if (!runs.length || !runs.some((run) => hasRichRunMarkup(run))) return null;
  if (!text) return runs.map((run) => renderInlineRun(run)).join('');
  let cursor = 0;
  let html = '';
  for (const run of runs) {
    const runText = String(run.text);
    const index = text.indexOf(runText, cursor);
    if (index < cursor) {
      throw new Error(`Cannot render table cell runs: run text "${runText}" was not found in cell text.`);
    }
    html += plainTextContent(text.slice(cursor, index));
    html += renderInlineRun(run);
    cursor = index + runText.length;
  }
  html += plainTextContent(text.slice(cursor));
  return html;
}

function tableCellRuns(cell) {
  if (cell.runs == null) return [];
  if (!Array.isArray(cell.runs)) {
    throw new Error('Cannot render table cell runs: runs must be an array.');
  }
  return cell.runs.filter((run) => run && run.text != null && String(run.text) !== '');
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
  tableContent,
  tableSection,
  tableRow,
  tableCell,
  tableCellContent,
};
