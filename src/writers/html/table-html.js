const { attr, formatPx, formatNumber, cssForHtml } = require('./visual-html-utils');
const { textStyleCss } = require('./visual-style-css');
const { renderRichTextRuns, renderTextWithBreaks } = require('./rich-text-html');

function renderTableContent(item, model) {
  const table = item.table || {};
  const parts = [];
  if (Array.isArray(table.columnWidths) && table.columnWidths.length) {
    parts.push(renderTableColGroup(table.columnWidths));
  }
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (rows.length) {
    parts.push('<tbody>');
    for (const row of rows) parts.push(renderTableRow(row, model));
    parts.push('</tbody>');
  }
  return parts.length ? `\n${parts.join('\n')}\n    ` : '';
}

function renderTableColGroup(columnWidths) {
  const cols = columnWidths
    .map((width) => `      <col style="width:${formatPx(width)}">`)
    .join('\n');
  return `      <colgroup>\n${cols}\n      </colgroup>`;
}

function renderTableRow(row, model) {
  const cells = (row.cells || []).map((cell) => renderTableCell(cell, model)).join('\n');
  return `      <tr>\n${cells}\n      </tr>`;
}

function renderTableCell(cell, model) {
  const tag = cell.header ? 'th' : 'td';
  const style = tableCellCss(cell);
  const attrs = [
    cell.paragraphStyle ? `data-id-paragraph-style="${attr(cell.paragraphStyle)}"` : null,
    cell.cellStyle ? `data-id-cell-style="${attr(cell.cellStyle)}"` : null,
    Number(cell.rowSpan) > 1 ? `rowspan="${attr(cell.rowSpan)}"` : null,
    Number(cell.colSpan) > 1 ? `colspan="${attr(cell.colSpan)}"` : null,
    style ? `style="${attr(style)}"` : null,
  ].filter(Boolean);
  const open = attrs.length ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;
  return `        ${open}${renderTableCellContent(cell, model)}</${tag}>`;
}

function renderTableCellContent(cell, model) {
  const runs = Array.isArray(cell.runs) ? cell.runs.filter((run) => run && run.text) : [];
  if (runs.length) return renderRichTextRuns(runs, model);
  return renderTextWithBreaks(cleanTableCellText(cell.text));
}

function tableCellCss(cell) {
  const styles = [];
  if (cell.fillColor) styles.push(`background-color:${cell.fillColor}`);
  const textStyle = { ...(cell.textStyle || {}) };
  if (cell.textColor) textStyle.fillColor = cell.textColor;
  if (cell.pointSize != null) textStyle.pointSize = cell.pointSize;
  if (cell.leading != null) textStyle.leading = cell.leading;
  if (cell.tracking != null) textStyle.tracking = cell.tracking;
  if (cell.textAlign) textStyle.justification = cell.textAlign;
  const textCss = textStyleCss(textStyle);
  if (textCss) styles.push(textCss);
  const padding = tableCellPaddingCss(cell.padding);
  if (padding) styles.push(padding);
  const borders = tableCellBordersCss(cell.borders);
  if (borders) styles.push(borders);
  if (cell.inlineStyle) styles.push(cssForHtml(cell.inlineStyle));
  return styles.filter(Boolean).map((value) => String(value).trim().replace(/;+$/, '')).join(';');
}

function tableCellPaddingCss(padding) {
  if (!padding) return '';
  const values = [padding.top, padding.right, padding.bottom, padding.left];
  if (!values.some((value) => value != null && Number.isFinite(Number(value)))) return '';
  return `padding:${formatPx(values[0] || 0)} ${formatPx(values[1] || 0)} ${formatPx(values[2] || 0)} ${formatPx(values[3] || 0)}`;
}

function tableCellBordersCss(borders) {
  if (!borders) return '';
  const styles = [];
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const edge = borders[side] || {};
    const weight = Number(edge.borderWeight);
    if (Number.isFinite(weight) && weight > 0) {
      styles.push(`border-${side}:${formatNumber(weight)}px solid ${edge.color || '#000000'}`);
    }
  }
  return styles.join(';');
}

function tableStyleName(item) {
  return (item.styleRefs && item.styleRefs.tableStyle)
    || (item.table && item.table.tableStyle)
    || null;
}

function cleanTableCellText(value) {
  return String(value == null ? '' : value)
    .replace(/\u0016/g, '')
    .replace(/[\u0003-\u0007]/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n+$/g, '');
}

module.exports = {
  renderTableContent,
  tableStyleName,
};
