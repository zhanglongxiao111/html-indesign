const TABLE_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'editable-shapes' },
});

function tableField(canonicalPath, type, extra = {}) {
  return {
    canonicalPath,
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'table-content',
    type,
    capabilities: TABLE_CAPABILITIES,
    ...extra,
  };
}

module.exports = [
  tableField('items[].table.rowCount', 'integer'),
  tableField('items[].table.columnCount', 'integer'),
  tableField('items[].table.columnWidths', 'array'),
  tableField('items[].table.rowHeights', 'array'),
  tableField('items[].table.rows', 'array', {
    currentPaths: ['instructions.pages[].items[].table.rows', 'reverseModel.pages[].items[].table.rows'],
    indesign: {
      snapshotPaths: ['table.rows'],
      instructionPaths: ['table.rows'],
    },
  }),
  tableField('items[].table.rows[].index', 'integer'),
  tableField('items[].table.rows[].cells', 'array', {
    currentPaths: ['instructions.pages[].items[].table.rows[].cells', 'reverseModel.pages[].items[].table.rows[].cells'],
    indesign: {
      snapshotPaths: ['table.rows[].cells'],
      instructionPaths: ['table.rows[].cells'],
    },
  }),
  tableField('items[].table.rows[].cells[].index', 'integer'),
  tableField('items[].table.rows[].cells[].text', 'string'),
  tableField('items[].table.rows[].cells[].header', 'boolean'),
  tableField('items[].table.rows[].cells[].rowSpan', 'integer'),
  tableField('items[].table.rows[].cells[].colSpan', 'integer'),
  tableField('items[].table.rows[].cells[].paragraphStyle', 'string'),
  tableField('items[].table.rows[].cells[].cellStyle', 'string'),
  tableField('items[].table.rows[].cells[].fillColor', 'string'),
  tableField('items[].table.rows[].cells[].textColor', 'string'),
  tableField('items[].table.rows[].cells[].pointSize', 'number'),
  tableField('items[].table.rows[].cells[].leading', 'number'),
  tableField('items[].table.rows[].cells[].textAlign', 'string'),
  tableField('items[].table.rows[].cells[].padding', 'object'),
  tableField('items[].table.rows[].cells[].borders', 'object'),
  tableField('items[].table.rows[].cells[].runs', 'array'),
  tableField('items[].table.rows[].cells[].runs[].text', 'string'),
  tableField('items[].table.rows[].cells[].runs[].tagName', 'string'),
  tableField('items[].table.rows[].cells[].runs[].classList', 'array'),
  tableField('items[].table.rows[].cells[].runs[].attributes', 'object'),
  tableField('items[].table.rows[].cells[].runs[].characterStyle', 'string'),
];
