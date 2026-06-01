const CANONICAL_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

const SOURCE_METADATA_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
});

function canonical(canonicalPath, currentPaths, type, extra = {}) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-model',
    type,
    capabilities: CANONICAL_CAPABILITIES,
    ...extra,
  };
}

function sourceMetadata(canonicalPath, currentPaths, type, extra = {}) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'document-model',
    type,
    capabilities: SOURCE_METADATA_CAPABILITIES,
    ...extra,
  };
}

module.exports = [
  canonical('document.title', ['title', 'labels[].title'], 'string', {
    indesign: { labelPaths: ['title'] },
  }),
  sourceMetadata('document.source', ['source'], 'string'),
  canonical('document.unitMode', ['unitMode', 'labels[].unitMode'], 'string', {
    indesign: { labelPaths: ['unitMode'] },
  }),
  canonical('document.coordinateUnit', ['coordinateUnit', 'labels[].coordinateUnit'], 'string', {
    indesign: { labelPaths: ['coordinateUnit'] },
  }),
  sourceMetadata('document.sourcePackage', ['sourcePackage', 'labels[].sourcePackage'], 'object', {
    indesign: { labelPaths: ['sourcePackage'] },
  }),
  sourceMetadata('parentPages', [], 'array'),
  canonical('layers', [], 'array'),
  canonical('styles', [], 'object'),
  canonical('pages[].index', [], 'integer'),
  canonical('pages[].semantic', [], 'string'),
  sourceMetadata('pages[].sourceNode', [], 'object'),
  canonical('pages[].width', [], 'number'),
  canonical('pages[].height', [], 'number'),
  canonical('pages[].guides', [], 'array'),
  canonical('items[].bounds', ['pages[].items[].bounds'], 'object'),
];
