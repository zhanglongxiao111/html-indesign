const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { mergeAttributes, attrsToHtml, escapeHtml } = require('./author-attribute-writer');
const {
  indent,
  isUsefulCharacterStyle,
  orderAttrs,
  orderInlineAttrs,
  safeInlineTag,
} = require('./author-render-utils');
const { colorWithOpacity, justificationCss, typeSizePx } = require('./css-values');
const { mergeDeclarations, runStyleCss, tagWithMergedStyle } = require('./author-run-style');
const { readBackRowHeights } = require('./table-html');

// options.writeRunStyles 时（读回样式写进作者 HTML），单元格的读回外观（填充、文字颜色与字形、
// 内边距、各边描边）写成单元格内联 style，基准是表格对象自身的文字样式 options.baseTextStyle。
function tableContent(table, depth, options = {}) {
  const rows = table.rows || [];
  const headRows = rows.filter((row) => row.header || (row.cells || []).some((cell) => cell.header));
  const bodyRows = rows.filter((row) => !headRows.includes(row));
  const rowHeights = options.writeRunStyles ? readBackRowHeights(table) : null;
  const rowOptions = rowHeights
    ? { ...options, rowHeightByRow: new Map(rows.map((row, index) => [row, rowHeights[index]])) }
    : options;
  const sections = [];
  const colgroup = options.writeRunStyles ? tableColGroup(table, depth) : '';
  if (colgroup) sections.push(colgroup);
  if (headRows.length) sections.push(tableSection('thead', headRows, depth, rowOptions));
  if (bodyRows.length) sections.push(tableSection('tbody', bodyRows, depth, rowOptions));
  return sections.join('\n');
}

// 读回列宽写成 <col style="width">：浏览器按内容与外框分配列宽会把等宽列算歪，
// 正向按 <col> 声明建 InDesign 列宽（table-instructions.declaredTableColumnWidths）。
function tableColGroup(table, depth) {
  const widths = Array.isArray(table.columnWidths) ? table.columnWidths.map(Number) : [];
  if (!widths.length || !widths.every((width) => Number.isFinite(width) && width > 0)) return '';
  const cols = widths.map((width) => `${indent(depth + 2)}<col style="width:${formatNumber(width)}px">`).join('\n');
  return `${indent(depth)}<colgroup>\n${cols}\n${indent(depth)}</colgroup>`;
}

function tableSection(tag, rows, depth, options = {}) {
  const rowHtml = rows.map((row) => tableRow(row, depth + 2, options)).join('\n');
  return `${indent(depth)}<${tag}>\n${rowHtml}\n${indent(depth)}</${tag}>`;
}

function tableRow(row, depth, options = {}) {
  const cells = (row.cells || []).map((cell) => tableCell(cell, depth + 2, options)).join('\n');
  const height = options.rowHeightByRow && options.rowHeightByRow.get(row);
  const open = height ? `<tr style="${rowHeightCss(height)}">` : '<tr>';
  return `${indent(depth)}${open}\n${cells}\n${indent(depth)}</tr>`;
}

// 读回行高写成 <tr> 的 height：CSS 表格行高是「至少」这么高，与 InDesign 行高语义一致，
// 再次正向构建按单元格高度读回同样的行高；表格总高由各行决定，不另钉高度。
function rowHeightCss(height) {
  return `height:${formatNumber(height)}px`;
}

// 来源 HTML 表格片段原样保留，按行出现顺序写入读回行高；行数对不上时不改。
function patchTableSourceHtmlRows(sourceHtml, table) {
  const heights = readBackRowHeights(table);
  const pattern = /<tr(?=[\s>])[^<>]*>/gi;
  const tags = String(sourceHtml).match(pattern) || [];
  if (!heights || tags.length !== heights.length) return sourceHtml;
  let index = 0;
  return String(sourceHtml).replace(pattern, (tag) => {
    const css = rowHeightCss(heights[index]);
    index += 1;
    return tagWithMergedStyle(tag, css);
  });
}

