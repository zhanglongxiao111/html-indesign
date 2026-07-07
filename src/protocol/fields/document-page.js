const PAGE_CANONICAL_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

function pageGridScalar(canonicalPath, currentPaths, htmlAttr, type = 'number|string', extra = {}) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type,
    capabilities: PAGE_CANONICAL_CAPABILITIES,
    html: {
      readAttrs: [htmlAttr],
      writeAttrs: [htmlAttr],
    },
    indesign: {
      labelPaths: [`page.grid.${canonicalPath.slice('pages[].grid.'.length)}`],
      labelKinds: ['page'],
      instructionPaths: [`guides.grid.${canonicalPath.slice('pages[].grid.'.length)}`],
    },
    pptx: {
      customDataPaths: [`htmlIndesign.${canonicalPath}`],
    },
    ...extra,
  };
}

function pageGridDerivedScalar(canonicalPath, currentPaths, type = 'number|string') {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type,
    capabilities: PAGE_CANONICAL_CAPABILITIES,
    indesign: {
      labelPaths: [`page.grid.${canonicalPath.slice('pages[].grid.'.length)}`],
      labelKinds: ['page'],
      instructionPaths: [`guides.grid.${canonicalPath.slice('pages[].grid.'.length)}`],
    },
    pptx: {
      customDataPaths: [`htmlIndesign.${canonicalPath}`],
    },
  };
}

function pageMarginSide(side, htmlAttr) {
  return {
    canonicalPath: `pages[].margins.${side}`,
    currentPaths: [
      `labels[].margins.${side}`,
      `sourceNode.attributes.${htmlAttr}`,
      `pages[].effectiveLabel.margins.${side}`,
    ],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'number|string',
    capabilities: PAGE_CANONICAL_CAPABILITIES,
    html: {
      readAttrs: [htmlAttr],
      writeAttrs: [htmlAttr],
    },
    indesign: {
      labelPaths: [`margins.${side}`],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: [`htmlIndesign.pages[].margins.${side}`],
    },
  };
}

function pageHtmlCanonical(canonicalPath, currentPaths, htmlAttr, type = 'string', extra = {}) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type,
    capabilities: PAGE_CANONICAL_CAPABILITIES,
    html: {
      readAttrs: [htmlAttr],
      writeAttrs: [htmlAttr],
    },
    indesign: {
      labelPaths: [canonicalPath.slice('pages[].'.length)],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: [`htmlIndesign.${canonicalPath}`],
    },
    ...extra,
  };
}

const HTML_AUTHORING_PAGE_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'native', persist: 'native' },
  indesign: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

