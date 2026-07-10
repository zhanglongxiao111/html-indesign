function documentSourcePackageField(canonicalPath, currentPaths, htmlAttr, type = 'string') {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type,
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: [htmlAttr],
      writeAttrs: [htmlAttr],
    },
    indesign: {
      labelPaths: [canonicalPath.slice('document.'.length)],
      labelKinds: ['document'],
    },
  };
}

function htmlSourceMetadataField(canonicalPath, currentPaths, htmlAttr, type = 'string') {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type,
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: [htmlAttr],
      writeAttrs: [htmlAttr],
    },
    indesign: {
      labelPaths: [canonicalPath.slice('items[].'.length)],
      labelKinds: ['page', 'item'],
    },
  };
}

function htmlModelSourceMetadataField(canonicalPath, currentPaths, type) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type,
    capabilities: {
      html: { read: 'native', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
  };
}

module.exports = [
  documentSourcePackageField(
    'document.sourcePackage.config',
    ['sourcePackage.config', 'labels[].sourcePackage.config', 'sourcePackageInput.attributes.data-id-source-package-config'],
    'data-id-source-package-config',
  ),
  documentSourcePackageField(
    'document.sourcePackage.schemaVersion',
    ['sourcePackage.schemaVersion', 'labels[].sourcePackage.schemaVersion', 'sourcePackageInput.attributes.data-id-source-package-schema'],
    'data-id-source-package-schema',
    'integer|string',
  ),
  {
    canonicalPath: 'document.sourcePackage.parentPages',
    currentPaths: ['sourcePackage.parentPages', 'sourcePackageInput.parentPages'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: ['data-id-source-package-parent-pages'],
      writeAttrs: ['data-id-source-package-parent-pages'],
    },
  },
  {
    canonicalPath: 'document.sourcePackage.layers',
    currentPaths: ['sourcePackage.layers', 'sourcePackageInput.layers'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: ['data-id-source-package-layers'],
      writeAttrs: ['data-id-source-package-layers'],
    },
  },
  {
    canonicalPath: 'document.sourcePackage.compositeFonts',
    currentPaths: ['sourcePackage.compositeFonts', 'sourcePackageInput.compositeFonts'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: ['data-id-source-package-composite-fonts'],
      writeAttrs: ['data-id-source-package-composite-fonts'],
    },
  },
  documentSourcePackageField(
    'document.semanticPreset.relativePath',
    ['semanticPreset.relativePath', 'labels[].semanticPreset.relativePath', 'sourcePackageInput.attributes.data-id-semantic-preset'],
    'data-id-semantic-preset',
  ),
  htmlSourceMetadataField(
    'items[].source',
    ['pages[].source', 'items[].source', 'sourceNode.attributes.data-id-source'],
    'data-id-source',
  ),
  htmlModelSourceMetadataField('pages[].attributes', [], 'object'),
  htmlModelSourceMetadataField('document.styleLayout', ['styleLayout'], 'object'),
  htmlModelSourceMetadataField('pages[].classList', [], 'array'),
  htmlModelSourceMetadataField('pages[].computedStyle', [], 'object'),
  htmlModelSourceMetadataField('items[].attributes', [], 'object'),
  htmlModelSourceMetadataField('items[].classList', [], 'array'),
  htmlModelSourceMetadataField('items[].computedStyle', [], 'object'),
  htmlModelSourceMetadataField('items[].authoredStyle', [], 'object'),
  htmlModelSourceMetadataField('items[].sourceSelector', [], 'string'),
  htmlModelSourceMetadataField('items[].boundsMm', [], 'object'),
  htmlModelSourceMetadataField('items[].box', [], 'object'),
  htmlModelSourceMetadataField('items[].table.sourceRows', [], 'array'),
  htmlSourceMetadataField(
    'items[].parentPageItem',
    ['parentPages[].items[].parentPageItem', 'sourceNode.attributes.data-id-parent-page-item'],
    'data-id-parent-page-item',
    'boolean|string',
  ),
  {
    canonicalPath: 'pages[].parentPageItems',
    currentPaths: ['pages[].parentPageItems', 'instructions.pages[].parentPageItemOverrides'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      instructionPaths: ['pages[].parentPageItemOverrides'],
    },
  },
  htmlSourceMetadataField(
    'items[].parentPageSourceId',
    ['parentPages[].items[].parentPageSourceId', 'sourceNode.attributes.data-id-parent-page-source-id'],
    'data-id-parent-page-source-id',
  ),
  {
    canonicalPath: 'items[].sourceNode',
    currentPaths: ['labels[].sourceNode', 'effectiveLabel.sourceNode'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'object',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['sourceNode'],
      labelKinds: ['page', 'item'],
    },
  },
  {
    canonicalPath: 'items[].sourceAncestorNodes',
    currentPaths: ['labels[].sourceAncestorNodes', 'effectiveLabel.sourceAncestorNodes', 'pages[].effectiveLabel.sourceAncestorNodes'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['sourceAncestorNodes'],
      labelKinds: ['page', 'item'],
    },
  },
  {
    canonicalPath: 'items[].sourceFile',
    currentPaths: ['pages[].sourceFile', 'labels[].sourceFile', 'effectiveLabel.sourceFile', 'pages[].effectiveLabel.sourceFile'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['sourceFile'],
      labelKinds: ['page', 'item'],
    },
    html: {
      readAttrs: ['data-id-source-file'],
      writeAttrs: ['data-id-source-file'],
    },
  },
  {
    canonicalPath: 'items[].sourceText',
    currentPaths: ['labels[].sourceText', 'effectiveLabel.sourceText', 'pages[].effectiveLabel.sourceText'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['sourceText'],
      labelKinds: ['page', 'item'],
    },
  },
  {
    canonicalPath: 'items[].sourceHtml',
    currentPaths: ['labels[].sourceHtml', 'effectiveLabel.sourceHtml', 'pages[].effectiveLabel.sourceHtml'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['sourceHtml'],
      labelKinds: ['page', 'item'],
    },
  },
  {
    canonicalPath: 'items[].sourceHtmlTag',
    currentPaths: ['labels[].htmlTag'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['htmlTag'],
      labelKinds: ['page', 'item'],
    },
  },
  {
    canonicalPath: 'items[].sourceClassName',
    currentPaths: ['labels[].className', 'effectiveLabel.className', 'pages[].effectiveLabel.className'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['className'],
      labelKinds: ['page', 'item'],
    },
  },
  {
    canonicalPath: 'items[].effectiveLabel',
    currentPaths: ['pages[].items[].effectiveLabel'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'object',
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
  },
  {
    canonicalPath: 'items[].structure',
    currentPaths: ['labels[].structure', 'effectiveLabel.structure', 'pages[].effectiveLabel.structure'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'object',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['structure'],
      labelKinds: ['page', 'item'],
    },
  },
  {
    canonicalPath: 'items[].sourceRuns',
    currentPaths: ['labels[].sourceRuns', 'effectiveLabel.sourceRuns', 'pages[].effectiveLabel.sourceRuns'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      labelPaths: ['sourceRuns'],
      labelKinds: ['page', 'item'],
    },
  },
  {
    canonicalPath: 'items[].sourceNode.attributes.data-id-source-csv',
    currentPaths: [
      'sourceNode.attributes.data-id-source-csv',
      'labels[].sourceNode.attributes.data-id-source-csv',
      'effectiveLabel.sourceNode.attributes.data-id-source-csv',
      'pages[].items[].sourceNode.attributes.data-id-source-csv',
    ],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: ['data-id-source-csv'],
      writeAttrs: ['data-id-source-csv'],
    },
    indesign: {
      labelPaths: ['sourceNode.attributes.data-id-source-csv'],
      labelKinds: ['item'],
    },
  },
  {
    canonicalPath: 'items[].sourceNode.attributes.data-id-source-xml',
    currentPaths: [
      'sourceNode.attributes.data-id-source-xml',
      'labels[].sourceNode.attributes.data-id-source-xml',
      'effectiveLabel.sourceNode.attributes.data-id-source-xml',
      'pages[].items[].sourceNode.attributes.data-id-source-xml',
    ],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'source-metadata',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: ['data-id-source-xml'],
      writeAttrs: ['data-id-source-xml'],
    },
    indesign: {
      labelPaths: ['sourceNode.attributes.data-id-source-xml'],
      labelKinds: ['item'],
    },
  },
];
