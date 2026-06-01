const { rectPxToMm, round } = require('../../../shared/geometry');

function tableRowsWithBounds(rows, pageRectPx, pageWidthMm, pageHeightMm) {
  return rows.map((row) => ({
    ...row,
    cells: (row.cells || []).map((cell) => {
      if (!cell.rectPx) return cell;
      return {
        ...cell,
        boundsMm: roundBounds(rectPxToMm({
          rectPx: cell.rectPx,
          pageRectPx,
          pageWidthMm,
          pageHeightMm,
        }), 2),
      };
    }),
  }));
}

function roundBounds(bounds, digits) {
  return {
    x: round(bounds.x, digits),
    y: round(bounds.y, digits),
    width: round(bounds.width, digits),
    height: round(bounds.height, digits),
  };
}

module.exports = {
  tableRowsWithBounds,
};
