module.exports = [
  {
    canonicalPath: 'items[].table.rows',
    currentPaths: ['instructions.pages[].items[].table.rows', 'reverseModel.pages[].items[].table.rows'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'table-content',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'editable-shapes' },
    },
    indesign: {
      snapshotPaths: ['table.rows'],
      instructionPaths: ['table.rows'],
    },
  },
  {
    canonicalPath: 'items[].table.rows[].cells',
    currentPaths: ['instructions.pages[].items[].table.rows[].cells', 'reverseModel.pages[].items[].table.rows[].cells'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'table-content',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'editable-shapes' },
    },
    indesign: {
      snapshotPaths: ['table.rows[].cells'],
      instructionPaths: ['table.rows[].cells'],
    },
  },
];
