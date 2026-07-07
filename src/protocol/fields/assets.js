const ASSET_SOURCE_METADATA_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
});

const HTML_ASSET_SOURCE_METADATA_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
});

const ASSET_PLACEMENT_CANONICAL_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'preview-image' },
});

const ITEM_ASSET_PLACEMENT_CANONICAL_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'preview-image' },
});

function assetSourceMetadata(canonicalPath, type, snapshotPath, extra = {}) {
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
    ...extra,
  };
}

function rootAssetSourceMetadata(canonicalPath, type, snapshotPath, extra = {}) {
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
    ...extra,
  };
}

function htmlAssetSourceMetadata(canonicalPath, type) {
  return {
    canonicalPath,
    currentPaths: [],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'asset-placement',
    type,
    capabilities: HTML_ASSET_SOURCE_METADATA_CAPABILITIES,
  };
}

function assetPlacementCanonical(canonicalPath, type, snapshotPath, extra = {}) {
  return {
    canonicalPath,
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    type,
    capabilities: ITEM_ASSET_PLACEMENT_CANONICAL_CAPABILITIES,
    indesign: {
      snapshotPaths: [snapshotPath],
    },
    ...extra,
  };
}

module.exports = [
  {
    canonicalPath: 'assets[].kind',
    currentPaths: ['assets[].kind', 'items[].asset.kind', 'sourceNode.attributes.data-id-asset-kind'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    type: 'string',
    capabilities: ASSET_PLACEMENT_CANONICAL_CAPABILITIES,
    html: {
      readAttrs: ['data-id-asset-kind'],
      writeAttrs: ['data-id-asset-kind'],
    },
    indesign: {
      snapshotPaths: ['placedAsset.kind', 'asset.kind'],
      labelPaths: ['asset.kind'],
      labelKinds: ['item'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.assets[].kind'],
    },
  },
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
      labelKinds: ['item'],
      instructionPaths: ['placed.assetId'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.assets[].path'],
    },
  },
  rootAssetSourceMetadata('assets[].name', 'string', 'assets[].name'),
  rootAssetSourceMetadata('assets[].status', 'string', 'assets[].status'),
  htmlAssetSourceMetadata('assets[].fileName', 'string'),
  htmlAssetSourceMetadata('assets[].linked', 'boolean'),
  htmlAssetSourceMetadata('assets[].placement', 'object'),
  htmlAssetSourceMetadata('assets[].sourceSelector', 'string'),
  htmlAssetSourceMetadata('assets[].source', 'string'),
  htmlAssetSourceMetadata('assets[].imageSize', 'object'),
  htmlAssetSourceMetadata('assets[].cropped', 'boolean'),
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
      html: { read: 'observe-only', write: 'native', persist: 'native' },
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
      labelKinds: ['item'],
      instructionPaths: ['placed.pageNumber'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].asset.placement.pageNumber'],
    },
  },
  assetSourceMetadata('items[].asset.name', 'string', 'placedAsset.name'),
  assetSourceMetadata('items[].asset.status', 'string', 'placedAsset.status'),
  assetSourceMetadata('items[].asset.bounds', 'object', 'placedAsset.bounds'),
  assetSourceMetadata('items[].asset.graphicType', 'string', 'placedAsset.graphicType'),
  assetSourceMetadata('items[].asset.imageTypeName', 'string', 'placedAsset.imageTypeName'),
  assetSourceMetadata('items[].asset.cropped', 'boolean', 'placedAsset.cropped'),
  assetSourceMetadata('items[].asset.source', 'string', 'placedAsset.source'),
  assetSourceMetadata('items[].asset.imageSize', 'object', 'placedAsset.imageSize'),
  assetSourceMetadata('items[].asset.imageCropped', 'boolean', 'placedAsset.cropped', {
    html: {
      readAttrs: ['data-id-image-cropped'],
      writeAttrs: ['data-id-image-cropped'],
    },
  }),
  assetSourceMetadata('items[].asset.preview', 'object', 'placedAsset.preview'),
  assetSourceMetadata('items[].asset.preview.kind', 'string', 'placedAsset.preview.kind', {
    html: {
      readAttrs: ['data-id-preview-kind'],
      writeAttrs: ['data-id-preview-kind'],
    },
  }),
  assetSourceMetadata('items[].asset.preview.path', 'string', 'placedAsset.preview.path', {
    html: {
      readAttrs: ['data-id-preview-asset-path', 'data-id-preview-src'],
      writeAttrs: ['data-id-preview-asset-path', 'data-id-preview-src'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.crop', 'string', 'placedAsset.placement.crop', {
    html: {
      readAttrs: ['data-id-crop'],
      writeAttrs: ['data-id-crop'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.fit', 'string', 'placedAsset.placement.fit', {
    html: {
      readAttrs: ['data-id-fit'],
      writeAttrs: ['data-id-fit'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.artboard', 'string|integer', 'placedAsset.placement.artboard', {
    html: {
      readAttrs: ['data-id-artboard'],
      writeAttrs: ['data-id-artboard'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.layerComp', 'string', 'placedAsset.placement.layerComp', {
    html: {
      readAttrs: ['data-id-layer-comp'],
      writeAttrs: ['data-id-layer-comp'],
    },
  }),
  assetPlacementCanonical(
    'items[].asset.placement.transparentBackground',
    'boolean',
    'placedAsset.placement.transparentBackground',
  ),
  assetPlacementCanonical('items[].asset.placement.visibleLayers', 'array', 'placedAsset.placement.visibleLayers', {
    html: {
      readAttrs: ['data-id-visible-layers', 'data-id-pdf-visible-layers'],
      writeAttrs: ['data-id-visible-layers', 'data-id-pdf-visible-layers'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.hiddenLayers', 'array', 'placedAsset.placement.hiddenLayers', {
    html: {
      readAttrs: ['data-id-hidden-layers', 'data-id-pdf-hidden-layers'],
      writeAttrs: ['data-id-hidden-layers', 'data-id-pdf-hidden-layers'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.preserveVector', 'boolean', 'placedAsset.placement.preserveVector', {
    html: {
      readAttrs: ['data-id-preserve-vector'],
      writeAttrs: ['data-id-preserve-vector'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.contentBox.x', 'number|string', 'placedAsset.placement.contentBox.x', {
    html: {
      readAttrs: ['data-id-content-x'],
      writeAttrs: ['data-id-content-x'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.contentBox.y', 'number|string', 'placedAsset.placement.contentBox.y', {
    html: {
      readAttrs: ['data-id-content-y'],
      writeAttrs: ['data-id-content-y'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.contentBox.width', 'number|string', 'placedAsset.placement.contentBox.width', {
    html: {
      readAttrs: ['data-id-content-width'],
      writeAttrs: ['data-id-content-width'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.contentBox.height', 'number|string', 'placedAsset.placement.contentBox.height', {
    html: {
      readAttrs: ['data-id-content-height'],
      writeAttrs: ['data-id-content-height'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.contentBox.scaleX', 'number', 'placedAsset.placement.contentBox.scaleX', {
    html: {
      readAttrs: ['data-id-content-scale-x'],
      writeAttrs: ['data-id-content-scale-x'],
    },
  }),
  assetPlacementCanonical('items[].asset.placement.contentBox.scaleY', 'number', 'placedAsset.placement.contentBox.scaleY', {
    html: {
      readAttrs: ['data-id-content-scale-y'],
      writeAttrs: ['data-id-content-scale-y'],
    },
  }),
  assetSourceMetadata('items[].asset.placement.frameBounds', 'object', 'placedAsset.placement.frameBounds'),
  assetSourceMetadata('items[].asset.placement.contentBounds', 'object', 'placedAsset.placement.contentBounds'),
  assetSourceMetadata('items[].asset.placement.contentOffset', 'object', 'placedAsset.placement.contentOffset'),
  assetSourceMetadata('items[].asset.placement.contentSize', 'object', 'placedAsset.placement.contentSize'),
  assetSourceMetadata('items[].asset.placement.contentScale', 'object', 'placedAsset.placement.contentScale'),
  assetSourceMetadata('items[].asset.placement.pdfCrop', 'string', 'placedAsset.placement.pdfCrop'),
  assetSourceMetadata('items[].asset.placement.layers', 'array', 'placedAsset.placement.layers'),
];
