module.exports = [
  {
    canonicalPath: 'assets[].path',
    currentPaths: ['assets[].src', 'assets[].resolvedPath', 'items[].asset.path'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: {
        read: 'unsupported',
        write: 'fallback',
        persist: 'lossless',
        fallbackKind: 'customData',
        risk: 'external-link-policy',
      },
    },
    html: {
      readAttrs: ['src', 'href', 'data', 'data-id-asset-path'],
      writeAttrs: ['src', 'href', 'data', 'data-id-asset-path'],
    },
    indesign: {
      snapshotPaths: ['placedAsset.path', 'asset.path'],
      labelPaths: ['asset.path'],
      instructionPaths: ['placed.assetId'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.assets[].path'],
    },
  },
  {
    canonicalPath: 'items[].asset.placement.pageNumber',
    currentPaths: [
      'items[].asset.pageNumber',
      'instructions.pages[].items[].placed.pageNumber',
    ],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    type: 'integer',
    validation: { min: 1, integer: true },
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: {
        read: 'unsupported',
        write: 'fallback',
        persist: 'lossless',
        fallbackKind: 'preview-image',
        risk: 'editable-loss',
      },
    },
    html: {
      readAttrs: ['data-id-pdf-page'],
      writeAttrs: ['data-id-pdf-page'],
    },
    indesign: {
      snapshotPaths: ['placedAsset.placement.pageNumber', 'graphic.pdfAttributes.pageNumber'],
      labelPaths: ['asset.pageNumber'],
      instructionPaths: ['placed.pageNumber'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].asset.placement.pageNumber'],
    },
  },
];
