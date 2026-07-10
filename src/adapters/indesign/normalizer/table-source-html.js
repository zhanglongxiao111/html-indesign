'use strict';

const cheerio = require('cheerio');
const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
const { collapseWhitespace } = require('../../../shared/text');

function tableSourceHtmlMatchesTable(sourceHtml, table) {
  if (typeof sourceHtml !== 'string' || !sourceHtml.trim()) return false;
  const sourceRows = sourceHtmlTableRows(sourceHtml);
  const actualRows = normalizedTableRows(table);
  if (!sourceRows || !actualRows) return false;
  if (sourceRows.length !== actualRows.length) return false;
  return sourceRows.every((row, rowIndex) => {
    const actualRow = actualRows[rowIndex];
    if (row.length !== actualRow.length) return false;
    return row.every((cell, cellIndex) => sameTableCell(cell, actualRow[cellIndex]));
  });
}

function sourceHtmlTableRows(sourceHtml) {
  let $;
  try {
    $ = cheerio.load(`<table>${sourceHtml}</table>`, { decodeEntities: false });
  } catch (_) {
    return null;
  }
  const rows = $('tr').toArray().map((row) => $(row).children('th,td').toArray().map((cell) => ({
    text: collapseWhitespace($(cell).text()),
    header: String(cell.tagName || cell.name || '').toLowerCase() === 'th',
    rowSpan: cellSpan($(cell).attr('rowspan')),
    colSpan: cellSpan($(cell).attr('colspan')),
    paragraphStyle: $(cell).attr(HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE) || null,
  })));
  return rows.length ? rows : null;
}

function normalizedTableRows(table) {
  const rows = table && Array.isArray(table.rows) ? table.rows : null;
  if (!rows || !rows.length) return null;
  return rows.map((row) => (row && Array.isArray(row.cells) ? row.cells : []).map((cell) => ({
    text: collapseWhitespace(String(cell && cell.text || '')),
    header: Boolean(cell && cell.header),
    rowSpan: cellSpan(cell && cell.rowSpan),
    colSpan: cellSpan(cell && cell.colSpan),
    paragraphStyle: cell && cell.paragraphStyle || null,
  })));
}

function sameTableCell(sourceCell, actualCell) {
  if (sourceCell.text !== actualCell.text) return false;
  if (sourceCell.header !== actualCell.header) return false;
  if (sourceCell.rowSpan !== actualCell.rowSpan) return false;
  if (sourceCell.colSpan !== actualCell.colSpan) return false;
  if (sourceCell.paragraphStyle && sourceCell.paragraphStyle !== actualCell.paragraphStyle) return false;
  return true;
}

function cellSpan(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 1 ? number : 1;
}

module.exports = {
  tableSourceHtmlMatchesTable,
};
