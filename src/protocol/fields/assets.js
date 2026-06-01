const ASSET_SOURCE_METADATA_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
});

const ASSET_PLACEMENT_CANONICAL_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'preview-image' },
});

function assetSourceMetadata(canonicalPath, type, snapshotPath) {
  return {
    canonicalPath,
    currentPaths: [],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'asset-placement',
    type,
    capabilities: ASSET_SOURCE_METADATA_CAPABILITIES,
    indesign: {
      snapshotPaths: [snapshotPath],
    },
  };
}

function assetPlacementCanonical(canonicalPath, type, snapshotPath) {
  return {
    canonicalPath,
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    type,
    capabilities: ASSET_PLACEMENT_CANONICAL_CAPABILITIES,
    indesign: {
      snapshotPaths: [snapshotPath],
    },
  };
}

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
  assetSourceMetadata('items[].asset.name', 'string', 'placedAsset.name'),
  assetSourceMetadata('items[].asset.status', 'string', 'placedAsset.status'),
  assetSourceMetadata('items[].asset.graphicType', 'string', 'placedAsset.graphicType'),
  assetSourceMetadata('items[].asset.imageTypeName', 'string', 'placedAsset.imageTypeName'),
  assetSourceMetadata('items[].asset.cropped', 'boolean', 'placedAsset.cropped'),
  assetSourceMetadata('items[].asset.preview', 'object', 'placedAsset.preview'),
  assetPlacementCanonical('items[].asset.placement.crop', 'string', 'placedAsset.placement.crop'),
  assetPlacementCanonical(
    'items[].asset.placement.transparentBackground',
    'boolean',
    'placedAsset.placement.transparentBackground',
  ),
  assetPlacementCanonical('items[].asset.placement.visibleLayers', 'array', 'placedAsset.placement.visibleLayers'),
  assetPlacementCanonical('items[].asset.placement.hiddenLayers', 'array', 'placedAsset.placement.hiddenLayers'),
  assetSourceMetadata('items[].asset.placement.layers', 'array', 'placedAsset.placement.layers'),
];
