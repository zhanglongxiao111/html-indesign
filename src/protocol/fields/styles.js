const STYLE_REF_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

const SYNTHESIZED_STYLE_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

function styleRefCarrier(canonicalPath, currentPaths, htmlAttr, type = 'string') {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type,
    capabilities: STYLE_REF_CAPABILITIES,
    html: {
      readAttrs: [htmlAttr],
      writeAttrs: [htmlAttr],
    },
    indesign: {
      labelPaths: [`styleRefs.${canonicalPath.slice('items[].styleRefs.'.length)}`],
      labelKinds: ['item'],
    },
    pptx: {
      customDataPaths: [`htmlIndesign.${canonicalPath}`],
    },
  };
}

function synthesizedStyleField(canonicalPath, currentPaths, type, extra = {}) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'synthesized-styles',
    type,
    capabilities: SYNTHESIZED_STYLE_CAPABILITIES,
    ...extra,
  };
}

module.exports = [
  synthesizedStyleField(
    'styles.synthesized',
    ['reverseModel.styles.synthesized', 'document.sourcePackage.styles.synthesized'],
    'array',
  ),
  synthesizedStyleField(
    'styles.synthesized[].token',
    ['reverseModel.styles.synthesized[].token', 'document.sourcePackage.styles.synthesized[].token'],
    'string',
  ),
  synthesizedStyleField(
    'styles.synthesized[].displayName',
    [
      'reverseModel.styles.synthesized[].displayName',
      'document.sourcePackage.styles.synthesized[].displayName',
    ],
    'string',
  ),
  synthesizedStyleField(
    'styles.synthesized[].kind',
    ['reverseModel.styles.synthesized[].kind', 'document.sourcePackage.styles.synthesized[].kind'],
    'string',
  ),
  synthesizedStyleField(
    'styles.synthesized[].fingerprint',
    [
      'reverseModel.styles.synthesized[].fingerprint',
      'document.sourcePackage.styles.synthesized[].fingerprint',
    ],
    'string',
  ),
  synthesizedStyleField(
    'styles.synthesized[].source',
    ['reverseModel.styles.synthesized[].source', 'document.sourcePackage.styles.synthesized[].source'],
    'string',
  ),
  synthesizedStyleField(
    'styles.synthesized[].properties',
    [
      'reverseModel.styles.synthesized[].properties',
      'document.sourcePackage.styles.synthesized[].properties',
    ],
    'object',
  ),
  synthesizedStyleField(
    'items[].styleRefs.synthesizedToken',
    [
      'labels[].styleRefs.synthesizedToken',
      'sourceNode.attributes.data-id-style-token',
    ],
    'string',
    {
      html: {
        readAttrs: ['data-id-style-token'],
        writeAttrs: ['data-id-style-token'],
      },
      indesign: {
        labelPaths: ['styleRefs.synthesizedToken'],
        labelKinds: ['item'],
      },
      pptx: {
        customDataPaths: ['htmlIndesign.items[].styleRefs.synthesizedToken'],
      },
    },
  ),
  synthesizedStyleField(
    'items[].styleRefs.synthesizedName',
    [
      'labels[].styleRefs.synthesizedName',
    ],
    'string',
    {
      indesign: {
        labelPaths: ['styleRefs.synthesizedName'],
        labelKinds: ['item'],
      },
      pptx: {
        customDataPaths: ['htmlIndesign.items[].styleRefs.synthesizedName'],
      },
    },
  ),
  synthesizedStyleField(
    'items[].styleOverrides',
    ['labels[].styleOverrides', 'reverseModel.pages[].items[].styleOverrides'],
    'object',
    {
      indesign: {
        labelPaths: ['styleOverrides'],
        labelKinds: ['item'],
      },
      pptx: {
        customDataPaths: ['htmlIndesign.items[].styleOverrides'],
      },
    },
  ),
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
  styleRefCarrier(
    'items[].styleRefs.genericStyle',
    ['items[].styleRefs.style', 'sourceNode.attributes.data-id-style'],
    'data-id-style',
  ),
  styleRefCarrier(
    'items[].styleRefs.displayName',
    ['items[].styleRefs.styleName', 'sourceNode.attributes.data-id-style-name'],
    'data-id-style-name',
  ),
  styleRefCarrier(
    'items[].styleRefs.paragraphStyleDisplayName',
    ['items[].paragraphStyleName', 'sourceNode.attributes.data-id-paragraph-style-name'],
    'data-id-paragraph-style-name',
  ),
  styleRefCarrier(
    'items[].styleRefs.characterStyleDisplayName',
    ['items[].characterStyleName', 'sourceNode.attributes.data-id-character-style-name'],
    'data-id-character-style-name',
  ),
  styleRefCarrier(
    'items[].styleRefs.objectStyleDisplayName',
    ['items[].objectStyleName', 'sourceNode.attributes.data-id-object-style-name'],
    'data-id-object-style-name',
  ),
  styleRefCarrier(
    'items[].styleRefs.frameStyleDisplayName',
    ['items[].frameStyleName', 'sourceNode.attributes.data-id-frame-style-name'],
    'data-id-frame-style-name',
  ),
  styleRefCarrier(
    'items[].styleRefs.tableStyleDisplayName',
    ['items[].tableStyleName', 'sourceNode.attributes.data-id-table-style-name'],
    'data-id-table-style-name',
  ),
];
