module.exports = [
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
    },
  },
  {
    canonicalPath: 'items[].sourceAncestorNodes',
    currentPaths: ['labels[].sourceAncestorNodes', 'effectiveLabel.sourceAncestorNodes'],
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
    },
  },
  {
    canonicalPath: 'items[].sourceFile',
    currentPaths: ['pages[].sourceFile', 'labels[].sourceFile', 'effectiveLabel.sourceFile'],
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
    },
  },
  {
    canonicalPath: 'items[].sourceText',
    currentPaths: ['labels[].sourceText', 'effectiveLabel.sourceText'],
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
    },
  },
  {
    canonicalPath: 'items[].sourceHtml',
    currentPaths: ['labels[].sourceHtml', 'effectiveLabel.sourceHtml'],
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
    },
  },
  {
    canonicalPath: 'items[].sourceHtmlTag',
    currentPaths: ['labels[].htmlTag', 'effectiveLabel.htmlTag'],
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
    },
  },
  {
    canonicalPath: 'items[].sourceClassName',
    currentPaths: ['labels[].className', 'effectiveLabel.className'],
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
    currentPaths: ['labels[].structure', 'effectiveLabel.structure'],
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
    },
  },
  {
    canonicalPath: 'items[].sourceRuns',
    currentPaths: ['labels[].sourceRuns', 'effectiveLabel.sourceRuns'],
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
    },
  },
];
