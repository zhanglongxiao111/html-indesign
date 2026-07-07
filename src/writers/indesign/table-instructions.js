const { round } = require('../../shared/geometry');
const { itemBounds } = require('../../semantic-model/layout');

// Native InDesign table rows need a small per-row reserve beyond browser
// cell geometry: presentation E2E showed row edge/baseline allocation can
// exceed captured CSS leading + padding by about 2pt without changing layout.
const PRESENTATION_NATIVE_TABLE_ROW_RESERVE_PT = 2;

function tableRowsForInstruction(item, page, layout) {
  const table = tablePayload(item);
  const rows = table.rows || [];
  if (layout.unitMode !== 'presentation') return rows;
  return rows.map((row) => ({
    ...row,
    cells: (row.cells || []).map((cell) => {
      const raw = tableCellSnapshot(item, row.index, cell.index);
      return {
        ...cell,
        bounds: tableCellBoundsForInstruction(item, page, layout, cell, raw),
      };
    }),
  }));
}

function tableCellSnapshot(item, rowIndex, cellIndex) {
  const table = tablePayload(item);
  const sourceRows = Array.isArray(table.sourceRows)
    ? table.sourceRows
    : Array.isArray(item.table) ? item.table : [];
  const row = sourceRows.find((candidate) => Number(candidate.index) === Number(rowIndex));
  if (!row) return null;
  return (row.cells || []).find((candidate) => Number(candidate.index) === Number(cellIndex)) || null;
}

function tableColumnWidthsForInstruction(item, rows, layout) {
  const table = tablePayload(item);
  if (layout.unitMode !== 'presentation') return table.columnWidths || [];
  const sourceRow = (rows || []).find((row) => (row.cells || []).every((cell) => cell.bounds && Number(cell.bounds.width) > 0));
  if (!sourceRow) return [];
  const widths = [];
  for (const cell of sourceRow.cells || []) {
    const span = Math.max(1, Number(cell.colSpan || 1));
    const width = Number(cell.bounds.width || 0) / span;
    for (let index = 0; index < span; index += 1) widths.push(round(width, 2));
  }
  return normalizeTableWidths(widths, item.bounds && item.bounds.width);
}

function tableRowHeightsForInstruction(item, rows, layout) {
  const table = tablePayload(item);
  if (layout.unitMode !== 'presentation') return table.rowHeights || [];
  return (rows || []).map((row) => {
    const height = (row.cells || []).reduce((max, cell) => Math.max(max, Number(cell.bounds && cell.bounds.height || 0), minimumTableCellHeight(cell, layout)), 0);
    return round(height, 2);
  });
}

function tablePayload(item) {
  if (item && item.table && !Array.isArray(item.table)) return item.table;
  if (item && item.content) return item.content;
  return {};
}

function tableCellBoundsForInstruction(item, page, layout, cell, raw) {
  if (raw && raw.rectPx && page && page.rectPx) {
    return itemBounds({ rectPx: raw.rectPx, boundsMm: cell.bounds }, page, layout);
  }
  const sourceBounds = raw && raw.boundsMm ? raw.boundsMm : cell.bounds;
  const projected = projectTableCellBounds(sourceBounds, item);
  if (projected) return projected;
  return scaleBounds(cell.bounds, layout);
}

function projectTableCellBounds(bounds, item) {
  if (!bounds || !item || !item.bounds || !item.boundsMm) return null;
  const tableBounds = item.bounds;
  const sourceBounds = item.boundsMm;
  const sourceWidth = Number(sourceBounds.width || 0);
  const sourceHeight = Number(sourceBounds.height || 0);
  if (sourceWidth <= 0 || sourceHeight <= 0) return null;
  const scaleX = Number(tableBounds.width || 0) / sourceWidth;
  const scaleY = Number(tableBounds.height || 0) / sourceHeight;
  return {
    x: round(Number(tableBounds.x || 0) + (Number(bounds.x || 0) - Number(sourceBounds.x || 0)) * scaleX, 2),
    y: round(Number(tableBounds.y || 0) + (Number(bounds.y || 0) - Number(sourceBounds.y || 0)) * scaleY, 2),
    width: round(Number(bounds.width || 0) * scaleX, 2),
    height: round(Number(bounds.height || 0) * scaleY, 2),
  };
}

function normalizeTableWidths(widths, tableWidth) {
  const targetWidth = Number(tableWidth || 0);
  if (!widths.length || targetWidth <= 0) return widths;
  const total = widths.reduce((sum, width) => sum + Number(width || 0), 0);
  const delta = round(targetWidth - total, 2);
  if (Math.abs(delta) > 0 && Math.abs(delta) <= Math.max(1, targetWidth * 0.01)) {
    widths[widths.length - 1] = round(widths[widths.length - 1] + delta, 2);
  }
  return widths;
}

function minimumTableCellHeight(cell, layout) {
  const padding = cell.padding || {};
  const leading = Number(cell.leading || 0) || Number(cell.pointSize || 0) * 1.2;
  const stroke = Number(cell.borderWeight || 0);
  const nativeReserve = layout && layout.unitMode === 'presentation'
    ? PRESENTATION_NATIVE_TABLE_ROW_RESERVE_PT
    : 0;
  return Number(padding.top || 0) + Number(padding.bottom || 0) + leading + stroke * 2 + nativeReserve;
}

function scaleBounds(bounds, layout) {
  if (!bounds) return null;
  const scale = Number(layout.scale || 1);
  return {
    x: round(Number(bounds.x || 0) * scale, 2),
    y: round(Number(bounds.y || 0) * scale, 2),
    width: round(Number(bounds.width || 0) * scale, 2),
    height: round(Number(bounds.height || 0) * scale, 2),
  };
}

function nativeTableBounds(bounds, rowHeights, layout) {
  const rowTotal = (rowHeights || []).reduce((sum, height) => sum + Number(height || 0), 0);
  const slack = layout && layout.unitMode === 'presentation'
    ? Math.max(24, (rowHeights || []).length * 4)
    : 1;
  const requiredHeight = rowTotal > 0 ? rowTotal + slack : 0;
  if (requiredHeight <= Number(bounds.height || 0)) return bounds;
  return {
    ...bounds,
    height: round(requiredHeight, 2),
  };
}

module.exports = {
  tableRowsForInstruction,
  tableColumnWidthsForInstruction,
  tableRowHeightsForInstruction,
  nativeTableBounds,
};