module.exports = [
  {
    canonicalPath: 'document.id',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-document'],
      writeAttrs: ['data-id-document'],
    },
    indesign: {
      labelPaths: ['document.id'],
      labelKinds: ['document'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.document.id'],
    },
  },
  {
    canonicalPath: 'document.profile',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-profile'],
      writeAttrs: ['data-id-profile'],
    },
    indesign: {
      labelPaths: ['document.profile', 'profile'],
      labelKinds: ['document'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.document.profile'],
    },
  },
  {
    canonicalPath: 'pages[].id',
    currentPaths: ['snapshot.pages[].id', 'reverseModel.pages[].id'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-page'],
      writeAttrs: ['data-page'],
    },
    indesign: {
      labelPaths: ['page.id'],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].id'],
    },
  },
  {
    canonicalPath: 'pages[].layout',
    currentPaths: ['pages[].semanticLayout', 'labels[].layout', 'pages[].effectiveLabel.layout'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-layout'],
      writeAttrs: ['data-id-layout'],
    },
    indesign: {
      labelPaths: ['page.layout', 'layout'],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].layout'],
    },
  },
  {
    canonicalPath: 'pages[].parentPage',
    currentPaths: ['labels[].parentPage', 'pages[].effectiveLabel.parentPage'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'object',
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['parentPage'],
      labelKinds: ['page'],
    },
  },
  {
    canonicalPath: 'pages[].parentPageId',
    currentPaths: ['labels[].parentPageId', 'pages[].effectiveLabel.parentPageId'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-parent-page'],
      writeAttrs: ['data-id-parent-page'],
    },
    indesign: {
      labelPaths: ['parentPageId'],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].parentPageId'],
    },
  },
  {
    canonicalPath: 'pages[].parentPageName',
    currentPaths: ['labels[].parentPageName', 'pages[].effectiveLabel.parentPageName'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-parent-page-name'],
      writeAttrs: ['data-id-parent-page-name'],
    },
    indesign: {
      labelPaths: ['parentPageName'],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].parentPageName'],
    },
  },
  {
    canonicalPath: 'pages[].margins',
    currentPaths: ['labels[].margins', 'sourceNode.attributes.data-id-margin', 'pages[].effectiveLabel.margins'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'object',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-margin'],
      writeAttrs: ['data-id-margin'],
    },
    indesign: {
      labelPaths: ['margins'],
      labelKinds: ['page'],
    },
  },
  pageMarginSide('top', 'data-id-margin-top'),
  pageMarginSide('right', 'data-id-margin-right'),
  pageMarginSide('bottom', 'data-id-margin-bottom'),
  pageMarginSide('left', 'data-id-margin-left'),
  {
    canonicalPath: 'pages[].grid',
    currentPaths: ['labels[].grid', 'sourceNode.attributes.data-id-grid', 'pages[].effectiveLabel.grid'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'object',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-grid'],
      writeAttrs: ['data-id-grid'],
    },
    indesign: {
      labelPaths: ['page.grid'],
      labelKinds: ['page'],
      instructionPaths: ['guides.grid'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].grid'],
    },
  },
  pageGridDerivedScalar(
    'pages[].grid.columns',
    [],
    'number',
  ),
  pageGridDerivedScalar(
    'pages[].grid.rows',
    [],
    'number',
  ),
  pageGridScalar(
    'pages[].grid.columnGutter',
    ['labels[].grid.columnGutter', 'sourceNode.attributes.data-id-column-gutter', 'pages[].effectiveLabel.grid.columnGutter'],
    'data-id-column-gutter',
  ),
  pageGridScalar(
    'pages[].grid.rowGutter',
    ['labels[].grid.rowGutter', 'sourceNode.attributes.data-id-row-gutter', 'pages[].effectiveLabel.grid.rowGutter'],
    'data-id-row-gutter',
  ),
  pageGridScalar(
    'pages[].grid.baseline',
    ['labels[].grid.baseline', 'sourceNode.attributes.data-id-baseline', 'pages[].effectiveLabel.grid.baseline'],
    'data-id-baseline',
  ),
  pageGridScalar(
    'pages[].grid.baselineGuideMode',
    ['sourceNode.attributes.data-id-baseline-guides'],
    'data-id-baseline-guides',
    'string',
    { capabilities: HTML_AUTHORING_PAGE_CAPABILITIES },
  ),
  pageHtmlCanonical('pages[].guideMode', ['sourceNode.attributes.data-id-guide-mode'], 'data-id-guide-mode', 'string', { capabilities: HTML_AUTHORING_PAGE_CAPABILITIES }),
  pageHtmlCanonical('pages[].snapGrid', ['sourceNode.attributes.data-id-snap-grid'], 'data-id-snap-grid', 'number|string', { capabilities: HTML_AUTHORING_PAGE_CAPABILITIES }),
  pageHtmlCanonical('pages[].snapGridX', ['sourceNode.attributes.data-id-snap-grid-x'], 'data-id-snap-grid-x', 'number|string', { capabilities: HTML_AUTHORING_PAGE_CAPABILITIES }),
  pageHtmlCanonical('pages[].snapGridY', ['sourceNode.attributes.data-id-snap-grid-y'], 'data-id-snap-grid-y', 'number|string', { capabilities: HTML_AUTHORING_PAGE_CAPABILITIES }),
];
