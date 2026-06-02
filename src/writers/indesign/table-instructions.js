const { round } = require('../../shared/geometry');
const { itemBounds } = require('../../semantic-model/layout');

function tableRowsForInstruction(item, page, layout) {
  const rows = item.content.rows || [];
  if (layout.unitMode !== 'presentation') return rows;
  return rows.map((row) => ({
    ...row,
    cells: (row.cells || []).map((cell) => {
      const raw = tableCellSnapshot(item, row.index, cell.index);
      return {
        ...cell,
        bounds: raw && raw.rectPx ? itemBounds({ rectPx: raw.rectPx, boundsMm: cell.bounds }, page, layout) : scaleBounds(cell.bounds, layout),
      };
    }),
  }));
}

function tableCellSnapshot(item, rowIndex, cellIndex) {
  const row = (item.table || []).find((candidate) => Number(candidate.index) === Number(rowIndex));
  if (!row) return null;
  return (row.cells || []).find((candidate) => Number(candidate.index) === Number(cellIndex)) || null;
}

function tableColumnWidthsForInstruction(item, rows, layout) {
  if (layout.unitMode !== 'presentation') return item.content.columnWidths || [];
  const sourceRow = (rows || []).find((row) => (row.cells || []).every((cell) => cell.bounds && Number(cell.bounds.width) > 0));
  if (!sourceRow) return [];
  const widths = [];
  for (const cell of sourceRow.cells || []) {
    const span = Math.max(1, Number(cell.colSpan || 1));
    const width = Number(cell.bounds.width || 0) / span;
    for (let index = 0; index < span; index += 1) widths.push(round(width, 2));
  }
  return widths;
}

function tableRowHeightsForInstruction(item, rows, layout) {
  if (layout.unitMode !== 'presentation') return item.content.rowHeights || [];
  return (rows || []).map((row) => {
    const height = (row.cells || []).reduce((max, cell) => Math.max(max, Number(cell.bounds && cell.bounds.height || 0), minimumTableCellHeight(cell)), 0);
    return round(height, 2);
  });
}

function minimumTableCellHeight(cell) {
  const padding = cell.padding || {};
  const leading = Number(cell.leading || 0) || Number(cell.pointSize || 0) * 1.2;
  const stroke = Number(cell.borderWeight || 0);
  return Number(padding.top || 0) + Number(padding.bottom || 0) + leading + stroke * 2;
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
  const slack = layout && layout.unitMode === 'presentation' ? 12 : 1;
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
