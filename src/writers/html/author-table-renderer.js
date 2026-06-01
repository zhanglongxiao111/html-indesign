const { attrsToHtml, escapeHtml } = require('./author-attribute-writer');
const { indent, orderAttrs } = require('./author-render-utils');

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
  if (cell.paragraphStyle) attrs['data-id-paragraph-style'] = cell.paragraphStyle;
  const attrHtml = attrsToHtml(orderAttrs(attrs));
  return `${indent(depth)}<${tag}${attrHtml ? ` ${attrHtml}` : ''}>${escapeHtml(cell.text || '')}</${tag}>`;
}

module.exports = {
  tableContent,
  tableSection,
  tableRow,
  tableCell,
};
