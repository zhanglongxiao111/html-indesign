module.exports = [
  {
    canonicalPath: 'items[].styleRefs.paragraphStyle',
    currentPaths: ['items[].paragraphStyle', 'labels[].paragraphStyle', 'labels[].paragraphStyleToken'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-paragraph-style'],
      writeAttrs: ['data-id-paragraph-style'],
    },
    indesign: {
      labelPaths: ['styleRefs.paragraphStyle', 'styleRefs.paragraphStyleToken'],
      labelKinds: ['item'],
      instructionPaths: ['paragraphStyle'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].styleRefs.paragraphStyle'],
    },
  },
  {
    canonicalPath: 'items[].styleRefs.characterStyle',
    currentPaths: [
      'items[].characterStyle',
      'items[].content.runs[].characterStyle',
      'labels[].characterStyle',
      'labels[].characterStyleToken',
    ],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-character-style'],
      writeAttrs: ['data-id-character-style'],
    },
    indesign: {
      labelPaths: ['styleRefs.characterStyle', 'styleRefs.characterStyleToken'],
      labelKinds: ['item'],
      instructionPaths: ['characterStyle'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].styleRefs.characterStyle'],
    },
  },
  {
    canonicalPath: 'items[].styleRefs.objectStyle',
    currentPaths: ['items[].objectStyle', 'labels[].objectStyle', 'labels[].objectStyleToken'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-object-style'],
      writeAttrs: ['data-id-object-style'],
    },
    indesign: {
      labelPaths: ['styleRefs.objectStyle', 'styleRefs.objectStyleToken'],
      labelKinds: ['item'],
      instructionPaths: ['objectStyle'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].styleRefs.objectStyle'],
    },
  },
  {
    canonicalPath: 'items[].styleRefs.tableStyle',
    currentPaths: ['items[].table.tableStyle', 'labels[].tableStyle', 'labels[].tableStyleToken'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-table-style'],
      writeAttrs: ['data-id-table-style'],
    },
    indesign: {
      labelPaths: ['styleRefs.tableStyle', 'styleRefs.tableStyleToken'],
      labelKinds: ['item'],
      instructionPaths: ['tableStyle'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].styleRefs.tableStyle'],
    },
  },
  {
    canonicalPath: 'items[].styleRefs.layer',
    currentPaths: ['items[].layer', 'items[].layerToken', 'labels[].layer', 'labels[].layerToken'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-layer'],
      writeAttrs: ['data-id-layer'],
    },
    indesign: {
      labelPaths: ['styleRefs.layer', 'styleRefs.layerToken', 'layer', 'layerToken'],
      labelKinds: ['item'],
      instructionPaths: ['layer'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].styleRefs.layer'],
    },
  },
  {
    canonicalPath: 'items[].styleRefs.frameStyle',
    currentPaths: ['items[].frameStyle', 'labels[].frameStyle', 'labels[].frameStyleToken'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-frame-style'],
      writeAttrs: ['data-id-frame-style'],
    },
    indesign: {
      labelPaths: ['styleRefs.frameStyle', 'styleRefs.frameStyleToken'],
      labelKinds: ['item'],
      instructionPaths: ['frameStyle'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].styleRefs.frameStyle'],
    },
  },
  {
    canonicalPath: 'items[].styleRefs.cellStyle',
    currentPaths: ['items[].cellStyle', 'labels[].cellStyle', 'labels[].cellStyleToken'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-cell-style'],
      writeAttrs: ['data-id-cell-style'],
    },
    indesign: {
      labelPaths: ['styleRefs.cellStyle', 'styleRefs.cellStyleToken'],
      labelKinds: ['item'],
      instructionPaths: ['cellStyle'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].styleRefs.cellStyle'],
    },
  },
];