function tableCell(cell, depth, options = {}) {
  const tag = cell.header ? 'th' : 'td';
  const attrs = {};
  if (cell.paragraphStyle) attrs[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE] = cell.paragraphStyle;
  const rowSpan = tableCellSpan(cell.rowSpan, 'rowSpan');
  const colSpan = tableCellSpan(cell.colSpan, 'colSpan');
  if (rowSpan) attrs.rowspan = rowSpan;
  if (colSpan) attrs.colspan = colSpan;
  const cellCss = options.writeRunStyles ? tableCellCss(cell, options.baseTextStyle) : '';
  if (cellCss) attrs.style = cellCss;
  const attrHtml = attrsToHtml(orderAttrs(attrs));
  const runBase = options.writeRunStyles ? cellTextStyle(cell) : null;
  return `${indent(depth)}<${tag}${attrHtml ? ` ${attrHtml}` : ''}>${tableCellContent(cell, runBase)}</${tag}>`;
}

// 单元格读回外观 -> CSS。文字外观只写与表格基准不同的部分；描边只要有一边可见就写全四边。
function tableCellCss(cell, baseTextStyle) {
  const styles = [];
  if (cell.fillColor) styles.push(`background-color:${colorWithOpacity(cell.fillColor, cell.fillOpacity)}`);
  const textStyle = cellTextStyle(cell);
  const base = baseTextStyle || {};
  const textCss = runStyleCss(textStyle, base);
  if (textCss) styles.push(textCss);
  if (textStyle.leading != null && Number(textStyle.leading) !== Number(base.leading)) {
    styles.push(`line-height:${typeSizePx(textStyle.leading)}`);
  }
  if (textStyle.justification && textStyle.justification !== base.justification) {
    styles.push(justificationCss(textStyle.justification));
  }
  const padding = cell.padding || {};
  const paddingValues = [padding.top, padding.right, padding.bottom, padding.left];
  if (paddingValues.some((value) => value != null && Number.isFinite(Number(value)))) {
    styles.push(`padding:${paddingValues.map((value) => `${formatNumber(value || 0)}px`).join(' ')}`);
  }
  styles.push(tableCellBorderCss(cell.borders));
  return mergeDeclarations('', styles.filter(Boolean).join(';'));
}

function cellTextStyle(cell) {
  const textStyle = { ...(cell.textStyle || {}) };
  if (cell.textColor) textStyle.fillColor = cell.textColor;
  if (cell.pointSize != null) textStyle.pointSize = cell.pointSize;
  if (cell.leading != null) textStyle.leading = cell.leading;
  if (cell.textAlign) textStyle.justification = cell.textAlign;
  return textStyle;
}

function tableCellBorderCss(borders) {
  if (!borders) return '';
  const sides = ['top', 'right', 'bottom', 'left'];
  const edges = sides.map((side) => borders[side] || {});
  if (!edges.some((edge) => Number(edge.borderWeight) > 0)) return '';
  return sides.map((side, index) => {
    const edge = edges[index];
    const weight = Number(edge.borderWeight);
    return Number.isFinite(weight) && weight > 0
      ? `border-${side}:${formatNumber(weight)}px solid ${edge.color || '#000000'}`
      : `border-${side}:0 solid transparent`;
  }).join(';');
}

// 来源 HTML 表格片段原样保留，按单元格出现顺序合并读回外观；单元格数对不上时不改。
function patchTableSourceHtmlCells(sourceHtml, table, baseTextStyle) {
  const cells = (table && table.rows || []).flatMap((row) => row.cells || []);
  const pattern = /<t[dh](?=[\s>])[^<>]*>/gi;
  const tags = String(sourceHtml).match(pattern) || [];
  if (!cells.length || tags.length !== cells.length) return sourceHtml;
  let index = 0;
  return String(sourceHtml).replace(pattern, (tag) => {
    const css = tableCellCss(cells[index], baseTextStyle);
    index += 1;
    return css ? tagWithMergedStyle(tag, css) : tag;
  });
}

function tableCellSpan(value, fieldName) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid table cell ${fieldName}: expected positive integer, received "${value}".`);
  }
  return number > 1 ? String(number) : null;
}

function tableCellContent(cell, runBase = null) {
  const rich = richTableCellContent(cell, runBase);
  if (rich != null) return rich;
  return plainTextContent(cell.text || '');
}

function richTableCellContent(cell, runBase = null) {
  const text = String(cell.text == null ? '' : cell.text);
  const runs = tableCellRuns(cell).map((run) => withRunStyle(run, runBase));
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

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
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
  patchTableSourceHtmlCells,
  patchTableSourceHtmlRows,
};
