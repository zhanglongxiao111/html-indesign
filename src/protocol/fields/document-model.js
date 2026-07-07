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

const FORMAT_EXTENSION_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
});

const INDESIGN_LAYER_CAPABILITIES = Object.freeze({
  html: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
  indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

const ABSTRACT_STYLE_RESOURCE_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

const CELL_STYLE_RESOURCE_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'native', persist: 'native' },
  indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

const STYLE_COLLECTIONS = Object.freeze([
  'paragraphStyles',
  'characterStyles',
  'objectStyles',
  'frameStyles',
  'tableStyles',
  'cellStyles',
]);

const STYLE_FEATURES = Object.freeze([
  'compositeFont',
  'dropCap',
  'list',
  'grepStyles',
  'nestedStyles',
]);

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

function formatExtension(canonicalPath, currentPaths, type, extra = {}) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'formatExtension',
    lifecycle: 'active',
    owner: 'document-model',
    type,
    capabilities: FORMAT_EXTENSION_CAPABILITIES,
    ...extra,
  };
}

function parentPageEntries() {
  return [
    sourceMetadata('parentPages[].id', [], 'string'),
    sourceMetadata('parentPages[].name', [], 'string'),
    sourceMetadata('parentPages[].semantic', [], 'string'),
    sourceMetadata('parentPages[].parentPageId', [], 'string'),
    sourceMetadata('parentPages[].parentPageName', [], 'string'),
    sourceMetadata('parentPages[].provides', [], 'array', {
      indesign: { labelPaths: ['provides'], labelKinds: ['parentPage'] },
    }),
    sourceMetadata('parentPages[].bounds', [], 'object'),
    sourceMetadata('parentPages[].guides', [], 'array'),
    sourceMetadata('parentPages[].labels', [], 'array'),
    sourceMetadata('parentPages[].items', [], 'array'),
  ];
}

function layerEntries() {
  return [
    canonical('layers[].token', [], 'string', { capabilities: INDESIGN_LAYER_CAPABILITIES }),
    canonical('layers[].displayName', [], 'string', { capabilities: INDESIGN_LAYER_CAPABILITIES }),
    canonical('layers[].name', [], 'string', { capabilities: INDESIGN_LAYER_CAPABILITIES }),
    canonical('layers[].visible', [], 'boolean', { capabilities: INDESIGN_LAYER_CAPABILITIES }),
    canonical('layers[].printable', [], 'boolean', { capabilities: INDESIGN_LAYER_CAPABILITIES }),
    canonical('layers[].locked', [], 'boolean', { capabilities: INDESIGN_LAYER_CAPABILITIES }),
    sourceMetadata('layers[].labels', [], 'array', { capabilities: INDESIGN_LAYER_CAPABILITIES }),
  ];
}

function styleCollectionEntries(collection) {
  const extra = collection === 'cellStyles'
    ? { capabilities: CELL_STYLE_RESOURCE_CAPABILITIES }
    : {};
  return [
    canonical(`styles.${collection}`, [], 'object'),
    ...styleResourceEntries(`styles.${collection}[]`, extra),
  ];
}

function styleResourceEntries(prefix, extra = {}) {
  const styleResourceExtra = prefix === 'styles[]'
    ? { capabilities: ABSTRACT_STYLE_RESOURCE_CAPABILITIES }
    : extra;
  return [
    canonical(`${prefix}.name`, [], 'string', styleResourceExtra),
    canonical(`${prefix}.token`, [], 'string', styleResourceExtra),
    canonical(`${prefix}.displayName`, [], 'string', styleResourceExtra),
    sourceMetadata(`${prefix}.safeName`, [], 'string', styleResourceExtra),
    sourceMetadata(`${prefix}.css`, [], 'string', styleResourceExtra),
    sourceMetadata(`${prefix}.source`, [], 'string', styleResourceExtra),
    sourceMetadata(`${prefix}.labels`, [], 'array', styleResourceExtra),
    formatExtension(`${prefix}.indesignFeatures`, [], 'object'),
    ...STYLE_FEATURES.map((feature) => (
      formatExtension(`${prefix}.indesignFeatures.${feature}`, [], 'object')
    )),
  ];
}

function compositeFontEntries() {
  return [
    formatExtension('styles.compositeFonts', [], 'object'),
    formatExtension('styles.compositeFonts[].name', [], 'string'),
    formatExtension('styles.compositeFonts[].safeName', [], 'string'),
    formatExtension('styles.compositeFonts[].hasBoldCJK', [], 'boolean'),
    formatExtension('styles.compositeFonts[].cjkWeight', [], 'string'),
    formatExtension('styles.compositeFonts[].romanWeight', [], 'string'),
    formatExtension('styles.compositeFonts[].entries', [], 'array'),
    formatExtension('styles.compositeFonts[].entries[].name', [], 'string'),
    formatExtension('styles.compositeFonts[].entries[].fontStyle', [], 'string'),
    formatExtension('styles.compositeFonts[].entries[].size', [], 'number'),
    formatExtension('styles.compositeFonts[].entries[].weight', [], 'string'),
  ];
}

module.exports = [
  canonical('document.title', ['title', 'labels[].title'], 'string', {
    indesign: { labelPaths: ['title'], labelKinds: ['document'] },
  }),
  sourceMetadata('document.source', ['source'], 'string'),
  canonical('document.unitMode', ['unitMode', 'labels[].unitMode'], 'string', {
    indesign: { labelPaths: ['unitMode'], labelKinds: ['document'] },
  }),
  canonical('document.coordinateUnit', ['coordinateUnit', 'labels[].coordinateUnit'], 'string', {
    indesign: { labelPaths: ['coordinateUnit'], labelKinds: ['document'] },
  }),
  sourceMetadata('document.sourcePackage', ['sourcePackage', 'labels[].sourcePackage'], 'object', {
    indesign: { labelPaths: ['sourcePackage'], labelKinds: ['document'] },
  }),
  sourceMetadata('parentPages', [], 'array'),
  ...parentPageEntries(),
  canonical('layers', [], 'array'),
  ...layerEntries(),
  canonical('styles', [], 'object'),
  ...styleResourceEntries('styles[]'),
  ...STYLE_COLLECTIONS.flatMap(styleCollectionEntries),
  ...compositeFontEntries(),
  canonical('pages[].index', [], 'integer'),
  canonical('pages[].semantic', ['pages[].effectiveLabel.semantic'], 'string'),
  sourceMetadata('pages[].sourceNode', ['pages[].effectiveLabel.sourceNode'], 'object'),
  canonical('pages[].width', [], 'number'),
  canonical('pages[].height', [], 'number'),
  canonical('pages[].guides', ['reverseModel.pages[].guides', 'sourceNode.attributes.data-id-guides'], 'array', {
    html: {
      readAttrs: ['data-id-guides'],
      writeAttrs: ['data-id-guides'],
    },
    indesign: {
      labelPaths: ['guides'],
      labelKinds: ['page'],
      instructionPaths: ['document.pages[].guides', 'pages[].guides'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].guides'],
    },
  }),
  canonical('items[].bounds', ['pages[].items[].bounds'], 'object', {
    description: 'Absolute page coordinates for the item bounds, measured in pt.',
    contract: {
      coordinateSystem: 'absolute-page',
      unit: 'pt',
    },
  }),
];
