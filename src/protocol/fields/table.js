const TABLE_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'editable-shapes' },
});

const TABLE_CELL_STYLE_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'native', persist: 'native' },
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

function tableSourceMetadata(canonicalPath, type) {
  return tableField(canonicalPath, type, {
    fieldClass: 'sourceMetadata',
    capabilities: {
      html: { read: 'native', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
  });
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
  tableField('items[].table.rows[].header', 'boolean'),
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
  tableField('items[].table.rows[].cells[].cellStyle', 'string', {
    capabilities: TABLE_CELL_STYLE_CAPABILITIES,
  }),
  tableField('items[].table.rows[].cells[].fillColor', 'string'),
  tableField('items[].table.rows[].cells[].fillOpacity', 'number'),
  tableField('items[].table.rows[].cells[].borderColor', 'string'),
  tableField('items[].table.rows[].cells[].borderWeight', 'number'),
  tableField('items[].table.rows[].cells[].textColor', 'string'),
  tableSourceMetadata('items[].table.rows[].cells[].textStyle', 'object'),
  tableField('items[].table.rows[].cells[].bounds', 'object'),
  tableField('items[].table.rows[].cells[].pointSize', 'number'),
  tableField('items[].table.rows[].cells[].leading', 'number'),
  tableField('items[].table.rows[].cells[].textAlign', 'string'),
  tableField('items[].table.rows[].cells[].padding', 'object'),
  tableField('items[].table.rows[].cells[].paddingUnit', 'string'),
  tableField('items[].table.rows[].cells[].borders', 'object'),
  tableField('items[].table.rows[].cells[].runs', 'array'),
  tableField('items[].table.rows[].cells[].runs[].text', 'string'),
  tableSourceMetadata('items[].table.rows[].cells[].runs[].tagName', 'string'),
  tableSourceMetadata('items[].table.rows[].cells[].runs[].classList', 'array'),
  tableSourceMetadata('items[].table.rows[].cells[].runs[].attributes', 'object'),
  tableField('items[].table.rows[].cells[].runs[].characterStyle', 'string'),
  tableSourceMetadata('items[].table.rows[].cells[].runs[].textStyle', 'object'),
  tableSourceMetadata('items[].table.rows[].cells[].runs[].inlineStyle', 'string'),
];
