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
      labelPaths: ['styleRefs.paragraphStyle'],
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
      labelPaths: ['styleRefs.characterStyle'],
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
      labelPaths: ['styleRefs.objectStyle'],
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
      labelPaths: ['styleRefs.tableStyle'],
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
      labelPaths: ['layerToken'],
      instructionPaths: ['layer'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].styleRefs.layer'],
    },
  },
];
